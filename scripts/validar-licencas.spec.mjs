import assert from 'node:assert/strict';
import test from 'node:test';

import {
  avaliarInventario,
  carregarPolitica,
  classificarExpressao,
  validarPolitica,
} from './validar-licencas.mjs';

const politica = carregarPolitica();

test('classifica licenca simples permitida e bloqueada', () => {
  assert.equal(classificarExpressao('MIT', politica), 'permitida');
  assert.equal(classificarExpressao('AGPL-3.0-only', politica), 'bloqueada');
  assert.equal(classificarExpressao('MPL-2.0', politica), 'revisao');
});

test('OR aceita quando ao menos um operando e permitido', () => {
  assert.equal(classificarExpressao('MIT OR Apache-2.0', politica), 'permitida');
  assert.equal(classificarExpressao('(BSD-3-Clause OR GPL-2.0-only)', politica), 'permitida');
  assert.equal(classificarExpressao('GPL-3.0-only OR AGPL-3.0-only', politica), 'bloqueada');
  assert.equal(classificarExpressao('MPL-2.0 OR GPL-3.0-only', politica), 'revisao');
});

test('AND exige que todos os operandos sejam aceitaveis', () => {
  assert.equal(classificarExpressao('MIT AND Apache-2.0', politica), 'permitida');
  assert.equal(classificarExpressao('MIT AND GPL-3.0-only', politica), 'bloqueada');
  assert.equal(classificarExpressao('MIT AND MPL-2.0', politica), 'revisao');
});

test('nao usa substring ingenua', () => {
  // "GPL" aparece dentro de "LGPL" e de "AGPL": a classificacao precisa ser por token.
  assert.equal(classificarExpressao('LGPL-3.0-or-later', politica), 'revisao');
  assert.notEqual(classificarExpressao('LGPL-3.0-or-later', politica), 'bloqueada');
});

test('licenca ausente ou NOASSERTION e desconhecida, nunca aprovada em silencio', () => {
  assert.equal(classificarExpressao(undefined, politica), 'desconhecida');
  assert.equal(classificarExpressao('', politica), 'desconhecida');
  assert.equal(classificarExpressao('NOASSERTION', politica), 'desconhecida');
  assert.equal(classificarExpressao('SEE LICENSE IN LICENSE.txt', politica), 'desconhecida');
  assert.equal(classificarExpressao('licenca-que-nao-existe', politica), 'desconhecida');
});

test('inventario com licenca bloqueada reprova', () => {
  const resultado = avaliarInventario(
    [{ nome: 'pacote-copyleft', versao: '1.0.0', licenca: 'AGPL-3.0-only' }],
    politica,
    { excecoes: [] }
  );
  assert.equal(resultado.aprovado, false);
  assert.match(resultado.mensagem, /bloqueada/);
});

test('licenca de revisao obrigatoria so passa com revisao concluida para aquele pacote', () => {
  const semRevisao = avaliarInventario(
    [{ nome: 'pacote-mpl-novo', versao: '1.0.0', licenca: 'MPL-2.0' }],
    politica,
    { excecoes: [] }
  );
  assert.equal(semRevisao.aprovado, false);

  const comRevisao = avaliarInventario(
    [{ nome: 'axe-core', versao: '4.13.0', licenca: 'MPL-2.0' }],
    politica,
    { excecoes: [] }
  );
  assert.equal(comRevisao.aprovado, true);
});

test('licenca desconhecida so passa com excecao datada no ledger', () => {
  const item = [{ nome: 'pacote-sem-licenca', versao: '1.0.0', licenca: undefined }];
  assert.equal(avaliarInventario(item, politica, { excecoes: [] }).aprovado, false);
  assert.equal(
    avaliarInventario(item, politica, {
      excecoes: [{ tipo: 'license', package: 'pacote-sem-licenca', version: '1.0.0' }],
    }).aprovado,
    true
  );
});

test('inventario totalmente permitido aprova', () => {
  const resultado = avaliarInventario(
    [
      { nome: 'a', versao: '1.0.0', licenca: 'MIT' },
      { nome: 'b', versao: '2.0.0', licenca: 'Apache-2.0' },
    ],
    politica,
    { excecoes: [] }
  );
  assert.equal(resultado.aprovado, true);
});

test('a politica real do repositorio e coerente', () => {
  assert.match(validarPolitica(), /Politica de licencas coerente/);
});

test('so conta manifests em posicao real de dependencia instalada', async () => {
  const { ehPosicaoDeDependencia } = await import('./validar-licencas.mjs');
  const raiz = '/app/node_modules';
  assert.equal(ehPosicaoDeDependencia(raiz, '/app/node_modules/express', 'express'), true);
  assert.equal(ehPosicaoDeDependencia(raiz, '/app/node_modules/@scope/pkg', '@scope/pkg'), true);
  assert.equal(
    ehPosicaoDeDependencia(raiz, '/app/node_modules/.pnpm/a@1/node_modules/express', 'express'),
    true
  );
  // Arvore de teste empacotada por uma dependencia nao e dependencia instalada.
  assert.equal(
    ehPosicaoDeDependencia(
      raiz,
      '/app/node_modules/expo-modules-autolinking/node_modules_mock/@react-native-community/cli-platform-android',
      '@react-native-community/cli-platform-android'
    ),
    false
  );
});
