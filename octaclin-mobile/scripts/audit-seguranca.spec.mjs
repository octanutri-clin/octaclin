import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { avaliarAuditoria } from './audit-seguranca-lib.mjs';

const totaisZerados = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };

test('lockfile Expo resolve releases upstream corrigidos para node-forge, glob e minimatch', () => {
  const lock = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
  assert.ok(/^  node-forge@1\.4\.(?:[3-9]|[1-9][0-9]+):/m.test(lock), 'node-forge upstream corrigido (>=1.4.3) deve estar no lockfile');
  assert.ok(/^  glob@14\.0\.2:/m.test(lock), 'glob upstream corrigido deve estar no lockfile');
  assert.ok(/^  minimatch@11\.0\.[1-9][0-9]*:/m.test(lock), 'minimatch upstream corrigido deve estar no lockfile');
  assert.ok(
    !/node-forge@1\.[0-3]\.|node-forge@1\.4\.[0-2]\b|glob@13\.0\.6|minimatch@10\.2\.6|deepmerge@4\.3\.1/.test(lock),
    'lockfile nao deve incluir releases vulneraveis nem deepmerge removido do consumidor Expo',
  );
});

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

test('so aceita o advisory braces com backport local validado e escopo exato', () => {
  const resultado = avaliarAuditoria(
    {
      advisories: {
        braces: {
          github_advisory_id: 'GHSA-vfj7-8cjw-p6xm',
          module_name: 'braces',
          severity: 'high',
          vulnerable_versions: '<=3.0.3',
        },
      },
      muted: [],
      metadata: { vulnerabilities: { ...totaisZerados, high: 1 } },
    },
    { backportsValidados: true },
  );

  assert.equal(resultado.aprovado, true);
  assert.match(resultado.mensagem, /backports locais verificados/i);
  assert.match(resultado.mensagem, /aguardando correcoes upstream/i);
});

test('node-forge upstream vulneravel nao e coberto pelo backport de braces', () => {
  const resultado = avaliarAuditoria(
    {
      advisories: {
        forge: {
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

  assert.equal(resultado.aprovado, false);
  assert.match(resultado.mensagem, /GHSA-86w9-cpqp-85rv/);
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
        braces: {
          github_advisory_id: 'GHSA-vfj7-8cjw-p6xm',
          module_name: 'braces',
          severity: 'high',
          vulnerable_versions: '<=3.0.3',
        },
      },
      muted: [],
      metadata: { vulnerabilities: { ...totaisZerados, high: 1, critical: 1 } },
    },
    { backportsValidados: true },
  );

  assert.equal(resultado.aprovado, false);
});
