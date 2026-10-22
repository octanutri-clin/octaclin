export type OrigemFavoritoAlimento = 'catalogo' | 'custom';

export function chaveFavoritoAlimento(origem: OrigemFavoritoAlimento, id: string): string {
  return `${origem}:${id}`;
}

export function ordenarFavoritosPrimeiro<T extends { id: string; origem?: OrigemFavoritoAlimento }>(
  itens: readonly T[],
  favoritos: ReadonlySet<string>
): Array<T & { favorito: boolean }> {
  return itens
    .map((item, indice) => ({
      item,
      indice,
      favorito: favoritos.has(chaveFavoritoAlimento(item.origem ?? 'catalogo', item.id))
    }))
    .sort((a, b) => Number(b.favorito) - Number(a.favorito) || a.indice - b.indice)
    .map(({ item, favorito }) => ({ ...item, favorito }));
}
