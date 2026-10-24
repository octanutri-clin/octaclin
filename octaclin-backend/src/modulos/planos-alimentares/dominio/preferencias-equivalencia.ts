import { objetoGrupo } from './grupos-substituicoes';
import { PoliticaEquivalencia, validarPoliticaEquivalencia } from './equivalencia-nutriente';
export interface PreferenciasEquivalencia {
  schemaVersao: 1;
  unidades: 'gramas' | 'gramas_e_medida_disponivel';
  casasGramas: number;
  casasNutrientes: number;
  passoPorcaoGramas: PoliticaEquivalencia['passoPorcaoGramas'];
  modoComparacao: 'compacto' | 'detalhado';
}
export const PREFERENCIAS_EQUIVALENCIA_PADRAO: Readonly<PreferenciasEquivalencia> = Object.freeze({
  schemaVersao: 1, unidades: 'gramas_e_medida_disponivel', casasGramas: 3,
  casasNutrientes: 2, passoPorcaoGramas: '1', modoComparacao: 'detalhado'
});
export function validarPreferenciasEquivalencia(valor: unknown): PreferenciasEquivalencia {
  const p = objetoGrupo(valor, Object.keys(PREFERENCIAS_EQUIVALENCIA_PADRAO));
  if (p.schemaVersao !== 1 || !['gramas', 'gramas_e_medida_disponivel'].includes(p.unidades as string) ||
      !Number.isInteger(p.casasGramas) || Number(p.casasGramas) < 0 || Number(p.casasGramas) > 3 ||
      !Number.isInteger(p.casasNutrientes) || Number(p.casasNutrientes) < 0 || Number(p.casasNutrientes) > 4 ||
      !['compacto', 'detalhado'].includes(p.modoComparacao as string)) throw new Error('Preferências inválidas.');
  validarPoliticaEquivalencia({ passoPorcaoGramas: p.passoPorcaoGramas });
  return { schemaVersao: 1, unidades: p.unidades as PreferenciasEquivalencia['unidades'],
    casasGramas: p.casasGramas as number, casasNutrientes: p.casasNutrientes as number,
    passoPorcaoGramas: p.passoPorcaoGramas as PreferenciasEquivalencia['passoPorcaoGramas'],
    modoComparacao: p.modoComparacao as PreferenciasEquivalencia['modoComparacao'] };
}
export function validarPedidoPreferenciasEquivalencia(valor: unknown): { preferencias: PreferenciasEquivalencia; revisaoEsperada: number } {
  const p = objetoGrupo(valor, ['preferencias', 'revisaoEsperada']);
  if (!Number.isInteger(p.revisaoEsperada) || Number(p.revisaoEsperada) < 0 || Number(p.revisaoEsperada) > 2147483647) throw new Error('Revisão inválida.');
  return { preferencias: validarPreferenciasEquivalencia(p.preferencias), revisaoEsperada: p.revisaoEsperada as number };
}
