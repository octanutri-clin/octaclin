import { objetoGrupo, porcaoGrupoValida, UUID_GRUPO } from './grupos-substituicoes';
export const NUTRIENTES_EQUIVALENCIA = ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG'] as const;
export type NutrienteEquivalencia = typeof NUTRIENTES_EQUIVALENCIA[number];
export interface PoliticaEquivalencia { passoPorcaoGramas: '1' | '0.1' | '0.01' | '0.001' }
export interface ReferenciaEquivalencia { aplicacaoId: string }
export interface ComandoEquivalencia extends ReferenciaEquivalencia {
  acao: 'calcular' | 'recalcular' | 'desvincular'; anteriorAplicacaoId?: string;
  fingerprintEsperado: string; nutriente?: NutrienteEquivalencia;
  politica?: PoliticaEquivalencia; porcaoEfetiva?: string;
}
export type IntencaoEquivalencia = ReferenciaEquivalencia | ComandoEquivalencia;
export function nutrienteEquivalenciaValido(v: unknown): v is NutrienteEquivalencia {
  return typeof v === 'string' && (NUTRIENTES_EQUIVALENCIA as readonly string[]).includes(v);
}
export function validarPoliticaEquivalencia(v: unknown): PoliticaEquivalencia {
  const p = objetoGrupo(v, ['passoPorcaoGramas']);
  if (!['1', '0.1', '0.01', '0.001'].includes(p.passoPorcaoGramas as string)) throw new Error('Política de porção inválida.');
  return { passoPorcaoGramas: p.passoPorcaoGramas as PoliticaEquivalencia['passoPorcaoGramas'] };
}
export function validarIntencaoEquivalencia(v: unknown): IntencaoEquivalencia {
  const c = objetoGrupo(v, ['aplicacaoId', 'acao', 'anteriorAplicacaoId', 'fingerprintEsperado', 'nutriente', 'politica', 'porcaoEfetiva']);
  if (typeof c.aplicacaoId !== 'string' || !UUID_GRUPO.test(c.aplicacaoId)) throw new Error('Referência de equivalência inválida.');
  if (c.acao === undefined) {
    if (Object.keys(c).length !== 1) throw new Error('Referência de equivalência inválida.');
    return { aplicacaoId: c.aplicacaoId.toLowerCase() };
  }
  if (!['calcular', 'recalcular', 'desvincular'].includes(c.acao as string) || typeof c.fingerprintEsperado !== 'string' || !/^[a-f0-9]{64}$/.test(c.fingerprintEsperado)) throw new Error('Comando de equivalência inválido.');
  const anterior = c.anteriorAplicacaoId;
  if (c.acao === 'calcular' ? anterior !== undefined : typeof anterior !== 'string' || !UUID_GRUPO.test(anterior) || anterior.toLowerCase() === c.aplicacaoId.toLowerCase()) throw new Error('Vínculo anterior inválido.');
  const base: ComandoEquivalencia = { acao: c.acao as ComandoEquivalencia['acao'], aplicacaoId: c.aplicacaoId.toLowerCase(), fingerprintEsperado: c.fingerprintEsperado, ...(typeof anterior === 'string' ? { anteriorAplicacaoId: anterior.toLowerCase() } : {}) };
  if (c.acao === 'desvincular') {
    if (c.nutriente !== undefined || c.politica !== undefined || c.porcaoEfetiva !== undefined) throw new Error('Desvinculação inválida.');
    return base;
  }
  const q = typeof c.porcaoEfetiva === 'string' && /^\d{1,5}(?:\.\d{1,3})?$/.test(c.porcaoEfetiva) ? Number(c.porcaoEfetiva) : NaN;
  if (!nutrienteEquivalenciaValido(c.nutriente) || !porcaoGrupoValida(q)) throw new Error('Parâmetros de equivalência inválidos.');
  return { ...base, nutriente: c.nutriente, politica: validarPoliticaEquivalencia(c.politica), porcaoEfetiva: c.porcaoEfetiva as string };
}
