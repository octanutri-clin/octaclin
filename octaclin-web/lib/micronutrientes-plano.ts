import type { CodigoMicronutrienteApi } from './plano-alimentar-api';

const VITAMINAS_MG = new Set(['tiaminaMg', 'riboflavinaMg', 'vitaminaB6Mg', 'niacinaMg', 'niacinaNeMg', 'vitaminaEAlfaTocoferolMg', 'vitaminaCMg']);

/** Apresentação não participa da soma; positivos pequenos nunca parecem zero. */
export function formatarNutrientePlano(codigo: string, valor?: number): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  const casas = codigo === 'energiaKcal' ? 0 : codigo.endsWith('G') ? 1 : VITAMINAS_MG.has(codigo) ? 3 : 2;
  const limiar = 10 ** -casas;
  const formato = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas });
  return valor > 0 && valor < limiar ? `<${formato.format(limiar)}` : formato.format(valor);
}

export const CAMPOS_MICRONUTRIENTES_PLANO: ReadonlyArray<{ codigo: CodigoMicronutrienteApi; rotulo: string; unidade: 'mg' | 'mcg' }> = [
  { codigo: 'calcioMg', rotulo: 'Cálcio', unidade: 'mg' },
  { codigo: 'magnesioMg', rotulo: 'Magnésio', unidade: 'mg' },
  { codigo: 'manganesMg', rotulo: 'Manganês', unidade: 'mg' },
  { codigo: 'fosforoMg', rotulo: 'Fósforo', unidade: 'mg' },
  { codigo: 'ferroMg', rotulo: 'Ferro', unidade: 'mg' },
  { codigo: 'potassioMg', rotulo: 'Potássio', unidade: 'mg' },
  { codigo: 'cobreMg', rotulo: 'Cobre', unidade: 'mg' },
  { codigo: 'zincoMg', rotulo: 'Zinco', unidade: 'mg' },
  { codigo: 'selenioMcg', rotulo: 'Selênio', unidade: 'mcg' },
  { codigo: 'retinolMcg', rotulo: 'Retinol', unidade: 'mcg' },
  { codigo: 'vitaminaAReMcg', rotulo: 'Vitamina A (RE)', unidade: 'mcg' },
  { codigo: 'vitaminaARaeMcg', rotulo: 'Vitamina A (RAE)', unidade: 'mcg' },
  { codigo: 'tiaminaMg', rotulo: 'Tiamina (B1)', unidade: 'mg' },
  { codigo: 'riboflavinaMg', rotulo: 'Riboflavina (B2)', unidade: 'mg' },
  { codigo: 'vitaminaB6Mg', rotulo: 'Vitamina B6', unidade: 'mg' },
  { codigo: 'niacinaMg', rotulo: 'Niacina', unidade: 'mg' },
  { codigo: 'niacinaNeMg', rotulo: 'Niacina (NE)', unidade: 'mg' },
  { codigo: 'vitaminaB12Mcg', rotulo: 'Vitamina B12', unidade: 'mcg' },
  { codigo: 'folatoDfeMcg', rotulo: 'Folato (DFE)', unidade: 'mcg' },
  { codigo: 'vitaminaDMcg', rotulo: 'Vitamina D', unidade: 'mcg' },
  { codigo: 'vitaminaEAlfaTocoferolMg', rotulo: 'Vitamina E (alfa-tocoferol)', unidade: 'mg' },
  { codigo: 'vitaminaCMg', rotulo: 'Vitamina C', unidade: 'mg' }
];
