import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import {
  CandidatoCheckinAtrasado,
  ConfiguracaoCheckinAtrasado,
  ExclusaoCheckinAtrasado,
  GATILHO_CHECKIN_ATRASADO,
  PacienteParaCheckinAtrasado,
  ehGatilhoCheckinAtrasado,
  normalizarConfiguracaoCheckinAtrasado,
  selecionarCandidatosCheckinAtrasado
} from '../dominio/checkin-atrasado';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import { dispararParaRegra } from './disparar-gatilho-automacao';

export interface ResultadoSimulacaoCheckinAtrasado {
  execucao: ExecucaoRegraOrm;
  configuracao: ConfiguracaoCheckinAtrasado;
  candidatos: CandidatoCheckinAtrasado[];
  excluidos: ExclusaoCheckinAtrasado[];
}

export interface ResultadoProcessamentoCheckinAtrasado {
  regrasAvaliadas: number;
  pacientesDisparados: number;
  pacientesIgnorados: number;
  pacientesComErro: number;
  /** Regras que nem chegaram a ser avaliadas por falha na selecao. */
  regrasComErro: number;
}

/**
 * Gatilho periodico `checkin.atrasado` (PB-03, Fase 267.3). Ao contrario do
 * recall de inatividade (fluxo especializado que envia mensagem
 * diretamente), este gatilho e generico: a selecao decide QUEM entra na
 * rodada, e `dispararParaRegra` (fundacao das 267.1/267.2) cria a execucao e
 * o outbox; as acoes configuradas na regra rodam depois pelo pipeline ja
 * existente da Fase 266 (`ProcessadorAutomacoes`).
 */
@Injectable()
export class ServicoCheckinAtrasado {
  private readonly logger = new Logger(ServicoCheckinAtrasado.name);

  constructor(private readonly executorTenant: ExecutorTenant) {}

  /**
   * Simulacao nominal obrigatoria antes de ativar: devolve exatamente quem
   * entraria na rodada e, para cada excluido, o motivo. Nunca despacha
   * nenhuma acao nem cria execucao alem da propria simulacao.
   */
  async simular(
    tenantId: string,
    regraId: string,
    usuario: UsuarioAutenticado,
    agora = new Date()
  ): Promise<ResultadoSimulacaoCheckinAtrasado> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdDoUsuario = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const regra = await gerenciador.getRepository(RegraAutomacaoOrm).findOne({
        where: { id: regraId, tenantId, ...(profissionalIdDoUsuario ? { profissionalId: profissionalIdDoUsuario } : {}) }
      });
      if (!regra) throw new NotFoundException('Regra de automacao nao encontrada.');
      if (!ehGatilhoCheckinAtrasado(regra.gatilho)) {
        throw new BadRequestException('Esta regra nao usa o gatilho de checkin atrasado.');
      }

      const configuracao = normalizarConfiguracaoCheckinAtrasado(regra.gatilho);
      const { candidatos, excluidos } = await this.selecionar(gerenciador, tenantId, regra, configuracao, agora);

      const repositorio = gerenciador.getRepository(ExecucaoRegraOrm);
      const execucao = await repositorio.save(
        repositorio.create({
          tenantId,
          regraId: regra.id,
          status: candidatos.length ? 'executado' : 'ignorado',
          resultado: {
            simulacao: true,
            executar: candidatos.length > 0,
            gatilho: GATILHO_CHECKIN_ATRASADO,
            configuracao: { ...configuracao },
            totalCandidatos: candidatos.length,
            candidatos: candidatos.map((candidato) => ({
              pacienteId: candidato.pacienteId,
              diasSemCheckin: candidato.diasSemCheckin,
              referenciaEm: candidato.referenciaEm.toISOString()
            })),
            excluidos,
            acoesPlanejadas: candidatos.length ? regra.acoes : []
          }
        })
      );

