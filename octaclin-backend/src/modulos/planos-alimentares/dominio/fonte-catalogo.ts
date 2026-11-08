export type TipoFonteCatalogo = 'TACO' | 'USDA' | 'IBGE';
export interface FonteCatalogoIdentificada { tipo: TipoFonteCatalogo; codigo: string; versao?: string }

/**
 * Pares `codigo` + `baseCodigo` gravados pelo catálogo governado (mesma lista de
 * `BASES_ESPERADAS` em `servico-disponibilidade-catalogos.ts`). Só estes pares identificam uma
 * fonte oficial: `baseCodigo` sozinho é texto livre e não prova procedência.
 */
/**
 * REGRA DE EVOLUÇÃO (append-only). A origem é derivada na leitura, não gravada no registro: alterar ou remover uma
 * entrada abaixo, ou o resultado para um snapshot histórico, muda retroativamente o que se vê em análises antigas.
 * Só acrescente entradas novas, com decisão do proprietário, e atualize `VERSAO_MAPA_FONTES_CATALOGO` e o teste
 * `fonte-catalogo.spec.ts`, que congela este mapa e um corpus de snapshots históricos.
 */
export const VERSAO_MAPA_FONTES_CATALOGO = 'food06-fontes-v1';
export const MAPA_FONTES_CATALOGO: Readonly<Record<string, { baseCodigo: string; tipo: TipoFonteCatalogo }>> = Object.freeze({
  taco_nepa_unicamp: { baseCodigo: 'cmvcol_taco3', tipo: 'TACO' },
  usda_fdc_foundation: { baseCodigo: 'foundation-foods', tipo: 'USDA' },
  usda_fdc_sr_legacy: { baseCodigo: 'sr-legacy', tipo: 'USDA' },
  ibge_pof_2008_2009: { baseCodigo: 'pof-2008-2009-composicao', tipo: 'IBGE' }
});
/**
 * Versões são rótulos livres do operador do catálogo (ex.: `taco-4a-cmvcol-taco3-v1` ou "FoodData Central 2025-04-24"):
 * a governança só exige que não sejam vazias e a coluna `fontes_composicao_alimentos.versao` é `varchar(80)`.
 * Aceita qualquer caractere imprimível, até 80, sem espaço nas pontas; recusa markup (`<`, `>`) e caracteres de controle.
 */
const VERSAO_CATALOGO = /^[^\s\p{C}<>][^\p{C}<>]{0,79}$/u;
const versaoValida = (v: unknown): v is string => typeof v === 'string' && v === v.trim() && VERSAO_CATALOGO.test(v);

/**
 * Usa apenas metadados congelados no snapshot. Par desconhecido ou incoerente não é identificado
 * e versão ausente ou fora do formato seguro permanece desconhecida; nada é completado pelo catálogo atual.
 */
export function identificarFonteCatalogo(fonte: unknown): FonteCatalogoIdentificada | undefined {
  if (!fonte || typeof fonte !== 'object' || Array.isArray(fonte)) return undefined;
  const { codigo, baseCodigo, versao } = fonte as Record<string, unknown>;
  if (typeof codigo !== 'string' || !Object.hasOwn(MAPA_FONTES_CATALOGO, codigo)) return undefined;
  const conhecida = MAPA_FONTES_CATALOGO[codigo]!;
  // Snapshots anteriores à governança do catálogo (migração 1028) não têm `baseCodigo`: o código, resolvido
  // no servidor, basta. Um `baseCodigo` presente e divergente continua recusado.
  if (baseCodigo !== undefined && baseCodigo !== conhecida.baseCodigo) return undefined;
  return { tipo: conhecida.tipo, codigo, ...(versaoValida(versao) ? { versao } : {}) };
}
