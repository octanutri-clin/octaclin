import assert from 'node:assert/strict';
import test from 'node:test';
import { projetarFalhaCadastro } from '../lib/erros-cadastro.mjs';

test('F05 mapeia campos conhecidos e aninhados, na ordem da tela, sem texto remoto', () => {
  const falha = projetarFalhaCadastro(400, { message: [
    'endereco.cep must be shorter than or equal to 12 characters',
    'email must be an email', 'email must be an email'
  ] }, 'contato');
  assert.deepEqual(falha.campos, [
    { campo: 'contato.email', mensagem: 'Informe um e-mail válido.' },
    { campo: 'contato.endereco.cep', mensagem: 'Use no máximo 12 caracteres.' }
  ]);
  assert.equal(falha.temErrosGerais, false);
});

test('F05 desconhecidos e campos não editáveis não criam links ou mensagens refletidas', () => {
  for (const mensagem of ['interno.usuario must be a string', 'documentoPagador must be a string', '__proto__ must be a string', 'email must be an email; detalhe privado']) {
    const falha = projetarFalhaCadastro(400, { message: [mensagem] }, 'fiscal');
    assert.deepEqual(falha.campos, []);
    assert.equal(falha.temErrosGerais, true);
    assert.ok(!JSON.stringify(falha).includes(mensagem));
  }
});

test('F05 preserva erro conhecido junto de erro não mapeável, sem inventar completude', () => {
  const falha = projetarFalhaCadastro(400, { message: ['email must be an email', 'interno should not exist'] }, 'contato');
  assert.equal(falha.campos.length, 1);
  assert.equal(falha.temErrosGerais, true);
});

for (const status of [401, 403, 404, 409, 429, 500, 503, undefined]) {
  test(`F05 status ${status} não é convertido em erro de campo nem reflete o payload`, () => {
    const falha = projetarFalhaCadastro(status, { message: ['email must be an email'], privado: 'conteúdo sintético' }, 'contato');
    assert.deepEqual(falha.campos, []);
    assert.ok(!JSON.stringify(falha).includes('conteúdo sintético'));
    assert.equal(falha.status, status);
  });
}

test('F05 validação aceita somente contexto de seção conhecido', () => {
  for (const secao of [undefined, 'constructor', '__proto__', 'outra']) {
    assert.deepEqual(projetarFalhaCadastro(400, { message: ['email must be an email'] }, secao).campos, []);
  }
});

test('F05 entradas malformadas e limites falham com mensagem geral segura', () => {
  for (const corpo of [null, false, [], 'texto privado', '{', 'x'.repeat(32769), { message: Array(65).fill('email must be an email') }, { message: [null] }]) {
    const falha = projetarFalhaCadastro(400, corpo, 'contato');
    assert.deepEqual(falha.campos, []);
    assert.equal(falha.temErrosGerais, true);
  }
});

test('F05 mensagens de regras existentes de telefone, fiscal, datas e etiquetas', () => {
  const casos = [
    ['contato', 'ddi must match /^\\+[1-9]\\d{0,2}$/ regular expression', 'contato.ddi'],
    ['contato', 'celular must match /^\\d{10,11}$/ regular expression', 'contato.celular'],
    ['fiscal', 'cpf must match /^\\d{11}$/ regular expression', 'fiscal.cpf'],
    ['fiscal', 'emailRecibo must be an email', 'fiscal.emailRecibo'],
    ['operacao', 'Data de proxima revisao invalida.', 'operacao.proximaRevisaoEm'],
    ['operacao', 'each value in tags must be shorter than or equal to 40 characters', 'operacao.tags'],
    ['basicos', 'nome must be shorter than or equal to 180 characters', 'basicos.nome'],
    ['identificacao', 'sexo must be one of the following values: feminino, masculino, intersexo, nao_informar', 'identificacao.sexo']
  ];
  for (const [secao, message, campo] of casos) {
    assert.equal(projetarFalhaCadastro(400, { message: [message] }, secao).campos[0]?.campo, campo);
  }
});
