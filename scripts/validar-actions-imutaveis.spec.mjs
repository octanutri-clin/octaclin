import assert from 'node:assert/strict';
import test from 'node:test';

import { validarConteudoWorkflow, validarWorkflows } from './validar-actions-imutaveis.mjs';

const sha = '0123456789abcdef0123456789abcdef01234567';

test('aceita action remota com SHA completo e versao documentada', () => {
  assert.equal(validarConteudoWorkflow(`steps:\n  - uses: actions/checkout@${sha} # v7`), 1);
});

test('aceita referencia remota entre aspas sem perder o comentario', () => {
  assert.equal(validarConteudoWorkflow(`steps:\n  - uses: "actions/checkout@${sha}" # v7`), 1);
});

test('aceita action local sem revisao remota', () => {
  assert.equal(validarConteudoWorkflow('steps:\n  - uses: ./actions/validar'), 1);
});

for (const referencia of ['actions/checkout@v7', 'actions/checkout@main', 'actions/checkout@0123456']) {
  test(`rejeita referencia mutavel ou abreviada: ${referencia}`, () => {
    assert.throws(
      () => validarConteudoWorkflow(`steps:\n  - uses: ${referencia}`, 'inseguro.yml'),
      (erro) => erro instanceof Error && erro.message.includes('SHA completo de 40 caracteres')
    );
  });
}

test('rejeita SHA sem comentario de versao para manutencao automatizada', () => {
  assert.throws(
    () => validarConteudoWorkflow(`steps:\n  - uses: actions/checkout@${sha}`, 'sem-versao.yml'),
    (erro) => erro instanceof Error && erro.message.includes('comentario de versao')
  );
});

test('rejeita sintaxe inline que poderia escapar da validacao da referencia', () => {
  assert.throws(
    () => validarConteudoWorkflow(`steps:\n  - { uses: actions/checkout@${sha} }`, 'inline.yml'),
    (erro) => erro instanceof Error && erro.message.includes('deve ocupar uma linha propria')
  );
});

test('todos os workflows reais obedecem a politica', () => {
  assert.match(validarWorkflows(), /Actions imutaveis validas/);
});
