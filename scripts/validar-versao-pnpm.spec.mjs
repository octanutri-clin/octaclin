import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VERSAO_PNPM_ESPERADA,
  extrairVersoesDeConteudo,
  validarFontesDeVersao,
  validarVersoes,
} from './validar-versao-pnpm.mjs';

test('a versao esperada e exata, nao apenas major', () => {
  assert.match(VERSAO_PNPM_ESPERADA, /^\d+\.\d+\.\d+$/);
});

test('aceita packageManager exato com hash de integridade', () => {
  const versoes = extrairVersoesDeConteudo(
    'package.json',
    JSON.stringify({ packageManager: `pnpm@${VERSAO_PNPM_ESPERADA}+sha512-abc==` })
  );
  assert.deepEqual(versoes, [{ origem: 'package.json', chave: 'packageManager', versao: VERSAO_PNPM_ESPERADA }]);
});

test('rejeita packageManager apenas com major', () => {
  assert.throws(
    () => validarVersoes([{ origem: 'package.json', chave: 'packageManager', versao: '11' }]),
    (erro) => erro.message.includes('versao exata')
  );
});

test('rejeita divergencia entre fontes', () => {
  assert.throws(
    () =>
      validarVersoes([
        { origem: 'package.json', chave: 'packageManager', versao: VERSAO_PNPM_ESPERADA },
        { origem: '.github/workflows/ci.yml', chave: 'PNPM_VERSION', versao: '10.34.5' },
      ]),
    (erro) => erro.message.includes('divergem')
  );
});

test('rejeita PNPM_VERSION apenas major no workflow', () => {
  const versoes = extrairVersoesDeConteudo('.github/workflows/ci.yml', '  PNPM_VERSION: "9"\n');
  assert.throws(
    () => validarVersoes(versoes),
    (erro) => erro.message.includes('versao exata')
  );
});

test('reconhece pnpm fixado em Dockerfile', () => {
  const conteudo = `RUN corepack enable && corepack prepare pnpm@${VERSAO_PNPM_ESPERADA} --activate\n`;
  const versoes = extrairVersoesDeConteudo('octaclin-backend/Dockerfile', conteudo);
  assert.deepEqual(versoes.map((v) => v.versao), [VERSAO_PNPM_ESPERADA]);
});

test('rejeita corepack enable sem versao fixada no Dockerfile', () => {
  assert.throws(
    () => extrairVersoesDeConteudo('octaclin-web/Dockerfile', 'RUN corepack enable\n'),
    (erro) => erro.message.includes('corepack')
  );
});

test('exige que toda fonte obrigatoria declare a versao', () => {
  assert.throws(
    () => validarVersoes([], { fontesObrigatorias: ['package.json'] }),
    (erro) => erro.message.includes('nao declara')
  );
});

test('as fontes reais do repositorio concordam com a versao esperada', () => {
  assert.match(validarFontesDeVersao(), /Versao do pnpm consistente/);
});
