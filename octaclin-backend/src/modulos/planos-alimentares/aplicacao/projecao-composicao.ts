import type { SnapshotComposicao } from './servico-planos-alimentares';
import { CODIGOS_MICRONUTRIENTES } from '../dominio/micronutrientes';
function campos(v: object | undefined, permitidos: readonly string[]) {
  return Object.fromEntries(Object.entries(v ?? {}).filter(([k]) => permitidos.includes(k)));
}
const MACROS = ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG', 'fibrasG', 'sodioMg'];
/** Não altera projeção/hash legado; custom nunca transporta metadados de biblioteca. */
export function projetarComposicao(s: SnapshotComposicao): SnapshotComposicao {
  if (s.origem !== 'custom') { const { origemGrupo: _interna, ...publico } = s; return publico; }
  const r = campos(s, ['origem', 'descricao', 'preparacao', 'composicaoInformada', 'nutrientesPor100g', 'nutrientesPorcao', 'micronutrientes']);
  r.nutrientesPor100g = campos(s.nutrientesPor100g, MACROS);
  r.nutrientesPorcao = campos(s.nutrientesPorcao, MACROS);
  if (s.composicaoInformada) r.composicaoInformada = { ...campos(s.composicaoInformada, ['baseGramas', 'normalizacaoVersao', 'referencia']), nutrientes: campos(s.composicaoInformada.nutrientes, MACROS), micronutrientes: campos(s.composicaoInformada.micronutrientes, CODIGOS_MICRONUTRIENTES) };
  if (s.micronutrientes) r.micronutrientes = { ...campos(s.micronutrientes, ['schemaVersao', 'mapeamentoVersao', 'baseGramasOrigem', 'porcaoGramas']), nutrientes: Object.fromEntries(Object.entries(campos(s.micronutrientes.nutrientes, CODIGOS_MICRONUTRIENTES)).map(([k, v]) => [k, campos(v as object, ['estado', 'valorOrigem', 'por100g', 'porcao'])])) };
  return r as unknown as SnapshotComposicao;
}
