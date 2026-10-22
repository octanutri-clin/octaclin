import { ordenarFavoritosPrimeiro } from './favoritos-alimentos';

describe('ordenarFavoritosPrimeiro', () => {
  it('prioriza favoritos sem mudar a ordem original dentro de cada grupo', () => {
    const itens = [{ id: 'c', nome: 'C' }, { id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }];
    expect(ordenarFavoritosPrimeiro(itens, new Set(['catalogo:b', 'catalogo:c']))).toEqual([
      { id: 'c', nome: 'C', favorito: true },
      { id: 'b', nome: 'B', favorito: true },
      { id: 'a', nome: 'A', favorito: false }
    ]);
  });

  it('não confunde identidade de catálogo e identidade personalizada com o mesmo UUID', () => {
    const itens = [
      { id: 'same', origem: 'custom' as const },
      { id: 'same', origem: 'catalogo' as const }
    ];
    expect(ordenarFavoritosPrimeiro(itens, new Set(['catalogo:same']))).toEqual([
      { id: 'same', origem: 'catalogo', favorito: true },
      { id: 'same', origem: 'custom', favorito: false }
    ]);
  });
});
