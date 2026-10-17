import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularPesoMedidaCaseira, validarMedidaCaseiraAplicada } from '../lib/medidas-caseiras-plano';

test('FOOD01 prévia usa aritmética decimal exata e arredonda uma vez para três casas', () => {
  assert.equal(calcularPesoMedidaCaseira('2,5', '25', '1'), 62.5);
  assert.equal(calcularPesoMedidaCaseira('3', '25', '2'), 37.5);
  assert.equal(calcularPesoMedidaCaseira('1', '1', '3'), 0.333);
  assert.equal(calcularPesoMedidaCaseira('1', '1,001', '2'), 0.501);
});

test('FOOD01 prévia não arredonda para dentro dos limites válidos', () => {
  assert.throws(() => calcularPesoMedidaCaseira('0,001', '0,999', '1'), /limites/);
  assert.throws(() => calcularPesoMedidaCaseira('10000', '10000', '0,001'), /limites/);
});

test('FOOD01 campos inválidos ou parciais não materializam gramas', () => {
  assert.throws(() => calcularPesoMedidaCaseira('', '25', '1'));
  assert.throws(() => calcularPesoMedidaCaseira('1,0001', '25', '1'));
  assert.throws(() => calcularPesoMedidaCaseira('NaN', '25', '1'));
  assert.throws(() => calcularPesoMedidaCaseira('1', '0', '1'));
  assert.equal(validarMedidaCaseiraAplicada({ id: '7a1bb690-b95b-4c9f-b179-06fa8e8d5030', revisao: 1, aplicacaoId: '45c4bc05-7e40-4807-9b75-df8c2e97a70c' }), true);
  assert.equal(validarMedidaCaseiraAplicada({ id: '7a1bb690-b95b-4c9f-b179-06fa8e8d5030', revisao: 0, aplicacaoId: '45c4bc05-7e40-4807-9b75-df8c2e97a70c' }), false);
});
