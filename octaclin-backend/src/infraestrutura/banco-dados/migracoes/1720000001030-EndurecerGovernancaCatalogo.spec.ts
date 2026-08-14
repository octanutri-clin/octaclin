import {
  calcularHashRegistroTaco,
  EndurecerGovernancaCatalogo1720000001030
} from './1720000001030-EndurecerGovernancaCatalogo';

describe('EndurecerGovernancaCatalogo1720000001030', () => {
  it('calcula hash de registro normalizando numericos do PostgreSQL', () => {
    const base = { id: '1', codigo_origem: '1', nome: 'Arroz', energia_kcal: '128.0000' };
    expect(calcularHashRegistroTaco(base)).toBe(calcularHashRegistroTaco({ ...base, energia_kcal: '128' }));
  });

  it('declara rollback destrutivo como proibido', async () => {
    await expect(new EndurecerGovernancaCatalogo1720000001030().down()).rejects.toThrow('forward-only');
  });
});
