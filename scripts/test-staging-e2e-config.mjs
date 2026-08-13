import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const workflow = readFileSync(resolve(raiz, '.github', 'workflows', 'staging-e2e-mutavel.yml'), 'utf8');
const runner = readFileSync(resolve(raiz, 'octaclin-web', 'scripts', 'e2e-staging-mutavel.mjs'), 'utf8');
const preparador = readFileSync(
  resolve(raiz, 'octaclin-backend', 'src', 'infraestrutura', 'e2e', 'preparar-ambiente-staging-e2e.ts'),
  'utf8'
);
const preflight = readFileSync(
  resolve(raiz, 'octaclin-backend', 'src', 'infraestrutura', 'e2e', 'validar-ambiente-staging-e2e.ts'),
  'utf8'
);

assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m, 'workflow mutavel deve ser somente manual');
assert.doesNotMatch(workflow, /^\s+(push|pull_request):/m, 'jornada mutavel nao pode rodar automaticamente em push/PR');
assert.match(workflow, /neondatabase\/create-branch-action@v5/);
assert.match(workflow, /neondatabase\/delete-branch-action@v3/);
assert.match(workflow, /if: always\(\).*steps\.neon\.outputs\.branch_id/);
assert.match(workflow, /username: neondb_owner/);
assert.match(workflow, /NEON_E2E_RUNTIME_ROLE/);
assert.match(workflow, /ARMAZENAMENTO_S3_FORCE_PATH_STYLE: "true"/);
assert.match(workflow, /OCTACLIN_PROCESSO: web/);
assert.doesNotMatch(workflow, /octaclin-backend-producao|Octaclin-db-producao|octaclin_app_producao/i);

for (const termo of ['paciente', 'consulta', 'convite', 'questionario', 'anexos', 'comunicacoes']) {
  assert.ok(runner.includes(termo), `runner E2E nao cobre ${termo}`);
}
assert.match(runner, /tokenBeta/);
assert.match(runner, /status: 404/);
assert.match(preparador, /rolbypassrls/);
assert.match(preparador, /grant select, insert, update, delete on all tables/);
assert.match(preflight, /tabelasVisiveisSemTenant: 0/);
assert.match(preflight, /relforcerowsecurity/);
