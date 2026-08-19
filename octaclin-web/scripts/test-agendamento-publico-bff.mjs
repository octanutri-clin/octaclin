import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pastaTemporaria = mkdtempSync(join(tmpdir(), 'octaclin-agendamento-bff-'));
const tsconfigTemporario = join(pastaTemporaria, 'tsconfig.json');

const arquivos = [
  'scripts/agendamento-publico-bff.spec.ts',
  'app/api/agendamentos-publicos/[token]/route.ts',
  'app/api/agendamentos-publicos/[token]/solicitacoes/route.ts',
  'app/api/formularios/[token]/rascunho/route.ts',
  'app/api/agenda/agendamento-publico/route.ts',
  'app/api/agenda/agendamento-publico/rotacionar/route.ts',
  'app/api/agenda/solicitacoes/route.ts',
  'lib/server/agendamento-publico-bff.ts',
  'lib/server/permissoes-bff.ts',
  'lib/server/sessao-bff.ts'
];

function executar(comando, args, cwd = raiz) {
  const resultado = spawnSync(comando, args, {
    cwd,
    stdio: 'inherit'
  });

  if (resultado.error) {
    console.error(resultado.error.message);
  }

  if (resultado.status !== 0) {
    rmSync(pastaTemporaria, { recursive: true, force: true });
    process.exit(resultado.status ?? 1);
  }
}

function escreverStubsNext() {
  const pastaNext = join(pastaTemporaria, 'node_modules', 'next');
  mkdirSync(pastaNext, { recursive: true });

  writeFileSync(
    join(pastaNext, 'server.js'),
    `
class NextResponse extends Response {
  static json(data, init = {}) {
    const headers = new Headers(init.headers ?? {});
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return new NextResponse(JSON.stringify(data), { ...init, headers });
  }
}

class NextRequest extends Request {
  constructor(input, init) {
    super(input, init);
    this.nextUrl = new URL(typeof input === 'string' ? input : input.url);
  }
}

module.exports = { NextRequest, NextResponse };
`,
    'utf8'
  );

  writeFileSync(
    join(pastaNext, 'headers.js'),
    `
const armazenamento = new Map();

function cookies() {
  return {
    get(nome) {
      const valor = armazenamento.get(nome);
      return valor === undefined ? undefined : { name: nome, value: valor };
    },
    set(nome, valor) {
      armazenamento.set(nome, String(valor));
    },
    delete(nome) {
      armazenamento.delete(nome);
    }
  };
}

function __setCookies(entrada) {
  armazenamento.clear();
  for (const [nome, valor] of Object.entries(entrada)) {
    armazenamento.set(nome, String(valor));
  }
}

function __getCookies() {
  return Object.fromEntries(armazenamento.entries());
}

function __clearCookies() {
  armazenamento.clear();
}

module.exports = { cookies, __setCookies, __getCookies, __clearCookies };
`,
    'utf8'
  );
}

function prepararAliasArroba() {
  const destino = join(pastaTemporaria, 'node_modules', '@', 'lib');
  mkdirSync(dirname(destino), { recursive: true });
  cpSync(join(pastaTemporaria, 'lib'), destino, { recursive: true });
}

writeFileSync(
  tsconfigTemporario,
  JSON.stringify(
    {
      extends: join(raiz, 'tsconfig.json'),
      compilerOptions: {
        noEmit: false,
        outDir: pastaTemporaria,
        rootDir: raiz,
        module: 'commonjs',
        moduleResolution: 'node',
        ignoreDeprecations: '6.0',
        target: 'ES2022'
      },
      files: arquivos.map((arquivo) => join(raiz, arquivo))
    },
    null,
    2
  ),
  'utf8'
);

executar(process.execPath, [join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', tsconfigTemporario]);
escreverStubsNext();
prepararAliasArroba();
executar(process.execPath, ['--test', join(pastaTemporaria, 'scripts', 'agendamento-publico-bff.spec.js')], pastaTemporaria);
rmSync(pastaTemporaria, { recursive: true, force: true });
