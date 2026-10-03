/** Retorna verdadeiro quando cada escopo solicitado está coberto pela concessão. */
export function estaDentroDaConcessao<T extends string>(solicitados: readonly T[], concedidos: readonly T[]): boolean {
  const permitidos = new Set(concedidos);
  return solicitados.every((item) => permitidos.has(item));
}

/** Compara conjuntos sem depender da ordem enviada pela interface. */
export function conjuntosEquivalentes<T extends string>(primeiro: readonly T[], segundo: readonly T[]): boolean {
  if (primeiro.length !== segundo.length) return false;
  const itens = new Set(primeiro);
  return itens.size === primeiro.length && segundo.every((item) => itens.has(item));
}
