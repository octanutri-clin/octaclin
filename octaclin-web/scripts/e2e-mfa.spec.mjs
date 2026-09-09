import assert from 'node:assert/strict';
import test from 'node:test';

import { aguardarProximoPeriodoTotp, gerarCodigoTotp } from './e2e-mfa.mjs';

test('gera TOTP SHA-1 de seis digitos conforme o vetor RFC 6238', () => {
  const segredoRfcBase32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  assert.equal(gerarCodigoTotp(segredoRfcBase32, 59_000), '287082');
});

test('recusa segredo TOTP que nao esteja em Base32', () => {
  assert.throws(() => gerarCodigoTotp('segredo-invalido', 59_000), /Base32/);
});

test('aguarda a proxima janela antes de reutilizar uma conta entre suites', async () => {
  let esperaObservada;
  const esperaMs = await aguardarProximoPeriodoTotp({
    agora: () => 59_000,
    esperar: async (milissegundos) => { esperaObservada = milissegundos; },
  });

  assert.equal(esperaMs, 1_250);
  assert.equal(esperaObservada, 1_250);
});
