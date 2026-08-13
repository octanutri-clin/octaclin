import assert from 'node:assert/strict';
import { avaliarRollout, validarSnapshotRollout } from './rollout-seguro.mjs';

const base = {
  healthStatus: 'ok',
  totalRequisicoes: 200,
  errosServidor: 0,
  duracaoP95Ms: 500,
  filasFalhas: 0,
  filasPendentes: 3
};

assert.equal(validarSnapshotRollout(base), true);
assert.equal(avaliarRollout(base).decisao, 'promover');
assert.equal(avaliarRollout({ ...base, totalRequisicoes: 10 }).decisao, 'observar');
assert.equal(avaliarRollout({ ...base, errosServidor: 12 }).decisao, 'rollback');
assert.equal(avaliarRollout({ ...base, healthStatus: 'falha' }).decisao, 'rollback');
assert.equal(avaliarRollout({ ...base, filasFalhas: 1 }).decisao, 'observar');
assert.throws(() => validarSnapshotRollout({ ...base, token: 'segredo' }), /campo nao permitido/i);

console.log('Contrato de rollout seguro validado.');
