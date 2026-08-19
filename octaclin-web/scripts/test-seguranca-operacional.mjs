import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pastaTemporaria = mkdtempSync(join(tmpdir(), 'octaclin-seguranca-operacional-'));

function executar(comando, args) {
  const resultado = spawnSync(comando, args, { cwd: raiz, stdio: 'inherit' });
  if (resultado.error) console.error(resultado.error.message);
  if (resultado.status !== 0) {
    rmSync(pastaTemporaria, { recursive: true, force: true });
    process.exit(resultado.status ?? 1);
  }
}

executar(process.execPath, [
  join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'),
  '--ignoreConfig',
  '--target',
  'ES2022',
  '--module',
  'commonjs',
  '--moduleResolution',
  'node',
  '--ignoreDeprecations',
  '6.0',
  '--types',
  'node',
  '--esModuleInterop',
  '--skipLibCheck',
  '--outDir',
  pastaTemporaria,
  'scripts/seguranca-operacional.spec.ts',
  'lib/server/seguranca-bff.ts'
]);

executar(process.execPath, [
  '--test',
  join(pastaTemporaria, 'scripts', 'seguranca-operacional.spec.js')
]);

const nextConfig = readFileSync(join(raiz, 'next.config.mjs'), 'utf8');
const middleware = readFileSync(join(raiz, 'middleware.ts'), 'utf8');
const smokesNode = [
  readFileSync(join(raiz, 'scripts', 'smoke-e2e-bff.mjs'), 'utf8'),
  readFileSync(join(raiz, 'scripts', 'smoke-ui-regression.mjs'), 'utf8')
];
const rotaRollout = readFileSync(join(raiz, 'app', 'api', 'operacoes', 'rollout', 'route.ts'), 'utf8');
const rotaFeatureFlags = readFileSync(join(raiz, 'app', 'api', 'operacoes', 'feature-flags', 'route.ts'), 'utf8');
const rotaFeatureFlagsTenant = readFileSync(
  join(raiz, 'app', 'api', 'operacoes', 'feature-flags', '[tenantId]', 'route.ts'),
  'utf8'
);
for (const cabecalho of [
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy'
]) {
  assert.match(nextConfig, new RegExp(cabecalho), `Header global ausente: ${cabecalho}`);
}
assert.match(nextConfig, /source:\s*['"]\/:path\*['"]/, 'Headers devem cobrir toda a aplicacao.');
assert.match(nextConfig, /NODE_ENV\s*===\s*['"]development['"]/, 'unsafe-eval deve ficar restrito ao desenvolvimento.');
assert.match(middleware, /origemMutacaoPermitida\(request\)/, 'Middleware deve validar a origem das mutacoes.');
assert.match(middleware, /['"]\/api\/:path\*['"]/, 'Middleware deve cobrir todas as rotas BFF.');
for (const smoke of smokesNode) {
  assert.match(smoke, /Sec-Fetch-Site['"]?:\s*['"]same-origin['"]/, 'Smoke Node deve representar mutacao do navegador.');
  assert.match(smoke, /Origin:/, 'Smoke Node deve informar a origem oficial nas mutacoes.');
}
assert.match(rotaRollout, /requisitarBackendAutenticado\(['"]\/operacoes\/rollout['"]\)/, 'Rollout deve exigir sessao BFF.');
for (const rota of [rotaFeatureFlags, rotaFeatureFlagsTenant]) {
  assert.match(
    rota,
    /exigirPermissaoBff\(['"]operacoes\.tenants\.gerenciar['"]\)/,
    'Feature flags devem exigir permissao administrativa no BFF.'
  );
}

rmSync(pastaTemporaria, { recursive: true, force: true });
console.log('Seguranca operacional BFF: contrato aprovado.');
