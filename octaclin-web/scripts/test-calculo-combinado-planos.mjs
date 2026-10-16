import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaria = mkdtempSync(join(tmpdir(), 'octaclin-pa06-selecao-'));
function executar(comando, args) {
  const resultado = spawnSync(comando, args, { cwd: raiz, stdio: 'inherit' });
  if (resultado.status !== 0) { rmSync(temporaria, { recursive: true, force: true }); process.exit(resultado.status ?? 1); }
}
executar(process.execPath, [join(raiz, 'node_modules/typescript/bin/tsc'), '--ignoreConfig', '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--ignoreDeprecations', '6.0', '--types', 'node', '--esModuleInterop', '--skipLibCheck', '--outDir', temporaria,
  'scripts/calculo-combinado-planos.spec.ts', 'lib/calculo-combinado-planos.ts', 'lib/plano-alimentar-api.ts']);
executar(process.execPath, ['--test', join(temporaria, 'scripts/calculo-combinado-planos.spec.js')]);
rmSync(temporaria, { recursive: true, force: true });
