import {
  AtivarLegadoTacoGovernado1720000001029,
  calcularHashLegadoTaco
} from './1720000001029-AtivarLegadoTacoGovernado';

describe('AtivarLegadoTacoGovernado1720000001029', () => {
  it('normaliza tipos e ordenacao ao calcular a identidade do legado', () => {
    const hashA = calcularHashLegadoTaco([
      { codigo_origem: '2', nome: 'B', energia_kcal: null },
      { codigo_origem: '1', nome: 'A', energia_kcal: '10.0', micronutrientes: { categoria: 'Grupo' } }
    ]);
    const hashB = calcularHashLegadoTaco([
      { codigo_origem: '1', nome: 'A', energia_kcal: '10', micronutrientes: { categoria: 'Grupo' } },
      { codigo_origem: '2', nome: 'B', energia_kcal: null }
    ]);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it('nao altera uma fonte canonica que ja esteja ativa', async () => {
    const query = jest.fn(async () => [{ id: 'canonica' }]);
    await new AtivarLegadoTacoGovernado1720000001029().up({ query } as never);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('declara o rollback destrutivo como proibido', async () => {
    await expect(new AtivarLegadoTacoGovernado1720000001029().down()).rejects.toThrow('forward-only');
  });
});
