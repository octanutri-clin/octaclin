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

test('so aceita os advisories com backport local validado e escopo exato', () => {
  const resultado = avaliarAuditoria(
    {
      advisories: {
        nodeForge: {
          github_advisory_id: 'GHSA-86w9-cpqp-85rv',
          module_name: 'node-forge',
          severity: 'high',
          vulnerable_versions: '<=1.4.0',
        },
        braces: {
          github_advisory_id: 'GHSA-vfj7-8cjw-p6xm',
          module_name: 'braces',
          severity: 'high',
          vulnerable_versions: '<=3.0.3',
        },
      },
      muted: [],
      metadata: { vulnerabilities: { ...totaisZerados, high: 2 } },
    },
    { backportsValidados: true },
  );

  assert.equal(resultado.aprovado, true);
  assert.match(resultado.mensagem, /backports locais verificados/i);
  assert.match(resultado.mensagem, /aguardando correcoes upstream/i);
});

test('reprova qualquer advisory fora dos backports locais mesmo quando validados', () => {
  const resultado = avaliarAuditoria(
    {
      advisories: {
        nodeForge: {
          github_advisory_id: 'GHSA-86w9-cpqp-85rv',
          module_name: 'node-forge',
          severity: 'high',
          vulnerable_versions: '<=1.4.0',
        },
        naoMitigado: {
          github_advisory_id: 'GHSA-unknown-unknown-unknown',
          module_name: 'pacote-exemplo',
          severity: 'high',
          vulnerable_versions: '*',
        },
      },
      muted: [],
      metadata: { vulnerabilities: { ...totaisZerados, high: 2 } },
    },
    { backportsValidados: true },
  );

  assert.equal(resultado.aprovado, false);
  assert.match(resultado.mensagem, /GHSA-unknown-unknown-unknown/);
});

test('reprova contadores criticos adicionais junto dos backports locais', () => {
  const resultado = avaliarAuditoria(
    {
      advisories: {
        nodeForge: {
          github_advisory_id: 'GHSA-86w9-cpqp-85rv',
          module_name: 'node-forge',
          severity: 'high',
          vulnerable_versions: '<=1.4.0',
        },
        braces: {
          github_advisory_id: 'GHSA-vfj7-8cjw-p6xm',
          module_name: 'braces',
          severity: 'high',
          vulnerable_versions: '<=3.0.3',
        },
      },
      muted: [],
      metadata: { vulnerabilities: { ...totaisZerados, high: 2, critical: 1 } },
    },
    { backportsValidados: true },
  );

  assert.equal(resultado.aprovado, false);
});
