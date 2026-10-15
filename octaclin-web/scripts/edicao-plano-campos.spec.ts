import assert from 'node:assert/strict';
import test from 'node:test';
import { campoNumeroEdicao, percentualParaBasisPointsEdicao, interpretarNumeroEdicao, nutrientesNumericosEdicao } from '../lib/edicao-plano';

test('PA06 campo editorial preserva vazio, zero, sinal parcial e vírgula sem atribuir valor clínico', () => {
  for (const valor of ['', '-', '1,', '01.20', 0, 5]) assert.equal(campoNumeroEdicao(valor), valor);
  assert.equal(campoNumeroEdicao(null), '');
  assert.equal(interpretarNumeroEdicao(''), undefined);
  assert.equal(interpretarNumeroEdicao('-'), undefined);
  assert.equal(interpretarNumeroEdicao('0'), 0);
  assert.equal(interpretarNumeroEdicao('1,2'), 1.2);
  assert.deepEqual(nutrientesNumericosEdicao({ energiaKcal: '1,', proteinasG: '', carboidratosG: '-', gordurasG: 0 }), { energiaKcal: 1, gordurasG: 0 });
});

test('percentual vira basis points sem arredondar prescrição nem perder texto editorial', () => {
  assert.equal(percentualParaBasisPointsEdicao('1,25'), 125);
  assert.equal(percentualParaBasisPointsEdicao('0,07'), 7);
  assert.equal(percentualParaBasisPointsEdicao('1,234'), 123.4);
  assert.equal(percentualParaBasisPointsEdicao('-'), undefined);
  assert.equal(percentualParaBasisPointsEdicao(''), undefined);
});
