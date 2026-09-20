import { Injectable, Logger } from '@nestjs/common';
import { Between, EntityManager, IsNull, LessThanOrEqual, MoreThan } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { dispararGatilhoAutomacao } from '../../automacoes/aplicacao/disparar-gatilho-automacao';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
import {
  FaixaPrioridadeAcompanhamento,
  ResultadoPrioridadeAcompanhamento,
  calcularPrioridadeAcompanhamento,
  entrouEmAltaPrioridade
} from '../dominio/prioridade-acompanhamento';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { PrioridadeAcompanhamentoHistoricoOrm } from '../infraestrutura/prioridade-acompanhamento-historico.orm';
import { PrioridadeAcompanhamentoPacienteOrm } from '../infraestrutura/prioridade-acompanhamento-paciente.orm';

export interface ResultadoRecalculoPrioridadeTenant {
  pacientesAvaliados: number;
  /** Ganhou uma linha nova no historico (primeiro calculo do dia). */
  pacientesAtualizados: number;
  /** Ja tinha um calculo hoje para a mesma versao da formula -- so o cache foi atualizado. */
  pacientesInalterados: number;
  pacientesComFalha: number;
}

const JANELA_FALTAS_DIAS = 90;

/**
 * Fase 265, Incremento 265.3 (`docs/history/phases/PLANO_FASE_265.md`):
 * recalculo idempotente da prioridade de acompanhamento (265.1), persistido
 * nas tabelas de 265.2. Servico de worker sem efeito externo proprio (nao
 * envia mensagem, nao altera `pacientes.score_risco`); desde a Fase 267.2
 * (PB-03) ele registra, na mesma transacao do recalculo, o disparo do
 * gatilho `paciente.risco_alto` quando a faixa calculada entra em `alta` --
 * ver `dispararRiscoAltoSeNecessario` abaixo.
 *
 * A formula (265.1/265.5, versao `1.1.0`) usa tres sinais -- faltas
 * recentes, sem retorno programado, adesao declarada baixa --, todos
 * mapeados para dado que ja existe. O fator `formulario_vencido` da versao
 * `1.0.0` foi removido na 265.5 por decisao de produto: o dominio de
 * questionarios nao tem o conceito de "obrigatorio" que o fator exigia, e
 * modelar isso so para alimentar a formula seria inventar comportamento
 * novo. Pode voltar numa formula futura se o produto adquirir esse
 * conceito.
 */
@Injectable()
export class ServicoRecalculoPrioridadeAcompanhamento {
  private readonly logger = new Logger(ServicoRecalculoPrioridadeAcompanhamento.name);

  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async recalcularTenant(tenantId: string, agora = new Date()): Promise<ResultadoRecalculoPrioridadeTenant> {
    const pacientes = await this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador
        .getRepository(PacienteOrm)
        .find({ select: { id: true }, where: { tenantId, arquivadoEm: IsNull() } })
    );

    const resultado: ResultadoRecalculoPrioridadeTenant = {
      pacientesAvaliados: pacientes.length,
      pacientesAtualizados: 0,
      pacientesInalterados: 0,
      pacientesComFalha: 0
    };

    for (const paciente of pacientes) {
      try {
        // Cada paciente usa uma transacao propria. Uma instrucao PostgreSQL
        // com erro aborta a transacao atual; separar as unidades de trabalho
        // impede que esse estado contamine os pacientes seguintes. A trava
        // de rodada por tenant continua mantida pelo processador enquanto
        // este metodo executa.
        const gravouHistoricoNovo = await this.executorTenant.executar(tenantId, (gerenciador) =>
          this.recalcularPaciente(gerenciador, tenantId, paciente.id, agora)
        );
        if (gravouHistoricoNovo) resultado.pacientesAtualizados += 1;
        else resultado.pacientesInalterados += 1;
      } catch (erro) {
        resultado.pacientesComFalha += 1;
        // So o nome da classe do erro entra no log -- mesma disciplina de
        // ServicoAuditoria. Como toda a operacao do paciente foi revertida,
        // o ultimo valor valido permanece intacto.
        this.logger.warn({
          evento: 'prioridade_acompanhamento.recalculo_falhou',
          tenantId,
          pacienteId: paciente.id,
          erroNome: erro instanceof Error ? erro.name : 'ErroDesconhecido'
        });
      }
    }

