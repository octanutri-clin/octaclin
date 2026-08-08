import { calcularTotaisPlano, validarEstruturaPlano } from './plano-alimentar';

describe('plano alimentar', () => {
  const estrutura = {
    refeicoes: [
      {
        nome: 'Cafe da manha',
        itens: [
          {
            descricao: 'Aveia, flocos, crua',
            quantidade: 1,
            unidade: 'porcao',
            porcaoGramas: 50,
            nutrientes: {
              energiaKcal: 196.9113,
              proteinasG: 6.9605,
              carboidratosG: 33.3178,
              gordurasG: 4.2483,
              fibrasG: 4.565,
              sodioMg: 2.4
            },
            substituicoes: []
          }
        ]
      },
      {
        nome: 'Almoco',
        itens: [
          {
            descricao: 'Arroz, integral, cozido',
            quantidade: 1,
            unidade: 'porcao',
            porcaoGramas: 100,
            nutrientes: {
              energiaKcal: 123.5349,
              proteinasG: 2.5883,
              carboidratosG: 25.8098,
              gordurasG: 1.0003,
              fibrasG: 2.7493,
              sodioMg: 1.244
            },
            substituicoes: []
          }
        ]
      }
    ]
  };

  it('soma nutrientes de todas as refeicoes sem recalcular pela regra 4-4-9', () => {
    expect(calcularTotaisPlano(estrutura)).toEqual({
      energiaKcal: 320.4462,
      proteinasG: 9.5488,
      carboidratosG: 59.1276,
      gordurasG: 5.2486,
      fibrasG: 7.3143,
      sodioMg: 3.644
    });
  });

  it('preserva total desconhecido quando qualquer item nao tem o nutriente', () => {
    const semSodio = structuredClone(estrutura);
    semSodio.refeicoes[1].itens[0].nutrientes.sodioMg = undefined as never;

    expect(calcularTotaisPlano(semSodio).sodioMg).toBeUndefined();
  });

  it('recusa plano sem refeicao ou refeicao vazia', () => {
    expect(() => validarEstruturaPlano({ refeicoes: [] })).toThrow(/refeicao/);
    expect(() => validarEstruturaPlano({ refeicoes: [{ nome: 'Almoco', itens: [] }] })).toThrow(/item/);
  });

  it('recusa nomes, porcoes e quantidades invalidas', () => {
    expect(() =>
      validarEstruturaPlano({
        refeicoes: [
          {
            nome: ' ',
            itens: [
              {
                descricao: 'Arroz',
                quantidade: 0,
                unidade: 'g',
                porcaoGramas: 0,
                nutrientes: estrutura.refeicoes[1].itens[0].nutrientes,
                substituicoes: []
              }
            ]
          }
        ]
      })
    ).toThrow();
  });
});
