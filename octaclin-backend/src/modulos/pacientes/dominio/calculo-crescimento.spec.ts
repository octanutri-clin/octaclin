import { escoreLms, inversaLms, interpolarLms, escoreLognormal, percentilNormal } from './calculo-crescimento';

describe('fundamentos matemáticos sem datasets ou ativação clínica', () => {
  const parametros = { l: 1, m: 10, s: 0.1 };
  it('LMS conhecido sintético, inversão e L zero', () => {
    expect(escoreLms(12, parametros)).toBeCloseTo(2, 12);
    expect(inversaLms(2, parametros)).toBeCloseTo(12, 12);
    expect(escoreLms(Math.exp(0.2) * 10, { ...parametros, l: 0 })).toBeCloseTo(2, 12);
  });
  it('interpola parâmetros; proíbe extrapolação e âncoras repetidas', () => {
    expect(interpolarLms(1.5, [{ x: 1, ...parametros }, { x: 2, l: 0, m: 12, s: 0.2 }])).toEqual({ l: 0.5, m: 11, s: 0.15000000000000002 });
    expect(() => interpolarLms(0, [{ x: 1, ...parametros }])).toThrow();
    expect(() => interpolarLms(1, [{ x: 1, ...parametros }, { x: 1, ...parametros }])).toThrow();
  });
  it('lognormal direto não faz ida e volta por percentil', () => {
    expect(escoreLognormal(Math.exp(2), 1, 0.5)).toBe(2);
  });
  it.each([0, -1, NaN, Infinity])('rejeita medida inválida %s', (valor) => {
    expect(() => escoreLms(valor, parametros)).toThrow();
    expect(() => escoreLognormal(valor, 1, 0.1)).toThrow();
  });
  it('normal padrão independente em pontos tabulados, sem 0/100 artificial', () => {
    expect(percentilNormal(0)).toEqual({ valor: 50 });
    expect(percentilNormal(1).valor).toBeCloseTo(84.1344746068543, 10);
    expect(percentilNormal(-3).valor).toBeCloseTo(0.134989803163, 10);
    expect(percentilNormal(9)).toEqual({ limite: 'acima_do_limite_numerico' });
    expect(percentilNormal(-9)).toEqual({ limite: 'abaixo_do_limite_numerico' });
    expect(() => percentilNormal(NaN)).toThrow();
  });
});
