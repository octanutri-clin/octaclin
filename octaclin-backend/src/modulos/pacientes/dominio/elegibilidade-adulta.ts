/** CL08: seis decisões separadas pendentes. Mudança exige evidência e revisão de código; não é flag. */
export const DECISOES_18_19 = Object.freeze({
  pollock_3: 'pendente', pollock_7: 'pendente', faulkner: 'pendente', guedes: 'pendente', cintura: 'pendente', rcq: 'pendente'
} as const);
export type MetodoAdulto = keyof typeof DECISOES_18_19;
export function metodoAdultoElegivel(metodo: MetodoAdulto, idade: number | undefined): boolean {
  if (idade === undefined || !Number.isFinite(idade) || idade < 18 || idade > 120) return false;
  if (idade < 20) return DECISOES_18_19[metodo] !== 'pendente';
  return true;
}
