/**
 * FOOD06 PR-D (D7-a, contrato v3): máquina de estados da solicitação de correção do paciente.
 * Domínio puro, sem I/O e sem texto: devolve chaves. O pedido NUNCA altera a restrição; só o profissional decide.
 */
export type EstadoSolicitacao = 'criada' | 'em_analise' | 'atendida' | 'recusada' | 'cancelada_pelo_paciente';
export type AcaoSolicitacao = 'iniciar_analise' | 'atender' | 'recusar' | 'cancelar';
export type AtorSolicitacao = 'paciente' | 'profissional';

export interface TransicaoSolicitacao { estado: EstadoSolicitacao; chaveTexto: string; alteraRestricao: false }

export class SolicitacaoInvalidaError extends Error {
  constructor() { super('Solicitação inválida.'); this.name = 'SolicitacaoInvalidaError'; }
}

const ESTADOS: readonly EstadoSolicitacao[] = ['criada', 'em_analise', 'atendida', 'recusada', 'cancelada_pelo_paciente'];
const ACOES: readonly AcaoSolicitacao[] = ['iniciar_analise', 'atender', 'recusar', 'cancelar'];
const ATORES: readonly AtorSolicitacao[] = ['paciente', 'profissional'];

const TABELA: Record<string, { para: EstadoSolicitacao; ator: AtorSolicitacao }> = {
  'criada:iniciar_analise': { para: 'em_analise', ator: 'profissional' },
  'criada:cancelar': { para: 'cancelada_pelo_paciente', ator: 'paciente' },
  'em_analise:atender': { para: 'atendida', ator: 'profissional' },
  'em_analise:recusar': { para: 'recusada', ator: 'profissional' },
  'em_analise:cancelar': { para: 'cancelada_pelo_paciente', ator: 'paciente' }
};

function invalida(): never { throw new SolicitacaoInvalidaError(); }

export function transicionarSolicitacao(entrada: unknown): TransicaoSolicitacao {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada) || ![Object.prototype, null].includes(Object.getPrototypeOf(entrada)) ||
    Reflect.ownKeys(entrada).some(k => typeof k !== 'string' || !['estado', 'acao', 'ator'].includes(k))) return invalida();
  const o = entrada as Record<string, unknown>;
  if (!ESTADOS.includes(o.estado as EstadoSolicitacao) || !ACOES.includes(o.acao as AcaoSolicitacao) || !ATORES.includes(o.ator as AtorSolicitacao)) return invalida();
  const t = TABELA[`${o.estado as string}:${o.acao as string}`];
  if (!t || t.ator !== o.ator) return invalida();
  return { estado: t.para, chaveTexto: `restricoes.solicitacao.${t.para === 'cancelada_pelo_paciente' ? 'cancelada' : t.para}`, alteraRestricao: false };
}
