import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pastaTemporaria = mkdtempSync(join(tmpdir(), 'octaclin-importacao-pacientes-'));

function executar(comando, args, cwd = raiz) {
  const resultado = spawnSync(comando, args, { cwd, stdio: 'inherit' });
  if (resultado.error) console.error(resultado.error.message);
  if (resultado.status !== 0) {
    rmSync(pastaTemporaria, { recursive: true, force: true });
    process.exit(resultado.status ?? 1);
  }
}

writeFileSync(join(pastaTemporaria, 'tsconfig.json'), JSON.stringify({
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
  files: [
    'scripts/importacao-pacientes.spec.ts',
    'lib/cadastros-api.ts',
    'lib/importacao-pacientes-anexos.ts',
    'lib/mobile-api.ts'
  ].map((arquivo) => join(raiz, arquivo))
}, null, 2), 'utf8');

executar(process.execPath, [join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(pastaTemporaria, 'tsconfig.json')]);
executar(process.execPath, ['--test', join(pastaTemporaria, 'scripts', 'importacao-pacientes.spec.js')], pastaTemporaria);
rmSync(pastaTemporaria, { recursive: true, force: true });
