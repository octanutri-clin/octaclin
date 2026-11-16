import { ESTADOS_SOLICITACAO, type EstadoSolicitacao } from './solicitacao-restricao-paciente';

/**
 * FOOD06 P2c (D7-a, Q11): o que o PORTAL pode mostrar de um pedido do paciente. Domínio puro e por allowlist:
 * só id, tipo, chave de texto, datas e a explicação ao paciente. Nunca o estado interno, a justificativa interna,
 * autores, ids de restrição, revisões ou o desfecho. Os textos correspondentes às chaves são da P3 (contrato v3, D7-a).
 * As rotas do portal dependem do vínculo de representação (P2d).
 */
const CHAVE_POR_ESTADO: Readonly<Record<EstadoSolicitacao, string>> = Object.freeze({
  criada: 'restricoes.solicitacao.enviada',
  em_analise: 'restricoes.solicitacao.analisando',
  atendida: 'restricoes.solicitacao.atendida',
  parcial: 'restricoes.solicitacao.parcial',
  recusada: 'restricoes.solicitacao.recusada',
  cancelada_pelo_paciente: 'restricoes.solicitacao.cancelada'
});
export const CHAVES_TEXTO_PORTAL_SOLICITACAO: readonly string[] = Object.freeze(Object.values(CHAVE_POR_ESTADO));

export interface SolicitacaoPortal { id: string; tipo: 'inclusao' | 'correcao' | 'remocao'; chaveTexto: string; criadoEm: string; decididoEm?: string; explicacao?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
function indisponivel(): never { throw new Error('Projeção indisponível.'); }

export function projetarSolicitacaoPortal(entrada: { id: unknown; tipo: unknown; estado: unknown; criadoEm: unknown; decididoEm?: unknown; explicacaoPaciente?: unknown }): SolicitacaoPortal {
  if (!entrada || typeof entrada !== 'object') return indisponivel();
  const { id, tipo, estado, criadoEm, decididoEm, explicacaoPaciente } = entrada;
  if (typeof id !== 'string' || !UUID.test(id) || !['inclusao', 'correcao', 'remocao'].includes(tipo as string) ||
    !(ESTADOS_SOLICITACAO as readonly unknown[]).includes(estado) || !ISO(criadoEm)) return indisponivel();
  const base = { id, tipo: tipo as SolicitacaoPortal['tipo'], chaveTexto: CHAVE_POR_ESTADO[estado as EstadoSolicitacao], criadoEm };
  if (!['atendida', 'parcial', 'recusada'].includes(estado as string)) return base;
  // Decisão sem explicação ao paciente nunca é mostrada (a 1083 também exige a explicação no banco).
  if (!ISO(decididoEm) || typeof explicacaoPaciente !== 'string' || explicacaoPaciente.trim() === '') return indisponivel();
  return { ...base, decididoEm, explicacao: explicacaoPaciente };
}
