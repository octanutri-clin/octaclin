import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pastaTemporaria = mkdtempSync(join(tmpdir(), 'octaclin-autorizacao-'));

function executar(comando, args) {
  const resultado = spawnSync(comando, args, {
    cwd: raiz,
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
  'scripts/autorizacao-rotas.spec.ts',
  'scripts/permissoes-bff.spec.ts',
  'scripts/cold-start-bff.spec.ts',
  'scripts/paleta-comandos.spec.ts',
  'lib/server/autorizacao-rotas.ts',
  'lib/server/permissoes-bff.ts',
  'lib/server/cold-start-bff.ts',
  'lib/paleta-comandos.ts'
]);

executar(process.execPath, [
  '--test',
  join(pastaTemporaria, 'scripts', 'autorizacao-rotas.spec.js'),
  join(pastaTemporaria, 'scripts', 'permissoes-bff.spec.js'),
  join(pastaTemporaria, 'scripts', 'cold-start-bff.spec.js'),
  join(pastaTemporaria, 'scripts', 'paleta-comandos.spec.js')
]);
rmSync(pastaTemporaria, { recursive: true, force: true });
