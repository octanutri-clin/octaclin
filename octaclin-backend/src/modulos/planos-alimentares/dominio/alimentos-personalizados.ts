import { CodigoMicronutriente, decimalParaEscala8, MicronutrientesPor100gEntrada, normalizarNutrientePor100g, validarMicronutrientesManuais } from './micronutrientes';
export const NORMALIZACAO_CUSTOM = 'octaclin-custom-v1' as const;
export const CAMPOS_COMPOSICAO_CUSTOM = ['nome', 'preparacao', 'referenciaComposicao', 'base', 'nutrientes', 'micronutrientes'] as const;
const MACROS = ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG', 'fibrasG', 'sodioMg'] as const;
export type NutrientesPersonalizados = Partial<Record<typeof MACROS[number], number>>;
export interface BaseComposicaoPersonalizada { tipo: 'por100g' | 'porcao'; pesoGramas?: number }
export interface ConteudoAlimentoPersonalizado {
  nome: string; preparacao?: string; referenciaComposicao?: string;
  base: BaseComposicaoPersonalizada; nutrientes: NutrientesPersonalizados; micronutrientes?: MicronutrientesPor100gEntrada;
}
export interface ComposicaoPersonalizada {
  nome: string; preparacao?: string; referenciaComposicao?: string;
  baseOrigem: { tipo: 'por100g' | 'porcao'; pesoGramas: number };
  composicaoOrigem: { nutrientes: NutrientesPersonalizados; micronutrientes: MicronutrientesPor100gEntrada };
  nutrientesPor100g: NutrientesPersonalizados; micronutrientesPor100g: MicronutrientesPor100gEntrada;
  disponivelParaCalculo: boolean; normalizacaoVersao: typeof NORMALIZACAO_CUSTOM;
}
function objeto(v: unknown, campos: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Object.keys(v).some(k => !campos.includes(k))) throw new Error('Composição inválida.');
  return v as Record<string, unknown>;
}
function texto(v: unknown, limite: number, obrigatorio = false): string | undefined {
  if (v === undefined && !obrigatorio) return undefined;
  if (typeof v !== 'string' || v.trim().length > limite || (obrigatorio && !v.trim())) throw new Error('Descrição inválida.');
  return v.trim() || undefined;
}
export function selecionarConteudoPersonalizado(v: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(CAMPOS_COMPOSICAO_CUSTOM.filter(k => v[k] !== undefined).map(k => [k, v[k]]));
}
export function normalizarComposicaoPersonalizada(entrada: unknown): ComposicaoPersonalizada {
  const v = objeto(entrada, CAMPOS_COMPOSICAO_CUSTOM);
  const nome = texto(v.nome, 240, true)!;
  const preparacao = texto(v.preparacao, 180), referenciaComposicao = texto(v.referenciaComposicao, 240);
  const base = objeto(v.base, ['tipo', 'pesoGramas']);
  if (base.tipo !== 'por100g' && base.tipo !== 'porcao') throw new Error('Base inválida.');
  if (base.tipo === 'por100g' && base.pesoGramas !== undefined && base.pesoGramas !== 100) throw new Error('Base ambígua.');
  const peso = base.tipo === 'por100g' ? 100 : base.pesoGramas;
  if (typeof peso !== 'number' || !Number.isFinite(peso) || peso < 0.001 || peso > 10000 || Number(decimalParaEscala8(peso) / 100000n) / 1000 !== peso) throw new Error('Base inválida.');
  const macros = objeto(v.nutrientes, MACROS);
  const nutrientes: NutrientesPersonalizados = {};
  for (const campo of MACROS) if (Object.hasOwn(macros, campo)) {
    const n = macros[campo];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new Error('Nutriente inválido.');
    decimalParaEscala8(n);
    nutrientes[campo] = n;
  }
  const micronutrientes = v.micronutrientes === undefined ? {} : validarMicronutrientesManuais(v.micronutrientes);
  return { nome, ...(preparacao ? { preparacao } : {}), ...(referenciaComposicao ? { referenciaComposicao } : {}),
    baseOrigem: { tipo: base.tipo, pesoGramas: peso }, composicaoOrigem: { nutrientes, micronutrientes },
    nutrientesPor100g: Object.fromEntries(Object.entries(nutrientes).map(([k, n]) => [k, normalizarNutrientePor100g(n, peso)])),
    micronutrientesPor100g: Object.fromEntries(Object.entries(micronutrientes).map(([k, n]) => [k as CodigoMicronutriente, normalizarNutrientePor100g(n, peso)])),
    disponivelParaCalculo: MACROS.slice(0, 4).every(k => nutrientes[k] !== undefined), normalizacaoVersao: NORMALIZACAO_CUSTOM };
}

/** Leitor canônico compartilhado; valida conteúdo já autenticado pela cifra. */
export function validarSnapshotPersonalizado(valor: unknown): ComposicaoPersonalizada {
  const s = valor as { schemaVersao?: number; composicao?: ComposicaoPersonalizada };
  const c = s?.composicao;
  if (s?.schemaVersao !== 1 || c?.normalizacaoVersao !== NORMALIZACAO_CUSTOM) throw new Error('Snapshot custom inválido.');
  const r = normalizarComposicaoPersonalizada({ nome:c.nome,...(c.preparacao?{preparacao:c.preparacao}:{}),...(c.referenciaComposicao?{referenciaComposicao:c.referenciaComposicao}:{}),base:c.baseOrigem,...c.composicaoOrigem });
  if(JSON.stringify(r)!==JSON.stringify(c)) throw new Error('Composição custom inválida.');
  return r;
}
