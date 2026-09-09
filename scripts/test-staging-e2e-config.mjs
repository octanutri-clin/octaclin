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
assert.match(
  workflow,
  /neondatabase\/create-branch-action@72ed4f69a12b6be9c16aebfad893f6a21e9aba8b # v6\.4\.0/
);
assert.match(
  workflow,
  /neondatabase\/delete-branch-action@4468d825d5a88ef4012f1705a82f02ec3072f776 # v3/
);
assert.match(workflow, /if: always\(\).*steps\.neon\.outputs\.branch_id/);
assert.match(workflow, /role: neondb_owner/);
assert.match(workflow, /NEON_E2E_RUNTIME_ROLE/);
assert.match(workflow, /ARMAZENAMENTO_S3_FORCE_PATH_STYLE: "true"/);
assert.match(workflow, /OCTACLIN_PROCESSO: web/);
assert.match(workflow, /APP_AMBIENTE: test/);
assert.match(workflow, /Gerar segredo MFA sintetico efemero/);
assert.match(workflow, /::add-mask::\$E2E_MFA_TOTP_SECRET/);
assert.match(workflow, /E2E_MFA_TOTP_SECRET=\$E2E_MFA_TOTP_SECRET/);
assert.doesNotMatch(workflow, /octaclin-backend-producao|Octaclin-db-producao|octaclin_app_producao/i);

for (const termo of ['paciente', 'consulta', 'convite', 'questionario', 'anexos', 'comunicacoes']) {
  assert.ok(runner.includes(termo), `runner E2E nao cobre ${termo}`);
}
assert.match(runner, /tokenBeta/);
assert.match(runner, /status: 404/);
assert.match(preparador, /rolbypassrls/);
assert.match(preparador, /grant select, insert, update, delete on all tables/);
assert.match(preparador, /MfaFatorUsuarioOrm/);
assert.match(preparador, /E2E_MFA_TOTP_SECRET/);
assert.match(preparador, /ultimoContadorTotp: '0'/);
assert.match(preflight, /tabelasVisiveisSemTenant: 0/);
assert.match(preflight, /relforcerowsecurity/);
