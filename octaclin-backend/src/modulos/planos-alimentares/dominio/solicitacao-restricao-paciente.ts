/**
 * FOOD06 PR-D (D7-a, contrato v3), com a decisão D1 da PR #531: máquina de estados da solicitação de correção do
 * paciente. Domínio puro, sem I/O e sem texto: devolve chaves. O pedido NUNCA altera a restrição; só a operação
 * clínica autorizada do profissional altera, e o desfecho apenas registra o que essa operação mudou e o que não mudou.
 * Os estados abaixo são os mesmos do `check` da migration 1083.
 */
export const ESTADOS_SOLICITACAO = ['criada', 'em_analise', 'atendida', 'parcial', 'recusada', 'cancelada_pelo_paciente'] as const;
export const ESTADOS_FINAIS_SOLICITACAO = ['atendida', 'parcial', 'recusada', 'cancelada_pelo_paciente'] as const;
export type EstadoSolicitacao = typeof ESTADOS_SOLICITACAO[number];
export type AcaoSolicitacao = 'iniciar_analise' | 'atender' | 'atender_parcialmente' | 'recusar' | 'cancelar';
export type AtorSolicitacao = 'paciente' | 'profissional';

export interface TransicaoSolicitacao { estado: EstadoSolicitacao; chaveTexto: string; alteraRestricao: false }

/** Item do pedido efetivamente alterado, sempre ligado à revisão da restrição gerada pela operação clínica autorizada. */
export interface ItemAlterado { item: string; restricaoId: string; revisaoResultante: number }
export interface DesfechoSolicitacao {
  estadoFinal: 'atendida' | 'parcial' | 'recusada'; alterados: ItemAlterado[]; inalterados: string[]; alteraRestricao: false;
}

export class SolicitacaoInvalidaError extends Error {
  constructor() { super('Solicitação inválida.'); this.name = 'SolicitacaoInvalidaError'; }
}

const ACOES: readonly AcaoSolicitacao[] = ['iniciar_analise', 'atender', 'atender_parcialmente', 'recusar', 'cancelar'];
const ATORES: readonly AtorSolicitacao[] = ['paciente', 'profissional'];
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
const LIMITE_ITENS = 200;

const TABELA: Record<string, { para: EstadoSolicitacao; ator: AtorSolicitacao }> = {
  'criada:iniciar_analise': { para: 'em_analise', ator: 'profissional' },
  'criada:cancelar': { para: 'cancelada_pelo_paciente', ator: 'paciente' },
  'em_analise:atender': { para: 'atendida', ator: 'profissional' },
  'em_analise:atender_parcialmente': { para: 'parcial', ator: 'profissional' },
  'em_analise:recusar': { para: 'recusada', ator: 'profissional' },
  'em_analise:cancelar': { para: 'cancelada_pelo_paciente', ator: 'paciente' }
};

function invalida(): never { throw new SolicitacaoInvalidaError(); }
function simples(v: unknown, permitidas: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) ||
    Reflect.ownKeys(v).some(k => typeof k !== 'string' || !permitidas.includes(k))) return invalida();
  return v as Record<string, unknown>;
}

export function transicionarSolicitacao(entrada: unknown): TransicaoSolicitacao {
  const o = simples(entrada, ['estado', 'acao', 'ator']);
  if (!(ESTADOS_SOLICITACAO as readonly unknown[]).includes(o.estado) || !ACOES.includes(o.acao as AcaoSolicitacao) ||
    !ATORES.includes(o.ator as AtorSolicitacao)) return invalida();
  const t = TABELA[`${o.estado as string}:${o.acao as string}`];
  if (!t || t.ator !== o.ator) return invalida();
  return { estado: t.para, chaveTexto: `restricoes.solicitacao.${t.para === 'cancelada_pelo_paciente' ? 'cancelada' : t.para}`, alteraRestricao: false };
}

/**
 * Desfecho de uma solicitação decidida pelo profissional. `parcial` exige ao menos um item alterado e um inalterado;
 * `atendida`, só alterados; `recusada`, só inalterados. Itens são chaves do pedido, sem conteúdo clínico.
 */
export function validarDesfechoSolicitacao(entrada: unknown): DesfechoSolicitacao {
  const o = simples(entrada, ['estadoFinal', 'alterados', 'inalterados']);
  if (!['atendida', 'parcial', 'recusada'].includes(o.estadoFinal as string)) return invalida();
  if (!Array.isArray(o.alterados) || !Array.isArray(o.inalterados) || o.alterados.length + o.inalterados.length > LIMITE_ITENS) return invalida();
  const alterados = o.alterados.map(a => {
    const x = simples(a, ['item', 'restricaoId', 'revisaoResultante']);
    if (typeof x.item !== 'string' || !ID.test(x.item) || typeof x.restricaoId !== 'string' || !ID.test(x.restricaoId) ||
      typeof x.revisaoResultante !== 'number' || !Number.isSafeInteger(x.revisaoResultante) || x.revisaoResultante < 1) return invalida();
    return { item: x.item, restricaoId: x.restricaoId, revisaoResultante: x.revisaoResultante };
  });
  const inalterados = o.inalterados.map(i => (typeof i === 'string' && ID.test(i) ? i : invalida()));
  const itens = [...alterados.map(a => a.item), ...inalterados];
  if (new Set(itens).size !== itens.length) return invalida();
  const estadoFinal = o.estadoFinal as DesfechoSolicitacao['estadoFinal'];
  const ok = estadoFinal === 'parcial' ? alterados.length > 0 && inalterados.length > 0
    : estadoFinal === 'atendida' ? alterados.length > 0 && inalterados.length === 0
      : alterados.length === 0 && inalterados.length > 0;
  if (!ok) return invalida();
  return {
    estadoFinal, alterados: alterados.sort((a, b) => (a.item < b.item ? -1 : 1)), inalterados: inalterados.sort(), alteraRestricao: false
  };
}
