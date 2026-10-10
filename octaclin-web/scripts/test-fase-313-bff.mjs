import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaria = mkdtempSync(join(tmpdir(), 'octaclin-fase313-bff-'));
const arquivos = [
  'scripts/fase-313-bff.spec.ts',
  'app/api/pacientes/[id]/gestacoes/[[...caminho]]/route.ts',
  'app/api/portal/paciente/gestacoes/[[...caminho]]/route.ts',
  'lib/server/sessao-bff.ts',
  'lib/server/permissoes-bff.ts',
  'lib/server/seguranca-bff.ts',
  'lib/server/mfa-bff.ts',
  'lib/server/correlacao-requisicao-bff.ts',
  'lib/server/correlacao-bff.ts',
  'lib/server/cold-start-bff.ts'
];

function executar(args, cwd = raiz) {
  const resultado = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (resultado.error) console.error(resultado.error.message);
  if (resultado.status !== 0) throw new Error(`Comando falhou: ${args.join(' ')}`);
}

try {
  writeFileSync(join(temporaria, 'tsconfig.json'), JSON.stringify({
    extends: join(raiz, 'tsconfig.json'),
    compilerOptions: { noEmit: false, outDir: temporaria, rootDir: raiz, module: 'commonjs', moduleResolution: 'node', ignoreDeprecations: '6.0', target: 'ES2022' },
    include: [], files: arquivos.map((arquivo) => join(raiz, arquivo))
  }, null, 2));
  executar([join(raiz, 'node_modules/typescript/bin/tsc'), '-p', join(temporaria, 'tsconfig.json')]);
  mkdirSync(join(temporaria, 'node_modules/next'), { recursive: true });
  writeFileSync(join(temporaria, 'node_modules/next/server.js'), `class NextResponse extends Response { static json(data, init = {}) { const headers = new Headers(init.headers ?? {}); if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json'); return new NextResponse(JSON.stringify(data), { ...init, headers }); } } module.exports = { NextResponse };`);
  writeFileSync(join(temporaria, 'node_modules/next/headers.js'), `const valores = new Map(); function cookies() { return Promise.resolve({ get(nome) { const value = valores.get(nome); return value === undefined ? undefined : { name: nome, value }; }, set(nome, value) { valores.set(nome, String(value)); }, delete(nome) { valores.delete(nome); } }); } function headers() { return Promise.resolve(new Headers()); } function __clearCookies() { valores.clear(); } module.exports = { cookies, headers, __clearCookies };`);
  const alias = join(temporaria, 'node_modules/@/lib');
  mkdirSync(dirname(alias), { recursive: true });
  cpSync(join(temporaria, 'lib'), alias, { recursive: true });
  executar(['--test', join(temporaria, 'scripts/fase-313-bff.spec.js')], temporaria);
} finally {
  rmSync(temporaria, { recursive: true, force: true });
}
