/**
 * FOOD06 PR-D (Q10), alinhado à decisão D4 da PR #531: registro de reconfirmação (atestação do profissional).
 * Domínio puro. A referência OBRIGATÓRIA é a avaliação global e sua revisão exata; a restrição individual é opcional
 * e, quando informada, exige a sua revisão. Vence a AVALIAÇÃO, nunca a restrição: o resultado não altera restrição.
 *
 * - Só reconfirmação GLOBAL com resultado `sem_alteracao` ou `sem_restricoes_declaradas` renova a avaliação (180 dias).
 *   Reconfirmação individual nunca vale como reconfirmação global nem como ausência de restrições.
 * - Ausência de restrições exige escopo global e `confirmacaoExplicitaAusencia === true`.
 * - `pendencia_mantida` e `alteracao_informada` não renovam: mantêm a pendência sem declaração falsa.
 * - Não autoriza: a permissão clínica específica (Q6) e o mesmo contexto de tenant/paciente são da camada de
 *   aplicação e do banco (FKs compostas da 1083).
 */
export const PRAZO_RECONFIRMACAO_DIAS = 180 as const;
const DIA_MS = 86_400_000;

export type MeioReconfirmacao = 'presencial' | 'teleconsulta' | 'portal' | 'contato_documentado';
export type ResultadoReconfirmacao = 'sem_alteracao' | 'alteracao_informada' | 'sem_restricoes_declaradas' | 'pendencia_mantida';

export interface ReconfirmacaoRegistrada {
  pacienteId: string; avaliacaoId: string; revisaoAvaliacao: number; restricaoId?: string; revisaoRestricao?: number;
  atestadoPor: string; atestadoEm: string; meio: MeioReconfirmacao; resultado: ResultadoReconfirmacao;
  escopo: 'avaliacao_global' | 'restricao_individual'; renovaAvaliacao: boolean; venceEm?: string;
  declaraAusenciaRestricoes: boolean; alteraRestricao: false;
}

export class ReconfirmacaoInvalidaError extends Error {
  constructor() { super('Reconfirmação inválida.'); this.name = 'ReconfirmacaoInvalidaError'; }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
const MEIOS: readonly string[] = ['presencial', 'teleconsulta', 'portal', 'contato_documentado'];
const RESULTADOS: readonly string[] = ['sem_alteracao', 'alteracao_informada', 'sem_restricoes_declaradas', 'pendencia_mantida'];
const CHAVES = ['agora', 'pacienteId', 'avaliacaoId', 'revisaoAvaliacao', 'restricao', 'atestadoPor', 'meio', 'resultado', 'atestacao', 'confirmacaoExplicitaAusencia'];

function invalida(): never { throw new ReconfirmacaoInvalidaError(); }
function simples(v: unknown, permitidas: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) ||
    Reflect.ownKeys(v).some(k => typeof k !== 'string' || !permitidas.includes(k))) return invalida();
  return v as Record<string, unknown>;
}
const id = (v: unknown): string => (typeof v === 'string' && ID.test(v) ? v : invalida());
const revisao = (v: unknown): number => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 ? v : invalida());

export function registrarReconfirmacao(entrada: unknown): ReconfirmacaoRegistrada {
  const o = simples(entrada, CHAVES);
  const { agora, atestacao, confirmacaoExplicitaAusencia } = o;
  if (typeof agora !== 'string' || !Number.isFinite(Date.parse(agora)) || new Date(agora).toISOString() !== agora) return invalida();
  if (atestacao !== true) return invalida();
  if (typeof o.meio !== 'string' || !MEIOS.includes(o.meio) || typeof o.resultado !== 'string' || !RESULTADOS.includes(o.resultado)) return invalida();
  const meio = o.meio as MeioReconfirmacao, resultado = o.resultado as ResultadoReconfirmacao;
  const base = { pacienteId: id(o.pacienteId), avaliacaoId: id(o.avaliacaoId), revisaoAvaliacao: revisao(o.revisaoAvaliacao), atestadoPor: id(o.atestadoPor) };

  let individual: { restricaoId: string; revisaoRestricao: number } | undefined;
  if (o.restricao !== undefined) {
    const r = simples(o.restricao, ['id', 'revisao']);
    individual = { restricaoId: id(r.id), revisaoRestricao: revisao(r.revisao) };
  }
  const ausencia = resultado === 'sem_restricoes_declaradas';
  if (confirmacaoExplicitaAusencia !== undefined && (!ausencia || typeof confirmacaoExplicitaAusencia !== 'boolean')) return invalida();
  if (ausencia && (individual || confirmacaoExplicitaAusencia !== true)) return invalida();

  const renovaAvaliacao = !individual && (resultado === 'sem_alteracao' || ausencia);
  return {
    ...base, ...(individual ?? {}), atestadoEm: agora, meio, resultado,
    escopo: individual ? 'restricao_individual' : 'avaliacao_global', renovaAvaliacao,
    ...(renovaAvaliacao ? { venceEm: new Date(Date.parse(agora) + PRAZO_RECONFIRMACAO_DIAS * DIA_MS).toISOString() } : {}),
    declaraAusenciaRestricoes: ausencia, alteraRestricao: false
  };
}
