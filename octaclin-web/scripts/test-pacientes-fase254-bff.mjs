import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = mkdtempSync(join(tmpdir(), 'octaclin-fase254-bff-'));
function executar(comando, args, cwd = raiz) {
  const resultado = spawnSync(comando, args, { cwd, stdio: 'inherit' });
  if (resultado.status !== 0) { rmSync(pasta, { recursive: true, force: true }); process.exit(resultado.status ?? 1); }
}

writeFileSync(join(pasta, 'tsconfig.json'), JSON.stringify({
  extends: join(raiz, 'tsconfig.json'),
  compilerOptions: { noEmit: false, outDir: pasta, rootDir: raiz, module: 'commonjs', moduleResolution: 'node', ignoreDeprecations: '6.0', target: 'ES2022' },
  files: [
    'scripts/pacientes-fase254-bff.spec.ts',
    'app/api/pacientes/filtros-salvos/route.ts',
    'app/api/pacientes/filtros-salvos/[filtroId]/route.ts',
    'app/api/pacientes/verificacao-duplicidade/route.ts',
    'app/api/profissionais/[id]/route.ts',
    'lib/server/sessao-bff.ts'
  ].map((arquivo) => join(raiz, arquivo))
}, null, 2), 'utf8');
executar(process.execPath, [join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(pasta, 'tsconfig.json')]);

const next = join(pasta, 'node_modules', 'next');
mkdirSync(next, { recursive: true });
writeFileSync(join(next, 'server.js'), `class NextResponse extends Response { static json(data, init = {}) { const headers = new Headers(init.headers ?? {}); if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json'); return new NextResponse(JSON.stringify(data), { ...init, headers }); } } class NextRequest extends Request { constructor(input, init) { super(input, init); this.nextUrl = new URL(typeof input === 'string' ? input : input.url); } } module.exports = { NextRequest, NextResponse };`, 'utf8');
writeFileSync(join(next, 'headers.js'), `const armazenamento = new Map(); function cookies() { return { get(nome) { const valor = armazenamento.get(nome); return valor === undefined ? undefined : { name: nome, value: valor }; }, set(nome, valor) { armazenamento.set(nome, String(valor)); }, delete(nome) { armazenamento.delete(nome); } }; } function __setCookies(entrada) { armazenamento.clear(); for (const [nome, valor] of Object.entries(entrada)) armazenamento.set(nome, String(valor)); } function __clearCookies() { armazenamento.clear(); } module.exports = { cookies, __setCookies, __clearCookies };`, 'utf8');
const alias = join(pasta, 'node_modules', '@', 'lib');
mkdirSync(dirname(alias), { recursive: true });
cpSync(join(pasta, 'lib'), alias, { recursive: true });
executar(process.execPath, ['--test', join(pasta, 'scripts', 'pacientes-fase254-bff.spec.js')], pasta);
rmSync(pasta, { recursive: true, force: true });
