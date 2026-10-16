import { MICRONUTRIENTES, decimalParaEscala8, somarEscala8, criarSnapshotMicronutrientes, validarMicronutrientesManuais } from './micronutrientes';

describe('micronutrientes factuais versionados', () => {
  it('define 22 códigos e separa RE/RAE/retinol, NE/niacina e DFE', () => {
    expect(Object.keys(MICRONUTRIENTES)).toHaveLength(22);
    expect(MICRONUTRIENTES.retinolMcg.unidade).toBe('mcg');
    expect(MICRONUTRIENTES.vitaminaAReMcg.qualificador).toBe('RE');
    expect(MICRONUTRIENTES.vitaminaARaeMcg.qualificador).toBe('RAE');
    expect(MICRONUTRIENTES.niacinaNeMg.qualificador).toBe('NE');
    expect(MICRONUTRIENTES.folatoDfeMcg.qualificador).toBe('DFE');
  });

  it.each([
    ['0', 0n], ['0.1', 10000000n], ['0.000000004', 0n],
    ['0.000000005', 1n], ['1.234567895', 123456790n], ['1e-8', 1n]
  ])('normaliza decimal %s por half-up em escala8', (valor, esperado) => {
    expect(decimalParaEscala8(valor)).toBe(esperado);
  });

  it.each([-1, NaN, Infinity, 'não numérico', '-0.1', '1e999'])('recusa decimal inválido %s', valor => {
    expect(() => decimalParaEscala8(valor)).toThrow();
  });

  it('soma frações sem depender da ordem e recusa overflow técnico', () => {
    expect(somarEscala8([0.1, 0.2, 0.3])).toBe(0.6);
    expect(somarEscala8([0.3, 0.2, 0.1])).toBe(0.6);
    expect(() => somarEscala8([90071992, 90071992])).toThrow('Limite');
  });

  it('aplica base e porção uma vez e preserva zero conhecido e ausência', () => {
    const snapshot = criarSnapshotMicronutrientes({ ferroMg: { estado: 'conhecido', valor: 2 }, calcioMg: { estado: 'conhecido', valor: 0 } }, 100, 50);
    expect(snapshot).toMatchObject({ schemaVersao: 1, mapeamentoVersao: 'octaclin-micronutrientes-v1', baseGramasOrigem: 100, porcaoGramas: 50 });
    expect(snapshot.nutrientes.ferroMg).toEqual({ estado: 'conhecido', valorOrigem: 2, por100g: 2, porcao: 1 });
    expect(snapshot.nutrientes.calcioMg.porcao).toBe(0);
    expect(snapshot.nutrientes.selenioMcg).toEqual({ estado: 'ausente' });
    expect(criarSnapshotMicronutrientes({ ferroMg: { estado: 'conhecido', valor: 2 } }, 10, 50).nutrientes.ferroMg.porcao).toBe(10);
  });

  it.each([
    [0.000000004, 100, 10000, 0.0000004],
    [1.234567895, 100, 200, 2.46913579],
    [1, 3, 3, 1]
  ])('arredonda somente após aplicar base/porção (%s, %s, %s)', (valor, base, porcao, esperado) => {
    const snapshot = criarSnapshotMicronutrientes({ ferroMg: { estado: 'conhecido', valor } }, base, porcao);
    expect(snapshot.nutrientes.ferroMg.porcao).toBe(esperado);
    expect(snapshot.nutrientes.ferroMg.valorOrigem).toBe(valor);
  });

  it('mantém traço e erro de um nutriente sem apagar outro válido', () => {
    const snapshot = criarSnapshotMicronutrientes({ ferroMg: { estado: 'traco' }, calcioMg: { estado: 'conhecido', valor: NaN }, zincoMg: { estado: 'conhecido', valor: 1 } }, 100, 200);
    expect(snapshot.nutrientes.ferroMg).toEqual({ estado: 'traco' });
    expect(snapshot.nutrientes.calcioMg).toEqual({ estado: 'invalido' });
    expect(snapshot.nutrientes.zincoMg.porcao).toBe(2);
  });

  it('recusa overflow da porção em vez de transformá-lo em ausência', () => {
    expect(() => criarSnapshotMicronutrientes({ ferroMg: { estado: 'conhecido', valor: 10_000_000 } }, 100, 10_000)).toThrow('Limite');
  });
  it('valida entrada manual sem aceitar código, unidade ou objeto arbitrários', () => {
    expect(validarMicronutrientesManuais({ ferroMg: 0, vitaminaCMg: 3 })).toEqual({ ferroMg: 0, vitaminaCMg: 3 });
    for (const valor of [{ desconhecido: 1 }, { ferroMg: -1 }, { ferroMg: null }, { ferroMg: '1' }, [], { ferroMg: { unidade: 'mg', valor: 1 } }]) {
      expect(() => validarMicronutrientesManuais(valor)).toThrow();
    }
    expect(() => criarSnapshotMicronutrientes({}, 0, 50)).toThrow();
    expect(() => criarSnapshotMicronutrientes({}, 100, Infinity)).toThrow();
  });
});
