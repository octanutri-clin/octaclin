import test from 'node:test';
import assert from 'node:assert/strict';
import { criarAlternativasAplicadasGrupo, prepararOpcoesAplicacaoGrupo, type AlternativaAplicacaoGrupo } from '../lib/aplicacao-grupo-substituicoes';

const entradas: AlternativaAplicacaoGrupo[] = [
  { entradaId: 'a', origem: 'catalogo', alimentoId: 'food-a', revisao: 2, descricao: 'Aveia', quantidade: 30, unidade: 'g', porcaoGramas: 30, nutrientesPor100g: { energiaKcal: 100 } },
  { entradaId: 'b', origem: 'catalogo', alimentoId: 'food-b', descricao: 'Banana', quantidade: 80, unidade: 'g', porcaoGramas: 80, nutrientesPor100g: { energiaKcal: 90 } },
  { entradaId: 'c', origem: 'custom', alimentoId: 'food-c', descricao: 'Pão', quantidade: 1, unidade: 'unidade', porcaoGramas: 45, nutrientesPor100g: {} }
];

test('prévia exclui o alimento principal e distingue existente de porção divergente', () => {
  const opcoes = prepararOpcoesAplicacaoGrupo(entradas, [
    { origem: 'catalogo', alimentoComposicaoId: 'food-a', porcaoGramas: 30 },
    { origem: 'catalogo', alimentoId: 'food-b', porcaoGramas: 70 }
  ], { origem: 'custom', alimentoId: 'food-c' });
  assert.deepEqual(opcoes.map(({ entradaId, estado }) => [entradaId, estado]), [['a', 'existente'], ['b', 'porcao-divergente']]);
});

test('prévia detecta duplicatas dentro do próprio grupo por identidade e peso em gramas', () => {
  const repetidas = [entradas[0], { ...entradas[0], entradaId: 'a2', quantidade: 30, unidade: 'porção', porcaoGramas: 30 }, { ...entradas[0], entradaId: 'a3', porcaoGramas: 45 }];
  const opcoes = prepararOpcoesAplicacaoGrupo(repetidas, [], { origem: 'custom', alimentoId: 'outro' });
  assert.deepEqual(opcoes.map((opcao) => opcao.estado), ['nova', 'existente', 'porcao-divergente']);
});

test('aplica somente seleção, com chave nova, porção explícita e bloqueio de paciente', () => {
  const opcoes = prepararOpcoesAplicacaoGrupo(entradas, [], { origem: 'catalogo', alimentoId: 'outro' });
  const resultado = criarAlternativasAplicadasGrupo(opcoes, new Set(['b']), { b: 72.5 }, {
    grupoId: 'g', revisao: 3, aplicacaoId: 'apply'
  }, () => 'new-key');
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].alimentoId, 'food-b');
  assert.equal(resultado[0].porcaoGramas, 72.5);
  assert.equal(resultado[0].chaveCliente, 'new-key');
  assert.equal(resultado[0].preferida, false);
  assert.equal(resultado[0].liberadaParaPaciente, false);
});

test('porção distinta exige intenção explícita e porções inválidas são rejeitadas', () => {
  const opcao = prepararOpcoesAplicacaoGrupo(entradas, [{ origem: 'catalogo', alimentoId: 'food-b', porcaoGramas: 40 }], { origem: 'catalogo', alimentoId: 'outro' }).find((item) => item.entradaId === 'b')!;
  assert.throws(() => criarAlternativasAplicadasGrupo([opcao], new Set(['b']), { b: 80 }, { grupoId: 'g', revisao: 1, aplicacaoId: 'a' }, () => 'k'), /Confirme explicitamente/);
  const resultado = criarAlternativasAplicadasGrupo([opcao], new Set(['b']), { b: 80 }, { grupoId: 'g', revisao: 1, aplicacaoId: 'a' }, () => 'k', new Set(['b']));
  assert.equal(resultado[0].origemGrupo.confirmarPorcaoDistinta, true);
  assert.throws(() => criarAlternativasAplicadasGrupo([opcao], new Set(['b']), { b: 80.1234 }, { grupoId: 'g', revisao: 1, aplicacaoId: 'a' }, () => 'k', new Set(['b'])), /porções válidas/);
});
