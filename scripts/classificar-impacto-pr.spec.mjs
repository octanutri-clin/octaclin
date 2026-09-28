import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classificarImpacto, parseNameStatus } from './classificar-impacto-pr.mjs';

const cases = [
  ['docs-only', ['README.md'], []],
  ['backend source', ['octaclin-backend/src/app.module.ts'], ['backend']],
  ['backend dependency', ['octaclin-backend/package.json'], ['backend', 'dependency_review']],
  ['backend migration', ['octaclin-backend/src/infraestrutura/banco-dados/migracoes/123-Teste.ts'], ['backend']],
  ['backend auth', ['octaclin-backend/src/modulos/auth/auth.service.ts'], ['backend']],
  ['backend RLS', ['octaclin-backend/src/infraestrutura/banco-dados/executor-tenant.ts'], ['backend']],
  ['demo API fixture', ['octaclin-backend/scripts/api-demo-local.mjs'], ['backend', 'web', 'demo']],
  ['NestJS patch', ['octaclin-backend/pnpm-lock.yaml'], ['backend', 'dependency_review']],
  ['NestJS major', ['octaclin-backend/package.json', 'octaclin-backend/pnpm-lock.yaml'], ['backend', 'dependency_review']],
  ['web source', ['octaclin-web/app/page.tsx'], ['web', 'demo']],
  ['Next.js patch', ['octaclin-web/pnpm-lock.yaml'], ['web', 'demo', 'dependency_review']],
  ['Next.js major', ['octaclin-web/package.json'], ['web', 'demo', 'dependency_review']],
  ['BFF', ['octaclin-web/app/api/pacientes/route.ts'], ['web', 'demo']],
  ['Web auth', ['octaclin-web/lib/auth.ts'], ['web', 'demo']],
  ['mobile source', ['octaclin-mobile/app/index.tsx'], ['mobile']],
  ['Expo dependency', ['octaclin-mobile/package.json'], ['mobile', 'dependency_review']],
  ['AI source', ['octaclin-ai-service/app/main.py'], ['ai']],
  ['Python dependency', ['octaclin-ai-service/requirements.lock.txt'], ['ai', 'dependency_review']],
  ['GitHub Action', ['.github/workflows/codeql.yml'], ['governance', 'security', 'dependency_review']],
  ['local GitHub Action', ['.github/actions/build/action.yml'], ['full']],
  ['semgrep', ['.github/workflows/semgrep.yml'], ['governance', 'security', 'dependency_review']],
  ['trivy', ['.github/workflows/trivy.yml'], ['governance', 'security', 'dependency_review']],
  ['CI', ['.github/workflows/ci.yml'], ['full']],
  ['detector', ['scripts/classificar-impacto-pr.mjs'], ['full']],
  ['PR Gate', ['scripts/validar-pr-gate.mjs'], ['full']],
  ['root package', ['package.json'], ['full']],
  ['pnpm workspace', ['pnpm-workspace.yaml'], ['full']],
  ['Node version', ['.node-version'], ['full']],
  ['Docker', ['octaclin-ai-service/Dockerfile'], ['ai', 'dependency_review']],
  ['backend + web', ['octaclin-backend/src/main.ts', 'octaclin-web/app/page.tsx'], ['backend', 'web', 'demo']],
  ['unknown', ['unexpected/new-format.xyz'], ['full']]
];

for (const [name, files, expected] of cases) {
  test(name, () => {
    const actual = classificarImpacto(files);
    for (const key of expected) assert.equal(actual[key], true, `${name}: ${key}`);
    if (name === 'unknown') assert.deepEqual(actual.unrecognized, files);
    if (name === 'docs-only') assert.equal(actual.full, false);
  });
}

test('rename examines both paths', () => {
  const actual = classificarImpacto(['octaclin-mobile/app/old.tsx', 'octaclin-web/app/new.tsx']);
  assert.equal(actual.mobile, true);
  assert.equal(actual.web, true);
  assert.equal(actual.demo, true);
});

test('empty or invalid input fails safe', () => {
  assert.equal(classificarImpacto([]).full, true);
  assert.equal(classificarImpacto(['../outside']).full, true);
});

test('dependency versions are classified conservatively', () => {
  const files = ['octaclin-backend/package.json'];
  const update = (to) => classificarImpacto(files, { dependencyBumps: [{ name: '@nestjs/common', from: '11.2.5', to }] }).dependency_update;
  assert.equal(update('11.2.6'), 'patch');
  assert.equal(update('11.3.0'), 'minor');
  assert.equal(update('12.0.0'), 'major');
  assert.equal(classificarImpacto(files).dependency_update, 'unknown');
});

test('CLI publishes GitHub outputs and a readable summary', () => {
  const dir = mkdtempSync(join(tmpdir(), 'octaclin-impact-'));
  try {
    const output = join(dir, 'output');
    const summary = join(dir, 'summary');
    execFileSync(process.execPath, ['scripts/classificar-impacto-pr.mjs', '--files-json', '["octaclin-mobile/package.json"]'], {
      env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary }
    });
    assert.match(readFileSync(output, 'utf8'), /mobile=true/);
    assert.match(readFileSync(output, 'utf8'), /backend=false/);
    assert.match(readFileSync(summary, 'utf8'), /Mobile Expo/);
    assert.match(readFileSync(summary, 'utf8'), /Skipped as N\/A/);
  } finally {
    rmSync(join(dir, 'output'), { force: true });
    rmSync(join(dir, 'summary'), { force: true });
    rmdirSync(dir);
  }
});

test('malformed Git status fails closed', () => {
  assert.throws(() => parseNameStatus(Buffer.from('R100\0old\0')), /truncado/);
  assert.throws(() => parseNameStatus(Buffer.from('X\0file\0')), /desconhecido/);
});

for (const [name, args] of [
  ['base SHA absent', ['--head', 'a'.repeat(40)]],
  ['invalid head SHA', ['--base', 'a'.repeat(40), '--head', 'invalid']],
  ['Git diff error', ['--base', 'a'.repeat(40), '--head', 'b'.repeat(40)]],
  ['malformed JSON', ['--files-json', '{bad']]
]) {
  test(`${name} exits nonzero`, () => {
    const run = spawnSync(process.execPath, ['scripts/classificar-impacto-pr.mjs', ...args], { encoding: 'utf8' });
    assert.notEqual(run.status, 0);
  });
}
