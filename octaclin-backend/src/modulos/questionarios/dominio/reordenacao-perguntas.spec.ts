import { normalizarOrdemPerguntas } from './reordenacao-perguntas';

describe('normalizarOrdemPerguntas', () => {
  it('deve ordenar e normalizar a sequencia a partir de 1', () => {
    const resultado = normalizarOrdemPerguntas([
      { id: 'pergunta-c', ordem: 30 },
      { id: 'pergunta-a', ordem: 10 },
      { id: 'pergunta-b', ordem: 20 }
    ]);

    expect(resultado).toEqual([
      { id: 'pergunta-a', ordem: 1 },
      { id: 'pergunta-b', ordem: 2 },
      { id: 'pergunta-c', ordem: 3 }
    ]);
  });

  it('deve rejeitar pergunta duplicada na reordenacao', () => {
    expect(() =>
      normalizarOrdemPerguntas([
        { id: 'pergunta-a', ordem: 1 },
        { id: 'pergunta-a', ordem: 2 }
      ])
    ).toThrow('Nao e permitido repetir pergunta na reordenacao.');
  });
});
