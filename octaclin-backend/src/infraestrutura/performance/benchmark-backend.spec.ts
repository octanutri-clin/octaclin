import { calcularPercentil, validarAlvoPerformance } from './benchmark-backend';

describe('benchmark de backend', () => {
  it('aceita banco local dedicado e exige confirmacao exata do nome', () => {
    expect(
      validarAlvoPerformance('postgresql://usuario:senha@localhost:5432/octaclin_perf', 'octaclin_perf', false)
    ).toEqual({ banco: 'octaclin_perf', remoto: false });

    expect(() =>
      validarAlvoPerformance('postgresql://usuario:senha@localhost:5432/octaclin_perf', 'outro_banco', false)
    ).toThrow('Banco de performance nao confirmado');
  });

  it('recusa producao e exige opt-in adicional para banco remoto de teste', () => {
    const remoto = 'postgresql://usuario:senha@ep-teste.neon.tech/octaclin_test_fase150b';

    expect(() => validarAlvoPerformance(remoto, 'octaclin_test_fase150b', false)).toThrow(
      'CONFIRMAR_PERFORMANCE_REMOTA=SIM'
    );
    expect(validarAlvoPerformance(remoto, 'octaclin_test_fase150b', true)).toEqual({
      banco: 'octaclin_test_fase150b',
      remoto: true
    });
    expect(() =>
      validarAlvoPerformance('postgresql://usuario:senha@ep-prod.neon.tech/Octaclin-db-producao', 'Octaclin-db-producao', true)
    ).toThrow('teste, staging, integracao ou perf');
  });

  it('calcula percentis de forma deterministica sem alterar a amostra', () => {
    const amostra = [50, 10, 40, 20, 30];

    expect(calcularPercentil(amostra, 0.5)).toBe(30);
    expect(calcularPercentil(amostra, 0.95)).toBe(50);
    expect(amostra).toEqual([50, 10, 40, 20, 30]);
  });
});
