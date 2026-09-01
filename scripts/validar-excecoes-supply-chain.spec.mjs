import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TIPOS_VALIDOS,
  validarArquivoDeExcecoes,
  validarLedger,
} from './validar-excecoes-supply-chain.mjs';

const HOJE = new Date('2026-09-01T00:00:00.000Z');

function excecao(sobrescritas = {}) {
  return {
    id: 'SC-2026-999',
    tipo: 'trustPolicy',
    componente: 'octaclin-backend',
    package: 'pacote-exemplo',
    version: '1.2.3',
    motivo: 'Versao anterior a adocao de provenance pelo mantenedor, sem indicio de takeover.',
    severidade: 'media',
    reachability: 'build-time apenas, cadeia devDependency, sem lifecycle script.',
    controlesCompensatorios: ['strictDepBuilds: true nega lifecycle script'],
    owner: 'octanutri-clin/octaclin (proprietario do repositorio)',
    createdAt: '2026-09-01',
    expiresAt: '2026-12-01',
    approvedBy: 'PR 49 da governanca de seguranca',
    source: 'docs/governance/RELATORIO_SEGURANCA_PR49_2026-09-01.md',
    condicaoDeRemocao: 'Remover quando houver versao com atestado.',
    ...sobrescritas,
  };
}

function ledger(excecoes) {
  return { versao: 1, revisadoEm: '2026-09-01', excecoes };
}

test('aceita ledger completo e dentro da validade', () => {
  assert.equal(validarLedger(ledger([excecao()]), { hoje: HOJE }), 1);
});

test('rejeita excecao sem owner', () => {
  assert.throws(
    () => validarLedger(ledger([excecao({ owner: '' })]), { hoje: HOJE }),
    (erro) => erro.message.includes('owner')
  );
});

test('rejeita excecao sem justificativa util', () => {
  assert.throws(
    () => validarLedger(ledger([excecao({ motivo: 'porque sim' })]), { hoje: HOJE }),
    (erro) => erro.message.includes('motivo')
  );
});

test('rejeita excecao sem expiracao', () => {
  assert.throws(
    () => validarLedger(ledger([excecao({ expiresAt: undefined })]), { hoje: HOJE }),
    (erro) => erro.message.includes('expiresAt')
  );
});

test('rejeita excecao vencida', () => {
  assert.throws(
    () =>
      validarLedger(ledger([excecao({ createdAt: '2026-06-01', expiresAt: '2026-08-31' })]), {
        hoje: HOJE,
      }),
    (erro) => erro.message.includes('vencida')
  );
});

test('rejeita expiracao longa demais para ser revisavel', () => {
  assert.throws(
    () => validarLedger(ledger([excecao({ expiresAt: '2030-01-01' })]), { hoje: HOJE }),
    (erro) => erro.message.includes('180 dias')
  );
});

test('rejeita wildcard amplo em version', () => {
  for (const version of ['*', '', 'x', '>=0']) {
    assert.throws(
      () => validarLedger(ledger([excecao({ version })]), { hoje: HOJE }),
      (erro) => erro.message.includes('version')
    );
  }
});

test('rejeita excecao sem analise de alcance', () => {
  assert.throws(
    () => validarLedger(ledger([excecao({ reachability: '' })]), { hoje: HOJE }),
    (erro) => erro.message.includes('reachability')
  );
});

test('rejeita excecao sem controle compensatorio', () => {
  assert.throws(
    () => validarLedger(ledger([excecao({ controlesCompensatorios: [] })]), { hoje: HOJE }),
    (erro) => erro.message.includes('controlesCompensatorios')
  );
});

test('rejeita tipo fora da taxonomia', () => {
  assert.throws(
    () => validarLedger(ledger([excecao({ tipo: 'qualquer' })]), { hoje: HOJE }),
    (erro) => erro.message.includes('tipo')
  );
  assert.ok(TIPOS_VALIDOS.includes('minimumReleaseAge'));
  assert.ok(TIPOS_VALIDOS.includes('buildScript'));
  assert.ok(TIPOS_VALIDOS.includes('exoticDependency'));
  assert.ok(TIPOS_VALIDOS.includes('license'));
  assert.ok(TIPOS_VALIDOS.includes('vulnerability'));
});

test('rejeita id duplicado', () => {
  assert.throws(
    () => validarLedger(ledger([excecao(), excecao()]), { hoje: HOJE }),
    (erro) => erro.message.includes('duplicado')
  );
});

test('rejeita estrutura invalida', () => {
  assert.throws(() => validarLedger({ excecoes: 'nenhuma' }, { hoje: HOJE }));
  assert.throws(() => validarLedger(null, { hoje: HOJE }));
});

test('o ledger real do repositorio e valido e nenhuma excecao esta vencida', () => {
  const resultado = validarArquivoDeExcecoes();
  assert.match(resultado, /Excecoes de supply chain validas/);
});
