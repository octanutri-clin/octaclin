import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaria = mkdtempSync(join(tmpdir(), 'octaclin-copia-refeicoes-'));
const arquivos = ['scripts/copia-refeicoes-plano.spec.ts', 'lib/copia-refeicoes-plano.ts'];

function executar(comando, args, cwd = raiz) {
  const resultado = spawnSync(comando, args, { cwd, stdio: 'inherit' });
  if (resultado.error) console.error(resultado.error.message);
  if (resultado.status !== 0) {
    rmSync(temporaria, { recursive: true, force: true });
    process.exit(resultado.status ?? 1);
  }
}

writeFileSync(join(temporaria, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    module: 'commonjs',
    moduleResolution: 'node',
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: false,
    outDir: temporaria,
    rootDir: raiz,
    baseUrl: raiz,
    paths: { '@/*': ['./*'] },
    ignoreDeprecations: '6.0',
    types: ['node'],
    typeRoots: [join(raiz, 'node_modules', '@types')]
  },
  files: arquivos.map((arquivo) => join(raiz, arquivo))
}, null, 2));

executar(process.execPath, [join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(temporaria, 'tsconfig.json')]);
const alias = join(temporaria, 'node_modules', '@', 'lib');
mkdirSync(dirname(alias), { recursive: true });
cpSync(join(temporaria, 'lib'), alias, { recursive: true });
executar(process.execPath, ['--test', join(temporaria, 'scripts', 'copia-refeicoes-plano.spec.js')], temporaria);
rmSync(temporaria, { recursive: true, force: true });
