import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaria = mkdtempSync(join(tmpdir(), 'octaclin-notificacoes-bff-'));
function executar(comando, args, cwd = raiz) {
  const resultado = spawnSync(comando, args, { cwd, stdio: 'inherit' });
  if (resultado.error) console.error(resultado.error.message);
  if (resultado.status !== 0) { rmSync(temporaria, { recursive: true, force: true }); process.exit(resultado.status ?? 1); }
}
writeFileSync(join(temporaria, 'tsconfig.json'), JSON.stringify({
  extends: join(raiz, 'tsconfig.json'),
  compilerOptions: { noEmit: false, outDir: temporaria, rootDir: raiz, module: 'commonjs', moduleResolution: 'node', ignoreDeprecations: '6.0', target: 'ES2022' },
  files: [
    'scripts/notificacoes-bff.spec.ts',
    'app/api/notificacoes/preferencias/route.ts',
    'app/api/notificacoes/resumos/gerar/route.ts',
    'lib/server/sessao-bff.ts'
  ].map((arquivo) => join(raiz, arquivo))
}, null, 2), 'utf8');
executar(process.execPath, [join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(temporaria, 'tsconfig.json')]);
const next = join(temporaria, 'node_modules', 'next');
mkdirSync(next, { recursive: true });
writeFileSync(join(next, 'server.js'), `class NextResponse extends Response { static json(data, init = {}) { const headers = new Headers(init.headers ?? {}); if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json'); return new NextResponse(JSON.stringify(data), { ...init, headers }); } } module.exports = { NextResponse };`, 'utf8');
writeFileSync(join(next, 'headers.js'), `const store = new Map(); function cookies() { return { get(name) { const value = store.get(name); return value === undefined ? undefined : { name, value }; }, set(name, value) { store.set(name, String(value)); }, delete(name) { store.delete(name); } }; } function __setCookies(input) { store.clear(); for (const [name, value] of Object.entries(input)) store.set(name, String(value)); } function __clearCookies() { store.clear(); } async function headers() { return new Headers(); } module.exports = { cookies, headers, __setCookies, __clearCookies };`, 'utf8');
const alias = join(temporaria, 'node_modules', '@', 'lib');
mkdirSync(dirname(alias), { recursive: true });
cpSync(join(temporaria, 'lib'), alias, { recursive: true });
executar(process.execPath, ['--test', join(temporaria, 'scripts', 'notificacoes-bff.spec.js')], temporaria);
rmSync(temporaria, { recursive: true, force: true });
