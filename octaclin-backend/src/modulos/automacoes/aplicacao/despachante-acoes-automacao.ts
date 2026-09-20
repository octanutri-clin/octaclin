import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarNotificacao } from '../../notificacoes/aplicacao/registrar-notificacao';
import { ServicoComunicacoes } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import { AcompanhamentoTarefaOrm } from '../../pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { AcaoAutomacao, TipoAcaoAutomacao } from '../dominio/acoes-automacao';
import { identificadorDeterministico } from '../dominio/identificador-deterministico';

export interface EntradaExecucaoAcaoAutomacao {
  tenantId: string;
  execucaoId: string;
  regraId: string;
  profissionalId: string;
  pacienteId?: string;
  contexto: Record<string, unknown>;
  acao: AcaoAutomacao;
  chaveIdempotencia: string;
}

export interface SaidaExecucaoAcaoAutomacao {
  status: 'executada' | 'ignorada';
}

export abstract class FalhaDefinitivaAcaoAutomacao extends Error {
  readonly retriavel = false;

  protected constructor(readonly codigo: string, mensagem: string) {
    super(mensagem);
    this.name = 'FalhaDefinitivaAcaoAutomacao';
  }
}

export class AcaoAutomacaoNaoDisponivel extends FalhaDefinitivaAcaoAutomacao {
  constructor(readonly tipo: TipoAcaoAutomacao) {
    super('acao_nao_disponivel', 'Acao de automacao ainda nao habilitada.');
    this.name = 'AcaoAutomacaoNaoDisponivel';
  }
}

export class DestinoAcaoAutomacaoInvalido extends FalhaDefinitivaAcaoAutomacao {
  constructor(codigo: 'paciente_obrigatorio' | 'destino_indisponivel') {
    super(
      codigo,
      codigo === 'paciente_obrigatorio'
        ? 'A acao exige um paciente.'
        : 'O destino da acao nao esta mais disponivel.'
    );
    this.name = 'DestinoAcaoAutomacaoInvalido';
  }
}

/**
 * Fronteira unica para os efeitos das regras genericas. Os incrementos 266.2 a
 * 266.4 conectam implementacoes idempotentes aqui, um tipo por vez. Ate la, a
 * execucao falha de forma explicita em vez de registrar um efeito inexistente.
 */
@Injectable()
export class DespachanteAcoesAutomacao {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly comunicacoes: ServicoComunicacoes
  ) {}

  async executar(entrada: EntradaExecucaoAcaoAutomacao): Promise<SaidaExecucaoAcaoAutomacao> {
    if (entrada.acao.tipo === 'notificar_profissional') {
      return this.executorTenant.executar(entrada.tenantId, async (gerenciador) => {
        await registrarNotificacao(gerenciador, entrada.tenantId, {
          tipo: 'automacao_executada',
          recursoTipo: 'execucao_automacao',
          recursoId: identificadorDeterministico('notificacao-automacao', entrada.chaveIdempotencia),
          pacienteId: entrada.pacienteId,
          profissionalId: entrada.profissionalId
        });
        return { status: 'executada' };
      });
    }

    if (entrada.acao.tipo === 'criar_tarefa') {
      const acao = entrada.acao;
      if (!entrada.pacienteId) throw new DestinoAcaoAutomacaoInvalido('paciente_obrigatorio');
      const tarefaId = identificadorDeterministico('tarefa-automacao', entrada.chaveIdempotencia);

      return this.executorTenant.executar(entrada.tenantId, async (gerenciador) => {
        const repositorioTarefas = gerenciador.getRepository(AcompanhamentoTarefaOrm);
        const existente = await repositorioTarefas.findOne({
          select: { id: true },
          where: { id: tarefaId, tenantId: entrada.tenantId }
        });
        if (existente) return { status: 'executada' };

        const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
          select: { id: true },
          where: { id: entrada.pacienteId, tenantId: entrada.tenantId }
        });
        const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
          select: { id: true, usuarioId: true },
          where: { id: entrada.profissionalId, tenantId: entrada.tenantId, arquivadoEm: IsNull() }
        });
        const usuario = profissional
          ? await gerenciador.getRepository(UsuarioOrm).findOne({
              select: { id: true },
              where: { id: profissional.usuarioId, tenantId: entrada.tenantId, ativo: true }
            })
          : null;
        if (!paciente || !profissional || !usuario) {
          throw new DestinoAcaoAutomacaoInvalido('destino_indisponivel');
        }

        const vencimentoEm = new Date(Date.now() + acao.prazoDias * 24 * 60 * 60 * 1000);
        await repositorioTarefas
          .createQueryBuilder()
          .insert()
          .into(AcompanhamentoTarefaOrm)
          .values({
            id: tarefaId,
            tenantId: entrada.tenantId,
            pacienteId: entrada.pacienteId,
            profissionalId: usuario.id,
            tituloCriptografado: this.criptografia.criptografar(acao.titulo),
            categoria: 'tarefa',
            prioridade: acao.prioridade,
            status: 'pendente',
            vencimentoEm
          })
          .orIgnore()
          .execute();

        return { status: 'executada' };
      });
    }

    if (entrada.acao.tipo === 'enviar_template') {
      if (!('canalId' in entrada.acao)) {
        throw new AcaoAutomacaoNaoDisponivel('enviar_template');
      }
      if (!entrada.pacienteId) throw new DestinoAcaoAutomacaoInvalido('paciente_obrigatorio');
      const resultado = await this.comunicacoes.enfileirarMensagemAutomacao(entrada.tenantId, {
        pacienteId: entrada.pacienteId,
        canalId: entrada.acao.canalId,
        templateId: entrada.acao.templateId,
        intervaloMinimoHoras: entrada.acao.intervaloMinimoHoras,
        chaveIdempotencia: entrada.chaveIdempotencia
      });
      if (resultado.status === 'ignorada') return { status: 'ignorada' };
      if (resultado.status === 'indisponivel') {
        throw new DestinoAcaoAutomacaoInvalido('destino_indisponivel');
      }

      try {
        await this.comunicacoes.publicarEventoNotificacao(entrada.tenantId, resultado.mensagemId);
      } catch {
        // Mensagem e outbox ja foram confirmados na mesma transacao. A fila e
        // apenas o atalho; o poller duravel assume quando Redis falha.
      }
      return { status: 'executada' };
    }

    throw new AcaoAutomacaoNaoDisponivel((entrada.acao as { tipo: TipoAcaoAutomacao }).tipo);
  }
}
