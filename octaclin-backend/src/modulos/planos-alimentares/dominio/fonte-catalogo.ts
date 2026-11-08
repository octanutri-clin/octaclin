export type TipoFonteCatalogo = 'TACO' | 'USDA' | 'IBGE';
export interface FonteCatalogoIdentificada { tipo: TipoFonteCatalogo; codigo: string; versao?: string }

/**
 * Pares `codigo` + `baseCodigo` gravados pelo catálogo governado (mesma lista de
 * `BASES_ESPERADAS` em `servico-disponibilidade-catalogos.ts`). Só estes pares identificam uma
 * fonte oficial: `baseCodigo` sozinho é texto livre e não prova procedência.
 */
const FONTES_CATALOGO: Readonly<Record<string, { baseCodigo: string; tipo: TipoFonteCatalogo }>> = Object.freeze({
  taco_nepa_unicamp: { baseCodigo: 'cmvcol_taco3', tipo: 'TACO' },
  usda_fdc_foundation: { baseCodigo: 'foundation-foods', tipo: 'USDA' },
  usda_fdc_sr_legacy: { baseCodigo: 'sr-legacy', tipo: 'USDA' },
  ibge_pof_2008_2009: { baseCodigo: 'pof-2008-2009-composicao', tipo: 'IBGE' }
});
/**
 * Versões são rótulos livres do operador do catálogo (ex.: `taco-4a-cmvcol-taco3-v1` ou "FoodData Central 2025-04-24"):
 * a governança só exige que não sejam vazias. Aceita letras, números, espaço e pontuação comum; recusa markup e controle.
 */
const VERSAO_CATALOGO = /^[\p{L}\p{N}][\p{L}\p{N} ._:/()+,-]{0,63}$/u;

/**
 * Usa apenas metadados congelados no snapshot. Par desconhecido ou incoerente não é identificado
 * e versão ausente ou fora do formato seguro permanece desconhecida; nada é completado pelo catálogo atual.
 */
export function identificarFonteCatalogo(fonte: unknown): FonteCatalogoIdentificada | undefined {
  if (!fonte || typeof fonte !== 'object' || Array.isArray(fonte)) return undefined;
  const { codigo, baseCodigo, versao } = fonte as Record<string, unknown>;
  if (typeof codigo !== 'string' || !Object.hasOwn(FONTES_CATALOGO, codigo)) return undefined;
  const conhecida = FONTES_CATALOGO[codigo]!;
  // Snapshots anteriores à governança do catálogo (migração 1028) não têm `baseCodigo`: o código, resolvido
  // no servidor, basta. Um `baseCodigo` presente e divergente continua recusado.
  if (baseCodigo !== undefined && baseCodigo !== conhecida.baseCodigo) return undefined;
  return { tipo: conhecida.tipo, codigo, ...(typeof versao === 'string' && VERSAO_CATALOGO.test(versao) ? { versao } : {}) };
}
