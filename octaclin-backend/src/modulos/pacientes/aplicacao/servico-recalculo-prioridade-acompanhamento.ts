import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, IsNull, MoreThanOrEqual } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
import {
  ResultadoPrioridadeAcompanhamento,
  calcularPrioridadeAcompanhamento
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

/** > 90 dias (a maior janela da formula 265.1) com folga, para nao cortar falta na borda. */
const JANELA_BUSCA_CONSULTAS_DIAS = 100;
const LIMITE_CONSULTAS_POR_PACIENTE = 60;

/**
 * Fase 265, Incremento 265.3 (`docs/history/phases/PLANO_FASE_265.md`):
 * recalculo idempotente da prioridade de acompanhamento (265.1), persistido
 * nas tabelas de 265.2. Servico puro de worker, sem efeito externo (nao
 * envia mensagem, nao dispara automacao, nao altera `pacientes.score_risco`).
 *
 * Sinal `formulario_vencido` (formula 265.1) e deliberadamente OMITIDO deste
 * job: ele exige saber se um questionario e "obrigatorio", e nenhuma
 * entidade do modulo de questionarios (`QuestionarioOrm`,
 * `EnvioQuestionarioOrm`, `AgendamentoQuestionarioOrm`) tem esse campo hoje.
 * Assumir que todo envio conta, ou que nenhum conta, seria inventar uma
 * decisao de produto que ainda nao foi tomada -- o mesmo cuidado que a
 * migration 265.2 ja registrou para `override_codigo_motivo`. Os outros tres
 * sinais (faltas recentes, sem retorno programado, adesao declarada baixa)
 * mapeiam para dado que ja existe e sao calculados normalmente. Fechar esse
 * gap exige decisao de produto explicita antes de qualquer codigo.
 */
@Injectable()
export class ServicoRecalculoPrioridadeAcompanhamento {
  private readonly logger = new Logger(ServicoRecalculoPrioridadeAcompanhamento.name);

  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async recalcularTenant(tenantId: string, agora = new Date()): Promise<ResultadoRecalculoPrioridadeTenant> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const pacientes = await gerenciador
        .getRepository(PacienteOrm)
        .find({ where: { tenantId, arquivadoEm: IsNull() } });

      const resultado: ResultadoRecalculoPrioridadeTenant = {
        pacientesAvaliados: pacientes.length,
        pacientesAtualizados: 0,
        pacientesInalterados: 0,
        pacientesComFalha: 0
      };

      for (const paciente of pacientes) {
        try {
          const gravouHistoricoNovo = await this.recalcularPaciente(gerenciador, tenantId, paciente.id, agora);
          if (gravouHistoricoNovo) resultado.pacientesAtualizados += 1;
          else resultado.pacientesInalterados += 1;
        } catch (erro) {
          resultado.pacientesComFalha += 1;
          // So o nome da classe do erro entra no log -- mesma disciplina de
          // ServicoAuditoria. O ultimo valor valido de
          // prioridades_acompanhamento_paciente para este paciente
          // permanece intacto: nenhuma escrita parcial ou incorreta chega
          // ao banco quando este catch dispara.
          this.logger.warn({
            evento: 'prioridade_acompanhamento.recalculo_falhou',
            tenantId,
            pacienteId: paciente.id,
            erroNome: erro instanceof Error ? erro.name : 'ErroDesconhecido'
          });
        }
      }

      return resultado;
    });
  }

  private async recalcularPaciente(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    agora: Date
  ): Promise<boolean> {
    const janelaInicio = new Date(agora.getTime() - JANELA_BUSCA_CONSULTAS_DIAS * 24 * 60 * 60 * 1000);

    const [consultas, ultimoRegistro] = await Promise.all([
      gerenciador.getRepository(AgendaConsultaOrm).find({
        where: { tenantId, pacienteId, inicioEm: MoreThanOrEqual(janelaInicio) },
        order: { inicioEm: 'DESC' },
        take: LIMITE_CONSULTAS_POR_PACIENTE
      }),
      gerenciador
        .getRepository(LogDiarioRapidoOrm)
        .findOne({ where: { tenantId, pacienteId }, order: { registradoEm: 'DESC' } })
    ]);

    const faltas = consultas
      .filter((consulta) => consulta.status === 'falta')
      .map((consulta) => ({ consultaId: consulta.id, ocorreuEm: consulta.inicioEm }));

    const ultimaConsultaConcluidaEm = maisRecente(
      consultas.filter((consulta) => consulta.status === 'concluida').map((consulta) => consulta.inicioEm)
    );

    const proximaConsultaEm = maisProxima(
      consultas
        .filter((consulta) => (consulta.status === 'agendada' || consulta.status === 'reagendada') && consulta.inicioEm >= agora)
        .map((consulta) => consulta.inicioEm)
    );

    const ultimoRegistroHabitos = ultimoRegistro ? this.lerRegistroHabitos(ultimoRegistro) : undefined;

    const resultado = calcularPrioridadeAcompanhamento({
      agora,
      faltas,
      ultimaConsultaConcluidaEm,
      proximaConsultaEm,
      ultimoRegistroHabitos
    });

    await this.atualizarEstadoAtual(gerenciador, tenantId, pacienteId, agora, resultado);
    return this.registrarHistoricoSeNovo(gerenciador, tenantId, pacienteId, agora, resultado);
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
  private async atualizarEstadoAtual(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteId: string,
    agora: Date,
    resultado: ResultadoPrioridadeAcompanhamento
  ): Promise<void> {
    const repositorio = gerenciador.getRepository(PrioridadeAcompanhamentoPacienteOrm);
    const atual = await repositorio.findOne({ where: { tenantId, pacienteId } });
    const registro = atual ?? repositorio.create({ tenantId, pacienteId });
    registro.score = resultado.score;
    registro.faixa = resultado.faixa;
    registro.fatores = resultado.fatores;
    registro.versaoFormula = resultado.versaoFormula;
    registro.calculadoEm = agora;
    await repositorio.save(registro);
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
}

function maisRecente(datas: Date[]): Date | undefined {
  return datas.reduce<Date | undefined>((atual, data) => (!atual || data > atual ? data : atual), undefined);
}

function maisProxima(datas: Date[]): Date | undefined {
  return datas.reduce<Date | undefined>((atual, data) => (!atual || data < atual ? data : atual), undefined);
}

function mesmoDiaUtc(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
  );
}
