import assert from 'node:assert/strict';
import test from 'node:test';
import { campoNumeroEdicao, percentualParaBasisPointsEdicao, interpretarNumeroEdicao, micronutrientesNumericosEdicao, nutrientesNumericosEdicao, serializarAlimentoPersonalizadoEdicao, validarMicronutrientesEdicao } from '../lib/edicao-plano';

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

test('PA06 preserva texto incompleto de micronutriente e normaliza valores válidos sem converter ausentes em zero', () => {
  assert.deepEqual(micronutrientesNumericosEdicao({ ferroMg: '1,25', calcioMg: '0', zincoMg: '-', folatoDfeMcg: '' }), {
    ferroMg: 1.25,
    calcioMg: 0
  });
  assert.equal(campoNumeroEdicao('1,'), '1,');
  assert.equal(campoNumeroEdicao(undefined), '');
  assert.deepEqual(micronutrientesNumericosEdicao({ ferroMg: '1,' }), {});
  assert.throws(() => validarMicronutrientesEdicao({ ferroMg: '1,' }), /Complete ou limpe/);
  assert.deepEqual(validarMicronutrientesEdicao({ ferroMg: '1,25' }), { ferroMg: 1.25 });
});

test('FOOD02 distingue ausência legada de desvinculação explícita e limita o descriptor serializado', () => {
  const descriptor = {
    id: '00000000-0000-4000-8000-000000000001',
    revisao: 2,
    aplicacaoId: '00000000-0000-4000-8000-000000000002'
  };
  assert.equal(serializarAlimentoPersonalizadoEdicao(undefined), undefined);
  assert.equal(serializarAlimentoPersonalizadoEdicao(null), null);
  assert.deepEqual(serializarAlimentoPersonalizadoEdicao(descriptor), descriptor);
  assert.throws(() => serializarAlimentoPersonalizadoEdicao({ ...descriptor, revisao: 0 }), /inválida/);
  assert.throws(() => serializarAlimentoPersonalizadoEdicao({ ...descriptor, id: 'não-é-uuid' }), /inválida/);
});
