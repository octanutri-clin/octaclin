import { AumentarPrecisaoComposicaoAlimentar1720000001061 } from './1720000001061-AumentarPrecisaoComposicaoAlimentar';

describe('AumentarPrecisaoComposicaoAlimentar1720000001061', () => {
  it('amplia a escala dos nutrientes para preservar valores publicados', async () => {
    const executar = jest.fn(async (_sql: string) => undefined);
    await new AumentarPrecisaoComposicaoAlimentar1720000001061().up({ query: executar } as never);
    const sql = executar.mock.calls.map(([comando]) => comando).join('\n').toLowerCase();
    expect(sql).toContain('energia_kcal type numeric(16,8)');
    expect(sql).toContain('proteinas_g type numeric(16,8)');
    expect(sql).toContain('carboidratos_g type numeric(16,8)');
    expect(sql).toContain('lipidios_g type numeric(16,8)');
    expect(sql).toContain('fibras_g type numeric(16,8)');
    expect(sql).toContain('sodio_mg type numeric(16,8)');
  });

  it('verifica perda de precisão antes de reverter a escala', async () => {
    const executar = jest.fn(async (_sql: string) => undefined);
    await new AumentarPrecisaoComposicaoAlimentar1720000001061().down({ query: executar } as never);
    const sql = executar.mock.calls.map(([comando]) => comando).join('\n').toLowerCase();
    expect(sql).toContain('round(energia_kcal, 4)');
    expect(sql).toContain('round(sodio_mg, 4)');
    expect(sql).toContain('numeric(12,4)');
  });
});
