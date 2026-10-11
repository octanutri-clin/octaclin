/** Contratos G02 REV9 ratificados; sem dados científicos, ativação ou consumo assistencial. */
import { idadePediatrica, somarMesesCivis } from './idade-pediatrica';
import type { IndicadorPediatrico, ContextoPediatrico } from './antropometria-pediatrica';
export const PROTOCOLO_PEDIATRICO_REV9 = 'g02-rev9-3dd197df' as const;
export function referenciaOmsRev9(indicador: IndicadorPediatrico, diasEfetivos: number, nascimento: string, avaliacao: string) {
  const cronologica = idadePediatrica(nascimento,avaliacao);
  if (!Number.isSafeInteger(diasEfetivos) || diasEfetivos < 0 || cronologica.anosCompletos >= 20) return undefined;
  const faixaSisvan = cronologica.anosCompletos < 5 ? 'menor_de_5' as const : '5_a_19' as const;
  if (indicador === 'peso_estatura' && faixaSisvan !== 'menor_de_5') return undefined;
  if (diasEfetivos <= 1856) return { familia: 'OMS2006' as const, parametro: diasEfetivos, unidadeIdade: 'dias' as const, faixaSisvan, adaptacaoSisvan19: false };
  if (indicador === 'peso_estatura') return undefined;
  const adaptacaoSisvan19 = indicador === 'imc_idade' && cronologica.anosCompletos >= 19 && avaliacao >= somarMesesCivis(nascimento,229);
  const meses = adaptacaoSisvan19 ? 228 : diasEfetivos/30.4375;
  const limite = indicador === 'peso_idade' ? 121 : 229;
  if (meses < 60 || meses >= limite) return undefined;
  return { familia: 'OMS2007' as const, parametro: meses, unidadeIdade: 'meses_estatisticos' as const, faixaSisvan, adaptacaoSisvan19 };
}
export function normalizarMedidaOmsRev9(originalCm: number, tecnica: ContextoPediatrico['tecnica'], diasEfetivos: number) {
  if (!Number.isFinite(originalCm) || originalCm <= 0 || !Number.isSafeInteger(diasEfetivos) || diasEfetivos < 0) throw new Error('medida_invalida');
  if (tecnica === 'nao_informada') throw new Error('tecnica_nao_informada');
  if (tecnica !== 'deitado' && tecnica !== 'em_pe') throw new Error('tecnica_invalida');
  if (tecnica === 'em_pe' && diasEfetivos/30.4375 < 9) throw new Error('tecnica_exige_reconferencia');
  const ajusteCm = tecnica === 'em_pe' && diasEfetivos < 731 ? 0.7 : tecnica === 'deitado' && diasEfetivos >= 731 ? -0.7 : 0;
  if (originalCm+ajusteCm <= 0) throw new Error('medida_invalida');
  return { originalCm, usadoCm: originalCm+ajusteCm, ajusteCm };
}
