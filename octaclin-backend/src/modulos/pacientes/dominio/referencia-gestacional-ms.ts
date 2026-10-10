/** Ficha ratificada pelo proprietario/equipe em 2026-10-10. Tabela semanal
 * MS/UFS 2022, anexo p.50/PDF51; nao combinar com resumos trimestrais.
 * https://docs.bvsalud.org/biblioref/2022/12/1401909/livro_saps_guia_organizacao_vigilancia_alimentar_nutricional_2022.pdf
 */
export const SOURCE_ID_GESTACIONAL = 'ms_ufs_2022_semanal_v1';
export const ALGORITHM_VERSION_GESTACIONAL = 'ganho_gestacional_v1';
export type GrupoImcGestacional = 'baixo_peso'|'eutrofia'|'sobrepeso'|'obesidade';
// Semana, minimo/maximo baixo peso, eutrofia, sobrepeso, obesidade (kg).
const TABELA: ReadonlyArray<readonly number[]> = Object.freeze([
  [10, -0.7, 0.3, -2.4, 0.0, -2.3, -1.3, -1.8, -0.8],
  [11, -0.4, 0.6, -2.2, 0.2, -2.1, -1.0, -1.7, -0.7],
  [12, -0.1, 0.9, -2.0, 0.4, -1.8, -0.8, -1.7, -0.6],
  [13, 0.2, 1.2, -1.8, 0.7, -1.6, -0.5, -1.7, -0.5],
  [14, 0.5, 1.6, -1.6, 0.9, -1.4, -0.2, -1.6, -0.4],
  [15, 0.8, 1.9, -1.3, 1.2, -1.1, 0.0, -1.5, -0.2],
  [16, 1.2, 2.3, -1.1, 1.5, -0.9, 0.3, -1.4, -0.1],
  [17, 1.5, 2.7, -0.8, 1.8, -0.6, 0.6, -1.3, 0.1],
  [18, 1.9, 3.1, -0.4, 2.2, -0.3, 0.9, -1.2, 0.3],
  [19, 2.3, 3.6, 0.0, 2.7, -0.1, 1.2, -1.0, 0.5],
  [20, 2.7, 4.0, 0.4, 3.1, 0.2, 1.5, -0.8, 0.7],
  [21, 3.1, 4.5, 0.8, 3.6, 0.5, 1.8, -0.6, 0.9],
  [22, 3.5, 4.9, 1.2, 4.1, 0.8, 2.1, -0.4, 1.2],
  [23, 4.0, 5.4, 1.6, 4.5, 1.1, 2.4, -0.1, 1.4],
  [24, 4.4, 5.9, 2.0, 5.0, 1.4, 2.7, 0.2, 1.7],
  [25, 4.8, 6.3, 2.4, 5.4, 1.7, 3.1, 0.5, 2.0],
  [26, 5.2, 6.8, 2.7, 5.9, 2.0, 3.4, 0.8, 2.4],
  [27, 5.6, 7.2, 3.1, 6.3, 2.3, 3.7, 1.1, 2.7],
  [28, 6.0, 7.7, 3.4, 6.7, 2.6, 4.1, 1.4, 3.0],
  [29, 6.3, 8.1, 3.8, 7.1, 3.0, 4.4, 1.7, 3.4],
  [30, 6.7, 8.5, 4.1, 7.5, 3.3, 4.8, 2.0, 3.7],
  [31, 7.1, 8.9, 4.5, 7.9, 3.7, 5.2, 2.3, 4.0],
  [32, 7.4, 9.3, 4.8, 8.3, 4.0, 5.6, 2.7, 4.4],
  [33, 7.7, 9.7, 5.2, 8.8, 4.4, 6.0, 3.0, 4.7],
  [34, 8.1, 10.1, 5.5, 9.2, 4.8, 6.4, 3.3, 5.1],
  [35, 8.4, 10.4, 5.9, 9.7, 5.2, 6.8, 3.6, 5.4],
  [36, 8.6, 10.8, 6.3, 10.1, 5.5, 7.2, 4.0, 5.7],
  [37, 8.9, 11.1, 6.7, 10.6, 5.9, 7.6, 4.3, 6.1],
  [38, 9.2, 11.5, 7.0, 11.0, 6.4, 8.0, 4.6, 6.4],
  [39, 9.5, 11.8, 7.4, 11.5, 6.8, 8.5, 4.9, 6.8],
  [40, 9.7, 12.2, 8.0, 12.0, 7.0, 9.0, 5.0, 7.2],
].map(linha => Object.freeze(linha)));
export function faixaGestacional(semana: number, grupo: GrupoImcGestacional) {
  const linha = TABELA.find(l => l[0] === semana);
  if (!linha) return undefined;
  const indice = 1+['baixo_peso','eutrofia','sobrepeso','obesidade'].indexOf(grupo)*2;
  return { minimo: linha[indice],maximo: linha[indice+1] };
}
