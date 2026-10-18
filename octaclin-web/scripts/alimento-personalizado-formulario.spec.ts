import assert from 'node:assert/strict';
import test from 'node:test';
import { montarComposicaoAlimentoPersonalizado, montarCriacaoAlimentoPersonalizado, type FormularioAlimentoPersonalizadoApi } from '../lib/alimento-personalizado-formulario';

function formulario(parcial: Partial<FormularioAlimentoPersonalizadoApi> = {}): FormularioAlimentoPersonalizadoApi {
  return { nome: ' Arroz sintético ', preparacao: '', referenciaComposicao: '', escopo: 'pessoal', tipoBase: 'porcao', pesoGramas: '30', nutrientes: {}, micronutrientes: {}, ...parcial };
}

test('FOOD02 serializa base de origem e somente os valores preenchidos, mantendo zero explícito', () => {
  assert.deepEqual(montarComposicaoAlimentoPersonalizado(formulario({ nutrientes: { energiaKcal: '90', proteinasG: '0', fibrasG: '' }, micronutrientes: { ferroMg: '0,6', calcioMg: '' } })), {
    nome: 'Arroz sintético', base: { tipo: 'porcao', pesoGramas: 30 }, nutrientes: { energiaKcal: 90, proteinasG: 0 }, micronutrientes: { ferroMg: 0.6 }
  });
});

test('FOOD02 envia base por100g sem inferir gramas e composição parcial continua parcial', () => {
  assert.deepEqual(montarComposicaoAlimentoPersonalizado(formulario({ tipoBase: 'por100g', pesoGramas: 'qualquer', nutrientes: { energiaKcal: '12,5' } })), {
    nome: 'Arroz sintético', base: { tipo: 'por100g' }, nutrientes: { energiaKcal: 12.5 }
  });
});

test('FOOD02 rejeita número preenchido inválido em vez de omiti-lo silenciosamente', () => {
  assert.throws(() => montarComposicaoAlimentoPersonalizado(formulario({ nutrientes: { energiaKcal: '12,', proteinasG: 'abc' } })), /Energia.*número válido/);
  assert.throws(() => montarComposicaoAlimentoPersonalizado(formulario({ tipoBase: 'porcao', pesoGramas: '30,1234' })), /até três casas/);
  assert.throws(() => montarComposicaoAlimentoPersonalizado(formulario({ tipoBase: 'porcao', pesoGramas: '' })), /peso explícito/);
  assert.throws(() => montarComposicaoAlimentoPersonalizado(formulario({ nutrientes: { energiaKcal: '-1' } })), /Energia.*(número válido|não negativo)/);
});

test('FOOD02 inclui idempotência e escopo somente na criação', () => {
  const entrada = montarCriacaoAlimentoPersonalizado(formulario({ escopo: 'clinica', nutrientes: { energiaKcal: '0' } }), '00000000-0000-4000-8000-000000000001');
  assert.equal(entrada.escopo, 'clinica');
  assert.equal(entrada.chaveIdempotencia, '00000000-0000-4000-8000-000000000001');
  assert.deepEqual(entrada.nutrientes, { energiaKcal: 0 });
});
