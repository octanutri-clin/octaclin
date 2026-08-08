import {
  calcularEstimativaEnergetica,
  calcularMetasMacronutrientes,
  calcularNutrientesDaPorcao
} from './calculo-nutricional';

describe('calculo nutricional', () => {
  describe('estimativa energetica', () => {
    it('calcula Mifflin-St Jeor para homem adulto sem arredondar o valor persistido', () => {
      expect(
        calcularEstimativaEnergetica({
          formula: 'mifflin_st_jeor_1990',
          sexo: 'masculino',
          idadeAnos: 40,
          pesoKg: 80,
          alturaCm: 180,
          fatorAtividade: 1.5
        })
      ).toMatchObject({
        metabolismoRepousoKcal: 1730,
        gastoEnergeticoTotalKcal: 2595,
        formulaCodigo: 'mifflin_st_jeor_1990',
        formulaVersao: '1'
      });
    });

    it('calcula Mifflin-St Jeor para mulher adulta', () => {
      expect(
        calcularEstimativaEnergetica({
          formula: 'mifflin_st_jeor_1990',
          sexo: 'feminino',
          idadeAnos: 35,
          pesoKg: 60,
          alturaCm: 165,
          fatorAtividade: 1.4
        }).metabolismoRepousoKcal
      ).toBe(1295.25);
    });

    it('identifica a revisao de Harris-Benedict sem confundir com a formula original', () => {
      const resultado = calcularEstimativaEnergetica({
        formula: 'harris_benedict_revisada_1984',
        sexo: 'masculino',
        idadeAnos: 40,
        pesoKg: 80,
        alturaCm: 180,
        fatorAtividade: 1.5
      });

      expect(resultado.metabolismoRepousoKcal).toBeCloseTo(1796.862, 3);
      expect(resultado.formulaAplicada).toContain('Roza-Shizgal 1984');
    });

    it('aplica a equacao FAO/OMS/UNU da faixa de idade correta', () => {
      const resultado = calcularEstimativaEnergetica({
        formula: 'fao_oms_unu_1985',
        sexo: 'masculino',
        idadeAnos: 29,
        pesoKg: 70,
        alturaCm: 175,
        fatorAtividade: 1.75
      });

      expect(resultado.metabolismoRepousoKcal).toBeCloseTo(1750, 4);
      expect(resultado.gastoEnergeticoTotalKcal).toBeCloseTo(3062.5, 4);
      expect(resultado.formulaAplicada).toContain('18-29');
    });

    it.each([
      ['peso', { pesoKg: 0 }],
      ['altura', { alturaCm: 251 }],
      ['idade', { idadeAnos: 17 }],
      ['fator', { fatorAtividade: 1.399 }]
    ])('bloqueia entrada implausivel: %s', (_campo, sobrescrever) => {
      expect(() =>
        calcularEstimativaEnergetica({
          formula: 'mifflin_st_jeor_1990',
          sexo: 'feminino',
          idadeAnos: 35,
          pesoKg: 60,
          alturaCm: 165,
          fatorAtividade: 1.4,
          ...sobrescrever
        })
      ).toThrow();
    });

    it('restringe Mifflin-St Jeor a faixa estudada', () => {
      expect(() =>
        calcularEstimativaEnergetica({
          formula: 'mifflin_st_jeor_1990',
          sexo: 'masculino',
          idadeAnos: 79,
          pesoKg: 70,
          alturaCm: 170,
          fatorAtividade: 1.4
        })
      ).toThrow(/19 a 78/);
    });
  });

  it('converte meta energetica e percentuais em gramas pelos fatores 4-4-9', () => {
    expect(
      calcularMetasMacronutrientes(2000, {
        carboidratosBasisPoints: 5000,
        proteinasBasisPoints: 2000,
        gordurasBasisPoints: 3000
      })
    ).toEqual({ carboidratosG: 250, proteinasG: 100, gordurasG: 66.6667 });
  });

  it('recusa percentuais de macros que nao totalizam 100%', () => {
    expect(() =>
      calcularMetasMacronutrientes(2000, {
        carboidratosBasisPoints: 5000,
        proteinasBasisPoints: 2000,
        gordurasBasisPoints: 2999
      })
    ).toThrow(/10.000/);
  });

  it('calcula nutrientes da porcao a partir do snapshot por 100 g', () => {
    expect(
      calcularNutrientesDaPorcao(
        {
          energiaKcal: 123.5349,
          proteinasG: 2.5883,
          carboidratosG: 25.8098,
          gordurasG: 1.0003,
          fibrasG: 2.7493,
          sodioMg: 1.244
        },
        150
      )
    ).toEqual({
      energiaKcal: 185.3024,
      proteinasG: 3.8825,
      carboidratosG: 38.7147,
      gordurasG: 1.5005,
      fibrasG: 4.124,
      sodioMg: 1.866
    });
  });

  it('preserva fibra e sodio desconhecidos sem transforma-los em zero', () => {
    expect(
      calcularNutrientesDaPorcao(
        { energiaKcal: 100, proteinasG: 10, carboidratosG: 15, gordurasG: 2 },
        50
      )
    ).toEqual({
      energiaKcal: 50,
      proteinasG: 5,
      carboidratosG: 7.5,
      gordurasG: 1,
      fibrasG: undefined,
      sodioMg: undefined
    });
  });
});
