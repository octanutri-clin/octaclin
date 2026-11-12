/**
 * FOOD06 PR-D (Q10): registro de reconfirmação de restrições (atestação do profissional).
 * Domínio puro. Vence a AVALIAÇÃO, nunca a restrição: o resultado não altera a restrição nem sua revisão.
 */
export const PRAZO_RECONFIRMACAO_DIAS = 180 as const;
const DIA_MS = 86_400_000;

export interface ReconfirmacaoRegistrada {
  restricaoId: string; revisaoRestricao: number; atestadoPor: string; atestadoEm: string; venceEm: string; alteraRestricao: false;
}

export class ReconfirmacaoInvalidaError extends Error {
  constructor() { super('Reconfirmação inválida.'); this.name = 'ReconfirmacaoInvalidaError'; }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
function invalida(): never { throw new ReconfirmacaoInvalidaError(); }

export function registrarReconfirmacao(entrada: unknown): ReconfirmacaoRegistrada {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada) || ![Object.prototype, null].includes(Object.getPrototypeOf(entrada)) ||
    Reflect.ownKeys(entrada).some(k => typeof k !== 'string' || !['agora', 'restricaoId', 'revisaoRestricao', 'atestadoPor', 'atestacao'].includes(k))) return invalida();
  const o = entrada as Record<string, unknown>;
  const { agora, restricaoId, revisaoRestricao, atestadoPor, atestacao } = o;
  if (typeof agora !== 'string' || !Number.isFinite(Date.parse(agora)) || new Date(agora).toISOString() !== agora) return invalida();
  if (typeof restricaoId !== 'string' || !ID.test(restricaoId) || typeof atestadoPor !== 'string' || !ID.test(atestadoPor)) return invalida();
  if (typeof revisaoRestricao !== 'number' || !Number.isSafeInteger(revisaoRestricao) || revisaoRestricao < 1) return invalida();
  if (atestacao !== true) return invalida();
  return {
    restricaoId, revisaoRestricao, atestadoPor, atestadoEm: agora,
    venceEm: new Date(Date.parse(agora) + PRAZO_RECONFIRMACAO_DIAS * DIA_MS).toISOString(), alteraRestricao: false
  };
}
