import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = mkdtempSync(join(tmpdir(), 'octaclin-sessoes-bff-'));

function executar(comando, args, cwd = raiz) {
  const resultado = spawnSync(comando, args, { cwd, stdio: 'inherit' });
  if (resultado.status !== 0) {
    rmSync(pasta, { recursive: true, force: true });
    process.exit(resultado.status ?? 1);
  }
}

writeFileSync(
  join(pasta, 'tsconfig.json'),
  JSON.stringify(
    {
      extends: join(raiz, 'tsconfig.json'),
      compilerOptions: {
        noEmit: false,
        outDir: pasta,
        rootDir: raiz,
        module: 'commonjs',
        moduleResolution: 'node',
        ignoreDeprecations: '6.0',
        target: 'ES2022'
      },
      files: [
        'scripts/sessoes-bff.spec.ts',
        'app/api/auth/sessoes/route.ts',
        'app/api/auth/sessoes/[referencia]/route.ts',
        'app/api/auth/sessoes/encerrar-outras/route.ts',
        'app/api/auth/sessoes/encerrar-todas/route.ts',
        'app/api/auth/sessoes/historico/route.ts',
        'lib/server/sessao-bff.ts'
      ].map((arquivo) => join(raiz, arquivo))
    },
    null,
    2
  ),
  'utf8'
);
executar(process.execPath, [join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(pasta, 'tsconfig.json')]);

const next = join(pasta, 'node_modules', 'next');
mkdirSync(next, { recursive: true });
writeFileSync(
  join(next, 'server.js'),
  `class NextResponse extends Response { static json(data, init = {}) { const headers = new Headers(init.headers ?? {}); if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json'); return new NextResponse(JSON.stringify(data), { ...init, headers }); } } class NextRequest extends Request { constructor(input, init) { super(input, init); this.nextUrl = new URL(typeof input === 'string' ? input : input.url); } } module.exports = { NextRequest, NextResponse };`,
  'utf8'
);
// O mock guarda tambem as opcoes do cookie: sem isso nao da para provar
// HttpOnly, SameSite, Secure e a validade gravada pelo BFF.
writeFileSync(
  join(next, 'headers.js'),
  `const armazenamento = new Map(); const opcoes = new Map(); function cookies() { return { get(nome) { const valor = armazenamento.get(nome); return valor === undefined ? undefined : { name: nome, value: valor }; }, set(nome, valor, config) { armazenamento.set(nome, String(valor)); opcoes.set(nome, config ?? {}); }, delete(nome) { armazenamento.delete(nome); opcoes.delete(nome); } }; } function __setCookies(entrada) { armazenamento.clear(); opcoes.clear(); for (const [nome, valor] of Object.entries(entrada)) armazenamento.set(nome, String(valor)); } function __clearCookies() { armazenamento.clear(); opcoes.clear(); } function __opcoesCookie(nome) { return opcoes.get(nome); } module.exports = { cookies, __setCookies, __clearCookies, __opcoesCookie };`,
  'utf8'
);

const alias = join(pasta, 'node_modules', '@', 'lib');
mkdirSync(dirname(alias), { recursive: true });
cpSync(join(pasta, 'lib'), alias, { recursive: true });

executar(process.execPath, ['--test', join(pasta, 'scripts', 'sessoes-bff.spec.js')], pasta);
rmSync(pasta, { recursive: true, force: true });
