import { DocumentoEdicaoPlano, numeroEdicao } from './edicao-plano';
import { ComposicaoPersonalizada, normalizarComposicaoPersonalizada } from './alimentos-personalizados';
export interface IntencaoAlimentoPersonalizado { id: string; revisao: number; aplicacaoId: string }
export interface ContextoAlimentoPersonalizado extends IntencaoAlimentoPersonalizado {
  composicao: ComposicaoPersonalizada; quantidade?: number; unidade?: string; porcaoGramas?: number;
}
export type ContextosAlimentosPersonalizados = Record<string, ContextoAlimentoPersonalizado>;
export class ReferenciaCustomConflitanteError extends Error { constructor() { super('Alimento alterado: confira e aplique a referência explicitamente.'); } }
function* alimentos(d: DocumentoEdicaoPlano) { for (const r of d.refeicoes) for (const i of r.itens) { yield i; for (const s of i.substituicoes ?? []) yield s; } }
function mesmosNumeros(a: Record<string, any> | undefined, b: Record<string, number | undefined>) {
  return [...new Set([...Object.keys(a ?? {}), ...Object.keys(b)])].every(k => numeroEdicao(a?.[k]) === b[k]);
}
export function validarContextosCustom(valor: unknown): ContextosAlimentosPersonalizados {
  const s = valor as any;
  if (s?.schemaVersao !== 1 || !s.contextos || typeof s.contextos !== 'object' || Array.isArray(s.contextos) || Object.keys(s.contextos).length > 10000) throw new Error('Snapshot custom inválido.');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (const c of Object.values(s.contextos) as ContextoAlimentoPersonalizado[]) {
    if (!c || !uuid.test(c.id) || !uuid.test(c.aplicacaoId) || !Number.isInteger(c.revisao) || c.revisao < 1 || c.revisao > 2147483647) throw new Error('Referência custom inválida.');
    const v = c.composicao;
    const reconstruida = normalizarComposicaoPersonalizada({ nome: v?.nome, ...(v?.preparacao ? { preparacao: v.preparacao } : {}), ...(v?.referenciaComposicao ? { referenciaComposicao: v.referenciaComposicao } : {}), base: v?.baseOrigem, ...v?.composicaoOrigem });
    if (JSON.stringify(reconstruida) !== JSON.stringify(v)) throw new Error('Composição custom inválida.');
    if ((c.quantidade !== undefined && !Number.isFinite(c.quantidade)) || (c.porcaoGramas !== undefined && !Number.isFinite(c.porcaoGramas)) || (c.unidade !== undefined && (typeof c.unidade !== 'string' || c.unidade.length > 40))) throw new Error('Fatos custom inválidos.');
  }
  return s.contextos;
}
export async function resolverAlimentosPersonalizados(
  documento: DocumentoEdicaoPlano, anteriores: ContextosAlimentosPersonalizados,
  resolver: (ref: { id: string; revisao: number }) => Promise<{ id: string; revisao: number; composicao: ComposicaoPersonalizada }>
): Promise<ContextosAlimentosPersonalizados> {
  const atuais: ContextosAlimentosPersonalizados = Object.create(null);
  for (const a of alimentos(documento)) {
    const anterior = Object.hasOwn(anteriores, a.chaveCliente) ? anteriores[a.chaveCliente] : undefined;
    if (a.alimentoPersonalizado === undefined && anterior) {
      if (a.alimentoComposicaoId || a.descricao !== anterior.composicao.nome || !mesmosNumeros(a.nutrientesPor100g, anterior.composicao.nutrientesPor100g) || !mesmosNumeros(a.micronutrientesPor100g, anterior.composicao.micronutrientesPor100g) || numeroEdicao(a.quantidade) !== anterior.quantidade || a.unidade !== anterior.unidade || numeroEdicao(a.porcaoGramas) !== anterior.porcaoGramas) throw new ReferenciaCustomConflitanteError();
      a.alimentoPersonalizado = { id: anterior.id, revisao: anterior.revisao, aplicacaoId: anterior.aplicacaoId };
    }
    const ref = a.alimentoPersonalizado;
    if (!ref) continue;
    if (a.alimentoComposicaoId) throw new ReferenciaCustomConflitanteError();
    const preservar = anterior && anterior.id === ref.id && anterior.revisao === ref.revisao && anterior.aplicacaoId === ref.aplicacaoId;
    const composicao = preservar ? anterior.composicao : (await resolver(ref)).composicao;
    a.descricao = composicao.nome;
    a.nutrientesPor100g = { ...composicao.nutrientesPor100g };
    a.micronutrientesPor100g = { ...composicao.micronutrientesPor100g };
    a.fonteRotulo = 'Alimento personalizado';
    atuais[a.chaveCliente] = { ...ref, composicao };
  }
  capturarFatosCustom(documento, atuais);
  return atuais;
}
/** Capturar novamente depois de resolver medidas, que podem alterar unidade/peso. */
export function capturarFatosCustom(documento: DocumentoEdicaoPlano, contextos: ContextosAlimentosPersonalizados): void {
  for (const a of alimentos(documento)) if (Object.hasOwn(contextos, a.chaveCliente)) Object.assign(contextos[a.chaveCliente], { quantidade: numeroEdicao(a.quantidade), unidade: a.unidade, porcaoGramas: numeroEdicao(a.porcaoGramas) });
}
