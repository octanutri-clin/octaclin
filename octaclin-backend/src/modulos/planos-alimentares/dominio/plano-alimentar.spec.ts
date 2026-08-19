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

  describe('substituicoes liberadas ao paciente', () => {
    const alternativa = {
      descricao: 'Pao integral',
      quantidade: 1,
      unidade: 'fatia',
      porcaoGramas: 30,
      nutrientes: estrutura.refeicoes[0].itens[0].nutrientes,
      liberadaParaPaciente: true,
      preferida: false
    };

    function planoComItem(extra: Record<string, unknown>) {
      return {
        refeicoes: [
          {
            nome: 'Cafe da manha',
            itens: [{ ...structuredClone(estrutura.refeicoes[0].itens[0]), ...extra }]
          }
        ]
      };
    }

    it('aceita alternativas liberadas e preferidas', () => {
      expect(() =>
        validarEstruturaPlano(planoComItem({ substituicoes: [alternativa] }) as never)
      ).not.toThrow();
    });

    it('recusa limite de exibicao fora de 1 a 20', () => {
      for (const limite of [0, -1, 21, 1.5]) {
        expect(() =>
          validarEstruturaPlano(
            planoComItem({ substituicoes: [alternativa], substituicoesVisiveisInicialmente: limite }) as never
          )
        ).toThrow(/visiveis/i);
      }
    });

    it('aceita limite ausente, que significa mostrar todas as liberadas', () => {
      expect(() =>
        validarEstruturaPlano(planoComItem({ substituicoes: [alternativa] }) as never)
      ).not.toThrow();
    });

    it('recusa limite de exibicao em item sem nenhuma alternativa', () => {
      // Um limite de exibicao sobre lista vazia nao descreve nada e so
      // sobrevive ate alguem tentar interpreta-lo na tela.
      expect(() =>
        validarEstruturaPlano(planoComItem({ substituicoes: [], substituicoesVisiveisInicialmente: 3 }) as never)
      ).toThrow(/visiveis/i);
    });
  });
});