      return { execucao, configuracao, candidatos, excluidos };
    });
  }

  /**
   * Rodada real: percorre as regras de checkin atrasado ativas do tenant e
   * dispara a fundacao generica para cada candidato. Regra e paciente sao
   * isolados entre si -- uma falha pontual nao pode engolir o resto da
   * rodada diaria.
   */
  async processarRodada(tenantId: string, agora = new Date()): Promise<ResultadoProcessamentoCheckinAtrasado> {
    const regras = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(RegraAutomacaoOrm).find({ where: { tenantId, ativa: true } })
    );
    const regrasCheckin = regras.filter((regra) => ehGatilhoCheckinAtrasado(regra.gatilho));

    const resultado: ResultadoProcessamentoCheckinAtrasado = {
      regrasAvaliadas: regrasCheckin.length,
      pacientesDisparados: 0,
      pacientesIgnorados: 0,
      pacientesComErro: 0,
      regrasComErro: 0
    };
    if (!regrasCheckin.length) return resultado;

    for (const regra of regrasCheckin) {
      const configuracao = normalizarConfiguracaoCheckinAtrasado(regra.gatilho);
      let selecao;
      try {
        selecao = await this.executorTenant.executar(tenantId, (gerenciador) =>
          this.selecionar(gerenciador, tenantId, regra, configuracao, agora)
        );
      } catch (erro) {
        resultado.regrasComErro += 1;
        this.logger.error(
          `Falha ao selecionar candidatos de checkin atrasado da regra ${regra.id}: ${
            erro instanceof Error ? erro.message : 'erro desconhecido'
          }`
        );
        continue;
      }
      resultado.pacientesIgnorados += selecao.excluidos.length;

      for (const candidato of selecao.candidatos) {
        try {
          await this.dispararCandidato(tenantId, regra, candidato, agora);
          resultado.pacientesDisparados += 1;
        } catch (erro) {
          resultado.pacientesComErro += 1;
          this.logger.error(
            `Checkin atrasado da regra ${regra.id} nao pode ser disparado para o paciente ${candidato.pacienteId}: ${
              erro instanceof Error ? erro.message : 'erro desconhecido'
            }`
          );
        }
      }
    }

    return resultado;
  }

  private dispararCandidato(
    tenantId: string,
    regra: RegraAutomacaoOrm,
    candidato: CandidatoCheckinAtrasado,
    agora: Date
  ): Promise<unknown> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      dispararParaRegra(gerenciador, tenantId, regra, {
        tipo: GATILHO_CHECKIN_ATRASADO,
        pacienteId: candidato.pacienteId,
        origemTipo: 'checkin_atrasado_rodada',
        origemId: `${candidato.pacienteId}:${diaUtcChave(agora)}`,
        contexto: { evento: GATILHO_CHECKIN_ATRASADO }
      })
    );
  }

  private async selecionar(
    gerenciador: EntityManager,
    tenantId: string,
    regra: RegraAutomacaoOrm,
    configuracao: ConfiguracaoCheckinAtrasado,
    agora: Date
  ) {
    // Escopo duro: a regra so alcanca pacientes ativos (nao arquivados) do profissional dono dela.
    const pacientes = await gerenciador.getRepository(PacienteOrm).find({
      select: { id: true, ultimoCheckinEm: true, criadoEm: true },
      where: { tenantId, profissionalResponsavelId: regra.profissionalId, arquivadoEm: IsNull() }
    });
    if (!pacientes.length) return { candidatos: [], excluidos: [] };

    const pacienteIds = pacientes.map((paciente) => paciente.id);
    const ultimosDisparos = await this.mapearUltimoDisparo(gerenciador, tenantId, regra.id, pacienteIds);

    const entrada: PacienteParaCheckinAtrasado[] = pacientes.map((paciente) => ({
      pacienteId: paciente.id,
      ultimoCheckinEm: paciente.ultimoCheckinEm ?? null,
      criadoEm: paciente.criadoEm,
      ultimoDisparoEm: ultimosDisparos.get(paciente.id) ?? null
    }));

    return selecionarCandidatosCheckinAtrasado(entrada, configuracao, agora);
  }

  /**
   * Ultima vez que ESTA regra disparou para cada paciente, para respeitar
   * `intervaloMinimoDias`. Conta qualquer execucao ja criada (mesmo ainda
   * `pendente`, ainda nao processada pela fila) -- o que importa e que ja
   * disparamos recentemente, nao se a acao ja terminou. Simulacao nunca
   * conta: nao gasta o intervalo minimo.
   */
  private async mapearUltimoDisparo(
    gerenciador: EntityManager,
    tenantId: string,
    regraId: string,
    pacienteIds: string[]
  ): Promise<Map<string, Date>> {
    if (!pacienteIds.length) return new Map();

    const execucoes = await gerenciador.getRepository(ExecucaoRegraOrm).find({
      where: { tenantId, regraId, pacienteId: In(pacienteIds) },
      order: { criadoEm: 'DESC' }
    });

    const mapa = new Map<string, Date>();
    for (const execucao of execucoes) {
      if (execucao.resultado?.simulacao === true) continue;
      if (!execucao.pacienteId || mapa.has(execucao.pacienteId)) continue;
      mapa.set(execucao.pacienteId, execucao.criadoEm);
    }
    return mapa;
  }
}

/** Chave estavel do dia UTC, usada apenas como identificador opaco de origem. */
function diaUtcChave(data: Date): string {
  return data.toISOString().slice(0, 10);
}
