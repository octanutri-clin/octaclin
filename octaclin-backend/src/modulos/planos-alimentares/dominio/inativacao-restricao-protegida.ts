/**
 * FOOD06 PR-D (Q3, contrato v3): pré-condições da inativação de restrição.
 * Alergia e doença com restrição (celíaca) CONFIRMADAS são protegidas em qualquer gravidade (a gravidade nunca reduz a proteção).
 * Decisão do proprietário: NÃO exige reautenticação; exige motivo, justificativa e confirmação em dois passos na interface.
 * Domínio puro: não persiste, não audita (a auditoria imutável é da camada de aplicação) e não confere conselho profissional.
 */
export interface InativacaoAvaliada {
  protegida: boolean; permitida: boolean; exigeReautenticacao: false; invalidaPrevias: boolean; impressoesInvalidadas: string[];
}

export class InativacaoInvalidaError extends Error {
  constructor() { super('Pedido de inativação inválido.'); this.name = 'InativacaoInvalidaError'; }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
const SEM_CONTROLE = /^[^\p{C}]{0,1000}$/u;
const NATUREZAS = ['clinica', 'escolha', 'preferencia'];
const SUBTIPOS = ['alergia_alimentar', 'intolerancia_alimentar', 'doenca_ou_condicao_com_restricao', 'outra_restricao_clinica'];
const CONFIRMACOES = ['pendente', 'confirmada', 'rejeitada'];
const ESTADOS = ['ativa', 'em_reavaliacao', 'inativa'];
const GRAVIDADES = ['leve', 'moderada', 'grave', 'nao_informada'];
const LIMITE_IMPRESSOES = 500;

function invalida(): never { throw new InativacaoInvalidaError(); }
function simples(v: unknown, permitidas: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) ||
    Reflect.ownKeys(v).some(k => typeof k !== 'string' || !permitidas.includes(k))) return invalida();
  return v as Record<string, unknown>;
}

export function avaliarInativacao(entrada: unknown): InativacaoAvaliada {
  const o = simples(entrada, ['restricao', 'motivo', 'justificativa', 'confirmacaoEmDoisPassos', 'impressoesAfetadas']);
  const r = simples(o.restricao, ['id', 'revisao', 'natureza', 'subtipoClinico', 'confirmacao', 'estado', 'gravidade']);
  if (typeof r.id !== 'string' || !ID.test(r.id) || typeof r.revisao !== 'number' || !Number.isSafeInteger(r.revisao) || r.revisao < 1) return invalida();
  if (!NATUREZAS.includes(r.natureza as string) || !CONFIRMACOES.includes(r.confirmacao as string) || !ESTADOS.includes(r.estado as string)) return invalida();
  if (r.subtipoClinico !== undefined && !SUBTIPOS.includes(r.subtipoClinico as string)) return invalida();
  if (r.gravidade !== undefined && !GRAVIDADES.includes(r.gravidade as string)) return invalida();
  if ((r.natureza === 'clinica') !== (r.subtipoClinico !== undefined)) return invalida();
  if (typeof o.motivo !== 'string' || !SEM_CONTROLE.test(o.motivo) || typeof o.justificativa !== 'string' || !SEM_CONTROLE.test(o.justificativa)) return invalida();
  if (typeof o.confirmacaoEmDoisPassos !== 'boolean') return invalida();
  if (!Array.isArray(o.impressoesAfetadas) || o.impressoesAfetadas.length > LIMITE_IMPRESSOES || !o.impressoesAfetadas.every(i => typeof i === 'string' && ID.test(i))) return invalida();

  const protegida = r.confirmacao === 'confirmada' && r.estado !== 'inativa' &&
    (r.subtipoClinico === 'alergia_alimentar' || r.subtipoClinico === 'doenca_ou_condicao_com_restricao');
  const completo = o.motivo.trim() !== '' && o.justificativa.trim() !== '' && o.confirmacaoEmDoisPassos === true;
  const permitida = r.estado !== 'inativa' && completo;
  return {
    protegida, permitida, exigeReautenticacao: false, invalidaPrevias: permitida,
    impressoesInvalidadas: permitida ? [...new Set(o.impressoesAfetadas as string[])].sort() : []
  };
}
