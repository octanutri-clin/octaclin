/** CL08 REV9 ratificada: mínimo adulto inclusivo. Domínios e gestação são verificados pelo cálculo de cada método. */
export const DECISOES_18_19 = Object.freeze({
  pollock_3: 'ratificado_rev9', pollock_7: 'ratificado_rev9', faulkner: 'ratificado_rev9', guedes: 'ratificado_rev9', cintura: 'ratificado_rev9', rcq: 'ratificado_rev9'
} as const);
export type MetodoAdulto = keyof typeof DECISOES_18_19;
export function metodoAdultoElegivel(metodo: MetodoAdulto, idade: number | undefined): boolean {
  if (idade === undefined || !Number.isFinite(idade) || idade < 18 || idade > 120) return false;
  if (!Object.prototype.hasOwnProperty.call(DECISOES_18_19, metodo)) return false;
  return true;
}
