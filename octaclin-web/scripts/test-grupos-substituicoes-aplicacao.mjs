import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaria = mkdtempSync(join(tmpdir(), 'octaclin-food04-ui-'));
const arquivos = ['scripts/grupos-substituicoes-aplicacao.spec.ts', 'lib/aplicacao-grupo-substituicoes.ts'];
try {
  writeFileSync(join(temporaria, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'commonjs', moduleResolution: 'node', strict: true, esModuleInterop: true, skipLibCheck: true, noEmit: false, outDir: temporaria, rootDir: raiz, ignoreDeprecations: '6.0', types: ['node'], typeRoots: [join(raiz, 'node_modules', '@types')] },
    files: arquivos.map((arquivo) => join(raiz, arquivo))
  }));
  const compilado = spawnSync(process.execPath, [join(raiz, 'node_modules/typescript/bin/tsc'), '-p', join(temporaria, 'tsconfig.json')], { stdio: 'inherit' });
  if (compilado.status !== 0) process.exitCode = compilado.status ?? 1;
  else {
    const testes = spawnSync(process.execPath, ['--test', join(temporaria, 'scripts/grupos-substituicoes-aplicacao.spec.js')], { stdio: 'inherit' });
    process.exitCode = testes.status ?? 1;
  }
} finally {
  rmSync(temporaria, { recursive: true, force: true });
}
