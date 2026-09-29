import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { classificarImpacto } from './classificar-impacto-pr.mjs';
import { validarPrGate } from './validar-pr-gate.mjs';

const base = { backend: false, web: false, mobile: false, ai: false, demo: false, full: false, governance: true, security: true, dependency_review: false, files: ['README.md'], rules: ['docs'], unrecognized: [] };
const jobs = { 'detectar-impacto': 'success', 'rollout-seguro': 'success', 'operacao-lancamento': 'success', governanca: 'success', backend: 'skipped', web: 'skipped', mobile: 'skipped', 'ai-service': 'skipped', 'demo-smoke': 'skipped' };
const check = (impact, changes) => {
  const files = impact.full ? ['.github/workflows/ci.yml'] : impact.web ? ['octaclin-web/app/page.tsx'] : impact.backend ? ['octaclin-backend/src/main.ts'] : ['README.md'];
  return validarPrGate({ ...base, files, ...impact }, { ...jobs, ...changes });
};

test('backend required success passes', () => assert.equal(check({ backend: true }, { backend: 'success' }).ok, true));
test('backend required failure fails', () => assert.equal(check({ backend: true }, { backend: 'failure' }).ok, false));
test('backend required skipped fails', () => assert.equal(check({ backend: true }, {}).ok, false));
test('backend N/A skipped passes', () => assert.equal(check({}, {}).ok, true));
test('web and demo success pass', () => assert.equal(check({ web: true, demo: true }, { web: 'success', 'demo-smoke': 'success' }).ok, true));
test('demo cancelled fails', () => assert.equal(check({ web: true, demo: true }, { web: 'success', 'demo-smoke': 'cancelled' }).ok, false));
test('detector failure fails', () => assert.equal(check({}, { 'detectar-impacto': 'failure' }).ok, false));
test('full with a skipped domain fails', () => assert.equal(check({ full: true, backend: true, web: true, mobile: true, ai: true, demo: true, dependency_review: true }, { backend: 'success', web: 'success', mobile: 'success', 'ai-service': 'skipped', 'demo-smoke': 'success' }).ok, false));
test('N/A job unexpectedly ran fails', () => assert.equal(check({}, { mobile: 'success' }).ok, false));
test('unknown result fails', () => assert.equal(check({ backend: true }, { backend: 'neutral' }).ok, false));
test('missing or invalid classification fails', () => assert.equal(validarPrGate(null, jobs).ok, false));
test('backend file cannot be declared N/A', () => assert.equal(check({ files: ['octaclin-backend/src/main.ts'] }, {}).ok, false));
test('unknown file cannot be declared docs-only', () => assert.equal(check({ files: ['unknown.bin'], unrecognized: ['unknown.bin'] }, {}).ok, false));
test('empty diff cannot be declared docs-only', () => assert.equal(check({ files: [] }, {}).ok, false));
test('unlisted dependency result cannot be ignored', () => assert.equal(check({}, { 'new-critical-job': 'failure' }).ok, false));
test('incomplete changed-file list cannot pass', () => {
  const verdict = validarPrGate({ ...base }, jobs, ['README.md', 'octaclin-backend/src/main.ts']);
  assert.equal(verdict.ok, false);
});
test('matching independently obtained diff can pass', () => {
  const verdict = validarPrGate({ ...base }, jobs, ['README.md']);
  assert.equal(verdict.ok, true);
});

test('PR Gate CLI verifies Git diff and rejects missing SHA', () => {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const impact = classificarImpacto([]);
  const allSuccess = Object.fromEntries(Object.keys(jobs).map((job) => [job, { result: 'success' }]));
  const env = { ...process.env, GITHUB_STEP_SUMMARY: '', EVENT_NAME: 'pull_request', BASE_SHA: sha, HEAD_SHA: sha, CLASSIFICATION_JSON: JSON.stringify(impact), NEEDS_JSON: JSON.stringify(allSuccess) };
  assert.equal(spawnSync(process.execPath, ['scripts/validar-pr-gate.mjs'], { env, encoding: 'utf8' }).status, 0);
  assert.notEqual(spawnSync(process.execPath, ['scripts/validar-pr-gate.mjs'], { env: { ...env, BASE_SHA: '' }, encoding: 'utf8' }).status, 0);
});

test('PR Gate names and needs cover every CI job', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const jobsBlock = workflow.split(/^jobs:\s*$/m)[1];
  assert.ok(jobsBlock);
  const jobs = [...jobsBlock.matchAll(/^  ([a-z0-9-]+):$/gm)].map((match) => match[1]);
  const gate = workflow.match(/^  pr-gate:\n([\s\S]*?)$/m);
  assert.ok(gate);
  assert.match(workflow, /^  pr-gate:\n    name: PR Gate\n    runs-on: ubuntu-latest\n    needs: \[([^\]]+)\]\n    if: always\(\)/m);
  const needs = workflow.match(/^    needs: \[([^\]]+)\]$/gm)?.at(-1)?.match(/\[([^\]]+)\]/)?.[1].split(',').map((value) => value.trim());
  assert.deepEqual([...needs].sort(), jobs.filter((job) => job !== 'pr-gate').sort());
});
