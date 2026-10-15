import { projetarResumoNutricionalPlano } from './resumo-nutricional-plano';

describe('projetarResumoNutricionalPlano', () => {
  it('preserva zero e retorna somente a allowlist de totais', () => {
    expect(projetarResumoNutricionalPlano({
      energiaKcal: 0,
      proteinasG: 12.35,
      carboidratosG: 20,
      gordurasG: 4,
      fibrasG: 8,
      observacoes: 'não deve vazar'
    })).toEqual({
      estado: 'completo', energiaKcal: 0, proteinasG: 12.35, carboidratosG: 20, gordurasG: 4
    });
  });

  it('marca campos ausentes ou inválidos sem transformar em zero', () => {
    expect(projetarResumoNutricionalPlano({ energiaKcal: 100, proteinasG: -1, carboidratosG: '20' })).toEqual({
      estado: 'incompleto', energiaKcal: 100
    });
  });

  it('distingue snapshot ausente de snapshot indisponível', () => {
    expect(projetarResumoNutricionalPlano(undefined)).toEqual({ estado: 'sem_snapshot' });
    expect(projetarResumoNutricionalPlano(undefined, true)).toEqual({ estado: 'indisponivel' });
    expect(projetarResumoNutricionalPlano([])).toEqual({ estado: 'indisponivel' });
  });
});
