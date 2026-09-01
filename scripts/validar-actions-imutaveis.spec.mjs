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

// PR 49 introduziu tres referencias novas. O gate precisa reconhece-las pelo
// SHA completo, e recusa-las se alguem trocar por tag mutavel.
for (const [nome, referencia] of [
  ['dependency-review', 'actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294 # v5.0.0'],
  ['attest-build-provenance', 'actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2'],
  ['download-artifact', 'actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7'],
]) {
  test(`aceita a action nova do PR 49 fixada por SHA: ${nome}`, () => {
    assert.equal(validarConteudoWorkflow(`steps:\n  - uses: ${referencia}`), 1);
  });

  test(`rejeita a mesma action nova por tag mutavel: ${nome}`, () => {
    const porTag = `${referencia.split('@')[0]}@v5`;
    assert.throws(
      () => validarConteudoWorkflow(`steps:\n  - uses: ${porTag}`, 'mutavel.yml'),
      (erro) => erro instanceof Error && erro.message.includes('SHA completo de 40 caracteres')
    );
  });
}

test('todos os workflows reais obedecem a politica', () => {
  assert.match(validarWorkflows(), /Actions imutaveis validas/);
});
