import type { ComposicaoPersonalizada, NutrientesPersonalizados } from './alimentos-personalizados';
import type { MicronutrientesPor100gEntrada } from './micronutrientes';
export interface EntradaGrupo {
  id: string; origem: 'catalogo' | 'custom'; alimentoId: string; revisao?: number;
  quantidade: number; unidade: string; porcaoGramas: number;
}
export interface ConteudoGrupo { nome: string; descricao?: string; categoria?: string; etiquetas: string[]; entradas: EntradaGrupo[] }
export interface ComposicaoEntradaGrupo {
  descricao: string; nutrientesPor100g: NutrientesPersonalizados; micronutrientesPor100g?: MicronutrientesPor100gEntrada;
  fonte?: { codigo: string; versao: string; hashConteudo: string }; composicaoCustom?: ComposicaoPersonalizada;
}
export interface EntradaGrupoSnapshot extends EntradaGrupo { composicao: ComposicaoEntradaGrupo }
export interface SnapshotGrupo extends Omit<ConteudoGrupo, 'entradas'> {
  schemaVersao: 1; entradas: EntradaGrupoSnapshot[]; origemCopia?: { grupoId: string; revisao: number };
}
export const UUID_GRUPO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function objetoGrupo(v: unknown, campos: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Object.keys(v).some(k => !campos.includes(k))) throw new Error('Grupo inválido.');
  return v as Record<string, unknown>;
}
function texto(v: unknown, max: number, obrigatorio = false): string | undefined {
  if (v === undefined && !obrigatorio) return undefined;
  if (typeof v !== 'string' || v.trim().length > max || (obrigatorio && !v.trim())) throw new Error('Texto do grupo inválido.');
  return v.trim() || undefined;
}
export function porcaoGrupoValida(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0.001 && v <= 10000 && Number(v.toFixed(3)) === v;
}
export function identidadeEntradaGrupo(e: Pick<EntradaGrupo, 'origem' | 'alimentoId'>): string { return `${e.origem}:${e.alimentoId.toLowerCase()}`; }
export function validarConteudoGrupo(v: unknown): ConteudoGrupo {
  const c = objetoGrupo(v, ['nome', 'descricao', 'categoria', 'etiquetas', 'entradas']);
  const nome = texto(c.nome, 180, true)!, descricao = texto(c.descricao, 2000), categoria = texto(c.categoria, 80);
  if (c.etiquetas !== undefined && (!Array.isArray(c.etiquetas) || c.etiquetas.length > 10)) throw new Error('Etiquetas inválidas.');
  const etiquetas = [...new Set(((c.etiquetas ?? []) as unknown[]).map(t => texto(t, 40, true)!))];
  if (!Array.isArray(c.entradas) || c.entradas.length < 1 || c.entradas.length > 20) throw new Error('Use de 1 a 20 alimentos no grupo.');
  const ids = new Set<string>(), chaves = new Set<string>();
  const entradas = c.entradas.map(v => {
    const e = objetoGrupo(v, ['id', 'origem', 'alimentoId', 'revisao', 'quantidade', 'unidade', 'porcaoGramas']);
    if (typeof e.id !== 'string' || !UUID_GRUPO.test(e.id) || typeof e.alimentoId !== 'string' || !UUID_GRUPO.test(e.alimentoId) || !['catalogo','custom'].includes(e.origem as string)) throw new Error('Referência de alimento inválida.');
    if (e.origem === 'custom' ? !Number.isInteger(e.revisao) || Number(e.revisao) < 1 || Number(e.revisao) > 2147483647 : e.revisao !== undefined) throw new Error('Revisão de alimento inválida.');
    if (!porcaoGrupoValida(e.quantidade) || !porcaoGrupoValida(e.porcaoGramas)) throw new Error('Porção do grupo inválida.');
    const entrada: EntradaGrupo = { id: e.id.toLowerCase(), origem: e.origem as EntradaGrupo['origem'], alimentoId: e.alimentoId.toLowerCase(), ...(e.origem === 'custom' ? { revisao: Number(e.revisao) } : {}), quantidade: e.quantidade, unidade: texto(e.unidade, 40, true)!, porcaoGramas: e.porcaoGramas };
    const chave = JSON.stringify([identidadeEntradaGrupo(entrada), entrada.porcaoGramas]);
    if (ids.has(entrada.id) || chaves.has(chave)) throw new Error('Alimento repetido no grupo.');
    ids.add(entrada.id); chaves.add(chave); return entrada;
  });
  return { nome, ...(descricao ? { descricao } : {}), ...(categoria ? { categoria } : {}), etiquetas, entradas };
}

export interface IntencaoGrupo { grupoId:string;revisao:number;entradaId:string;aplicacaoId:string;confirmarPorcaoDistinta?:boolean }
export interface OrigemGrupoSnapshot extends IntencaoGrupo { schemaVersao:1;porcaoAplicadaGramas:number;quantidadeAplicada:number;unidadeAplicada:string;
  referenciaAlimento?: Pick<EntradaGrupo,'origem'|'alimentoId'|'revisao'>;
  tipoBaseCustom?: 'por100g'|'porcao';
}
export function validarIntencaoGrupo(valor: unknown): IntencaoGrupo {
  const v=objetoGrupo(valor,['grupoId','revisao','entradaId','aplicacaoId','confirmarPorcaoDistinta']);
  for(const k of ['grupoId','entradaId','aplicacaoId'])if(typeof v[k]!=='string'||!UUID_GRUPO.test(v[k] as string))throw new Error('Aplicação de grupo inválida.');
  if(!Number.isInteger(v.revisao)||Number(v.revisao)<1||Number(v.revisao)>2147483647||(v.confirmarPorcaoDistinta!==undefined&&typeof v.confirmarPorcaoDistinta!=='boolean'))throw new Error('Aplicação de grupo inválida.');
  return {grupoId:(v.grupoId as string).toLowerCase(),revisao:Number(v.revisao),entradaId:(v.entradaId as string).toLowerCase(),aplicacaoId:(v.aplicacaoId as string).toLowerCase(),...(v.confirmarPorcaoDistinta!==undefined?{confirmarPorcaoDistinta:v.confirmarPorcaoDistinta as boolean}:{})};
}
