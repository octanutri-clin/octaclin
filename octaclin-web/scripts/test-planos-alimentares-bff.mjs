import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaria = mkdtempSync(join(tmpdir(), 'octaclin-planos-alimentares-bff-'));
const arquivos = [
  'scripts/planos-alimentares-bff.spec.ts',
  'app/api/pacientes/[id]/planos-alimentares/_proxy.ts',
  'app/api/pacientes/[id]/planos-alimentares/route.ts',
  'app/api/pacientes/[id]/planos-alimentares/[planoId]/route.ts',
  'app/api/pacientes/[id]/planos-alimentares/[planoId]/escolhas-paciente/route.ts',
  'app/api/pacientes/[id]/planos-alimentares/alimentos/route.ts',
  'app/api/planos-alimentares/modelos/route.ts',
  'app/api/planos-alimentares/modelos/[modeloId]/route.ts',
  'app/api/planos-alimentares/receitas/route.ts',
  'app/api/planos-alimentares/receitas/[receitaId]/route.ts',
  'app/api/pacientes/[id]/planos-alimentares/[planoId]/rascunho/route.ts',
  'app/api/pacientes/[id]/planos-alimentares/[planoId]/publicacao/route.ts',
  'app/api/pacientes/[id]/planos-alimentares/[planoId]/revisao/route.ts',
  'app/api/pacientes/[id]/planos-alimentares/[planoId]/nova-versao/route.ts',
  'app/api/pacientes/[id]/planos-alimentares/[planoId]/arquivamento/route.ts',
  'lib/server/cold-start-bff.ts',
  'lib/server/permissoes-bff.ts',
  'lib/server/sessao-bff.ts'
];

function executar(comando, args, cwd = raiz) {
  const resultado = spawnSync(comando, args, { cwd, stdio: 'inherit' });
  if (resultado.error) console.error(resultado.error.message);
  if (resultado.status !== 0) {
    rmSync(temporaria, { recursive: true, force: true });
    process.exit(resultado.status ?? 1);
  }
}

writeFileSync(join(temporaria, 'tsconfig.json'), JSON.stringify({
  extends: join(raiz, 'tsconfig.json'),
  compilerOptions: {
    noEmit: false,
    outDir: temporaria,
    rootDir: raiz,
    module: 'commonjs',
    moduleResolution: 'node',
    ignoreDeprecations: '6.0',
    target: 'ES2022'
  },
  files: arquivos.map((arquivo) => join(raiz, arquivo))
}, null, 2));

executar(process.execPath, [join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(temporaria, 'tsconfig.json')]);

const pastaNext = join(temporaria, 'node_modules', 'next');
mkdirSync(pastaNext, { recursive: true });
writeFileSync(join(pastaNext, 'server.js'), `
class NextResponse extends Response {
  static json(data, init = {}) {
    const headers = new Headers(init.headers ?? {});
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return new NextResponse(JSON.stringify(data), { ...init, headers });
  }
}
module.exports = { NextResponse };
`);
writeFileSync(join(pastaNext, 'headers.js'), `
const armazenamento = new Map();
function cookies() {
  return {
    get(nome) { const valor = armazenamento.get(nome); return valor === undefined ? undefined : { name: nome, value: valor }; },
    set(nome, valor) { armazenamento.set(nome, String(valor)); },
    delete(nome) { armazenamento.delete(nome); }
  };
}
function __setCookies(entrada) { armazenamento.clear(); for (const [nome, valor] of Object.entries(entrada)) armazenamento.set(nome, String(valor)); }
function __clearCookies() { armazenamento.clear(); }
module.exports = { cookies, __setCookies, __clearCookies };
`);

const alias = join(temporaria, 'node_modules', '@', 'lib');
mkdirSync(dirname(alias), { recursive: true });
cpSync(join(temporaria, 'lib'), alias, { recursive: true });
executar(process.execPath, ['--test', join(temporaria, 'scripts', 'planos-alimentares-bff.spec.js')], temporaria);
rmSync(temporaria, { recursive: true, force: true });
