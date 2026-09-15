import assert from 'node:assert/strict';
import test from 'node:test';

import { avaliarAuditoria } from './audit-seguranca-lib.mjs';

const totaisZerados = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };

test('aprova auditoria sem vulnerabilidades nem supressoes', () => {
  const resultado = avaliarAuditoria({
    advisories: {},
    muted: [],
    metadata: { vulnerabilities: totaisZerados },
  });

  assert.deepEqual(resultado, {
    aprovado: true,
    excecoes: [],
    mensagem: 'Auditoria sem vulnerabilidades.',
  });
});

test('reprova relatorio malformado ou erro de rede', () => {
  assert.equal(avaliarAuditoria({ advisories: {} }).aprovado, false);
  assert.equal(avaliarAuditoria({ error: { message: 'indisponivel' } }).aprovado, false);
});

test('reprova qualquer advisory e informa seu identificador', () => {
  const resultado = avaliarAuditoria({
    advisories: {
      1138808: {
        id: 1138808,
        github_advisory_id: 'GHSA-w3rx-r6r6-pgpr',
        module_name: 'image-size',
        severity: 'high',
      },
    },
    muted: [],
    metadata: { vulnerabilities: { ...totaisZerados, high: 1 } },
  });

  assert.equal(resultado.aprovado, false);
  assert.deepEqual(resultado.excecoes, []);
  assert.match(resultado.mensagem, /GHSA-w3rx-r6r6-pgpr/);
});

test('reprova contadores divergentes mesmo sem advisory correspondente', () => {
  const resultado = avaliarAuditoria({
    advisories: {},
    muted: [],
    metadata: { vulnerabilities: { ...totaisZerados, high: 1 } },
  });

  assert.equal(resultado.aprovado, false);
  assert.match(resultado.mensagem, /metadados divergentes/);
});

test('reprova avisos silenciados mesmo com contadores zerados', () => {
  const resultado = avaliarAuditoria({
    advisories: {},
    muted: [{ id: 123 }],
    metadata: { vulnerabilities: totaisZerados },
  });

  assert.equal(resultado.aprovado, false);
  assert.match(resultado.mensagem, /avisos silenciados/);
});