    return resultado;
  }

  private async recalcularPaciente(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    agora: Date
  ): Promise<boolean> {
    const janelaFaltasInicio = new Date(agora.getTime() - JANELA_FALTAS_DIAS * 24 * 60 * 60 * 1000);
    const repositorioConsultas = gerenciador.getRepository(AgendaConsultaOrm);

    const [consultasComFalta, ultimaConsultaConcluida, proximaConsulta, ultimoRegistro] = await Promise.all([
      repositorioConsultas.find({
        select: { id: true, inicioEm: true },
        where: { tenantId, pacienteId, status: 'falta', inicioEm: Between(janelaFaltasInicio, agora) }
      }),
      repositorioConsultas.findOne({
        select: { inicioEm: true },
        where: { tenantId, pacienteId, status: 'concluida', inicioEm: LessThanOrEqual(agora) },
        order: { inicioEm: 'DESC' }
      }),
      repositorioConsultas.findOne({
        select: { inicioEm: true },
        where: [
          { tenantId, pacienteId, status: 'agendada', inicioEm: MoreThan(agora) },
          { tenantId, pacienteId, status: 'reagendada', inicioEm: MoreThan(agora) }
        ],
        order: { inicioEm: 'ASC' }
      }),
      gerenciador
        .getRepository(LogDiarioRapidoOrm)
        .findOne({ where: { tenantId, pacienteId }, order: { registradoEm: 'DESC' } })
    ]);

    const faltas = consultasComFalta.map((consulta) => ({ consultaId: consulta.id, ocorreuEm: consulta.inicioEm }));

    const ultimoRegistroHabitos = ultimoRegistro ? this.lerRegistroHabitos(ultimoRegistro) : undefined;

    const resultado = calcularPrioridadeAcompanhamento({
      agora,
      faltas,
      ultimaConsultaConcluidaEm: ultimaConsultaConcluida?.inicioEm,
      proximaConsultaEm: proximaConsulta?.inicioEm,
      ultimoRegistroHabitos
    });

    const faixaAnterior = await this.atualizarEstadoAtual(gerenciador, tenantId, pacienteId, agora, resultado);
    const gravouHistoricoNovo = await this.registrarHistoricoSeNovo(gerenciador, tenantId, pacienteId, agora, resultado);
    if (gravouHistoricoNovo) {
      await this.dispararRiscoAltoSeNecessario(gerenciador, tenantId, pacienteId, faixaAnterior, resultado, agora);
    }
    return gravouHistoricoNovo;
  }

  /**
   * So decifra e le `adesaoPlano`. Uma falha de chave/formato aqui nao pode
   * derrubar o calculo inteiro do paciente -- vira ausencia do sinal, mesmo
   * tratamento que `lerValorDiario` ja aplica em `ServicoPacientes` para
   * registro historico ilegivel.
   */
  private lerRegistroHabitos(
    diario: LogDiarioRapidoOrm
  ): { registradoEm: Date; adesaoPercentual: number } | undefined {
    const valor = this.lerValorDiario(diario);
    const adesao = valor.adesaoPlano;
    if (typeof adesao !== 'number' || !Number.isFinite(adesao)) return undefined;
    return { registradoEm: diario.registradoEm, adesaoPercentual: adesao };
  }

  private lerValorDiario(diario: LogDiarioRapidoOrm): Record<string, unknown> {
    if (!diario.valorCriptografado) return diario.valor ?? {};
    try {
      return JSON.parse(this.criptografia.descriptografar(diario.valorCriptografado)) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /**
   * Upsert do cache. So os campos calculados sao reatribuidos -- os campos
   * de override (`overrideFaixa` e os demais) nunca sao tocados aqui, entao
   * `save()` os grava de volta exatamente como estavam lidos. Expiracao de
   * override e leitura com o valor efetivo ficam para 265.4, de proposito.
   */
  /**
   * Devolve a faixa calculada ANTERIOR (antes desta escrita), para o
   * gatilho `paciente.risco_alto` decidir se houve entrada em `alta`.
   * `undefined` quando este e o primeiro calculo do paciente.
   */
  private async atualizarEstadoAtual(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    agora: Date,
    resultado: ResultadoPrioridadeAcompanhamento
  ): Promise<FaixaPrioridadeAcompanhamento | undefined> {
    const repositorio = gerenciador.getRepository(PrioridadeAcompanhamentoPacienteOrm);
    const atual = await repositorio.findOne({ where: { tenantId, pacienteId } });
    const faixaAnterior = atual?.faixa;
    const registro = atual ?? repositorio.create({ tenantId, pacienteId });
    registro.score = resultado.score;
    registro.faixa = resultado.faixa;
    registro.fatores = resultado.fatores;
    registro.versaoFormula = resultado.versaoFormula;
    registro.calculadoEm = agora;
    await repositorio.save(registro);
    return faixaAnterior;
  }

  /**
   * Idempotencia por paciente, versao da formula e janela (o dia UTC do
   * calculo, mesma cadencia diaria do `@Cron` que chama este servico):
   * so grava um evento `calculo` novo quando o ultimo registrado para esta
   * combinacao nao e de hoje. Rodar o job duas vezes no mesmo dia (retry,
   * redeploy) atualiza o cache mas nao duplica o historico.
   */
  private async registrarHistoricoSeNovo(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    agora: Date,
    resultado: ResultadoPrioridadeAcompanhamento
  ): Promise<boolean> {
    const repositorio = gerenciador.getRepository(PrioridadeAcompanhamentoHistoricoOrm);
    const ultimoCalculo = await repositorio.findOne({
      where: { tenantId, pacienteId, tipoEvento: 'calculo', versaoFormula: resultado.versaoFormula },
      order: { criadoEm: 'DESC' }
    });
    if (ultimoCalculo && mesmoDiaUtc(ultimoCalculo.criadoEm, agora)) return false;

    await repositorio.save(
      repositorio.create({
        tenantId,
        pacienteId,
        tipoEvento: 'calculo',
        score: resultado.score,
        faixa: resultado.faixa,
        versaoFormula: resultado.versaoFormula,
        fatores: resultado.fatores
      })
    );
    return true;
  }

  /**
   * PB-03 (Fase 267.2): dispara `paciente.risco_alto` quando o calculo
   * deterministico entra em `alta` -- nunca por override, que nao passa por
   * este metodo (override e escrito exclusivamente por `servico-pacientes.ts`,
   * fora do fluxo de recalculo). So chamado quando `registrarHistoricoSeNovo`
   * acabou de gravar um evento `calculo` novo, entao a chave de origem
   * (paciente, versao da formula, dia UTC) e igual a chave de idempotencia
   * daquele evento -- a mesma condicao que evita historico duplicado no
   * mesmo dia tambem evita um segundo disparo. O contexto duravel carrega
   * somente o tipo do evento, nunca score, fatores ou justificativa.
   */
  private async dispararRiscoAltoSeNecessario(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    faixaAnterior: FaixaPrioridadeAcompanhamento | undefined,
    resultado: ResultadoPrioridadeAcompanhamento,
    agora: Date
  ): Promise<void> {
    if (!entrouEmAltaPrioridade(faixaAnterior, resultado.faixa)) return;

    await dispararGatilhoAutomacao(gerenciador, tenantId, {
      tipo: 'paciente.risco_alto',
      pacienteId,
      origemTipo: 'prioridade_acompanhamento_calculo',
      origemId: `${pacienteId}:${resultado.versaoFormula}:${diaUtcChave(agora)}`,
      contexto: { evento: 'paciente.risco_alto' }
    });
  }
}

function mesmoDiaUtc(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
  );
}

/** Chave estavel do dia UTC, usada apenas como identificador opaco de origem. */
function diaUtcChave(data: Date): string {
  return data.toISOString().slice(0, 10);
}
