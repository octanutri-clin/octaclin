import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaria = mkdtempSync(join(tmpdir(), 'octaclin-nutricao-plano-'));
const arquivos = ['scripts/nutricao-plano.spec.ts', 'lib/nutricao-plano.ts'];

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

const alias = join(temporaria, 'node_modules', '@', 'lib');
mkdirSync(dirname(alias), { recursive: true });
cpSync(join(temporaria, 'lib'), alias, { recursive: true });
executar(process.execPath, ['--test', join(temporaria, 'scripts', 'nutricao-plano.spec.js')], temporaria);
rmSync(temporaria, { recursive: true, force: true });
