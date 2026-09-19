import { Injectable } from '@nestjs/common';
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
  async executar(entrada: EntradaExecucaoAcaoAutomacao): Promise<SaidaExecucaoAcaoAutomacao> {
    throw new AcaoAutomacaoNaoDisponivel(entrada.acao.tipo);
  }
}
