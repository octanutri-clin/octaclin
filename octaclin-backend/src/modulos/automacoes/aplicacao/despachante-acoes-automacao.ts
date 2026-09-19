import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { registrarNotificacao } from '../../notificacoes/aplicacao/registrar-notificacao';
import { AcaoAutomacao, TipoAcaoAutomacao } from '../dominio/acoes-automacao';

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

export class AcaoAutomacaoNaoDisponivel extends Error {
  readonly codigo = 'acao_nao_disponivel';
  readonly retriavel = false;

  constructor(readonly tipo: TipoAcaoAutomacao) {
    super('Acao de automacao ainda nao habilitada.');
    this.name = 'AcaoAutomacaoNaoDisponivel';
  }
}

/**
 * Fronteira unica para os efeitos das regras genericas. Os incrementos 266.2 a
 * 266.4 conectam implementacoes idempotentes aqui, um tipo por vez. Ate la, a
 * execucao falha de forma explicita em vez de registrar um efeito inexistente.
 */
@Injectable()
export class DespachanteAcoesAutomacao {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async executar(entrada: EntradaExecucaoAcaoAutomacao): Promise<SaidaExecucaoAcaoAutomacao> {
    if (entrada.acao.tipo !== 'notificar_profissional') {
      throw new AcaoAutomacaoNaoDisponivel(entrada.acao.tipo);
    }

    return this.executorTenant.executar(entrada.tenantId, async (gerenciador) => {
      await registrarNotificacao(gerenciador, entrada.tenantId, {
        tipo: 'automacao_executada',
        recursoTipo: 'execucao_automacao',
        recursoId: identificadorNotificacao(entrada.chaveIdempotencia),
        pacienteId: entrada.pacienteId,
        profissionalId: entrada.profissionalId
      });
      return { status: 'executada' };
    });
  }
}

/**
 * O indice unico de notificacoes usa `recurso_id` (uuid). A chave da acao e
 * estavel, mas textual; este UUID v8 deterministico conserva a idempotencia por
 * execucao/indice sem persistir a chave interna nem adicionar payload livre.
 */
function identificadorNotificacao(chaveIdempotencia: string): string {
  const bytes = createHash('sha256')
    .update(`octaclin:notificacao-automacao:${chaveIdempotencia}`, 'utf8')
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hexadecimal = bytes.toString('hex');
  return `${hexadecimal.slice(0, 8)}-${hexadecimal.slice(8, 12)}-${hexadecimal.slice(12, 16)}-${hexadecimal.slice(16, 20)}-${hexadecimal.slice(20)}`;
}
