export interface ItemOrdenavel {
  id: string;
  ordem: number;
}

export function normalizarOrdemPerguntas(itens: ItemOrdenavel[]): ItemOrdenavel[] {
  const ids = new Set<string>();

  for (const item of itens) {
    if (ids.has(item.id)) {
      throw new Error('Nao e permitido repetir pergunta na reordenacao.');
    }
    ids.add(item.id);
  }

  return [...itens]
    .sort((a, b) => a.ordem - b.ordem)
    .map((item, indice) => ({
      ...item,
      ordem: indice + 1
    }));
}
