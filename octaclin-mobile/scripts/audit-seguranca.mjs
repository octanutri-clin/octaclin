import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { avaliarAuditoria } from './audit-seguranca-lib.mjs';

const windows = process.platform === 'win32';
const comando = windows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
const argumentos = windows ? ['/d', '/s', '/c', 'pnpm audit --json'] : ['audit', '--json'];
const resultado = spawnSync(comando, argumentos, {
  cwd: process.cwd(),
  encoding: 'utf8',
});

if (resultado.error || !resultado.stdout) {
  console.error('Nao foi possivel executar pnpm audit.', resultado.error?.message ?? resultado.stderr);
  process.exit(1);
}

let relatorio;
try {
  relatorio = JSON.parse(resultado.stdout);
} catch (erro) {
  console.error('A saida de pnpm audit nao e JSON valido.', erro.message);
  process.exit(1);
}

if (![0, 1].includes(resultado.status)) {
  console.error(`pnpm audit terminou com status inesperado: ${resultado.status}.`);
  process.exit(1);
}

const advisoryIds = Object.values(relatorio.advisories ?? {}).map(
  (advisory) => advisory.github_advisory_id ?? advisory.id,
);
const exigeBackportsLocais = advisoryIds.some((id) =>
  ['GHSA-86w9-cpqp-85rv', 'GHSA-vfj7-8cjw-p6xm'].includes(id),
);

let backportsValidados = false;
if (exigeBackportsLocais) {
  const lockfile = readFileSync(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8');
  const patchesConfigurados =
    /^  braces@3\.0\.3: [a-f0-9]{64}$/m.test(lockfile) &&
    /^  node-forge@1\.4\.0: [a-f0-9]{64}$/m.test(lockfile);
  const provas = patchesConfigurados
    ? spawnSync(process.execPath, ['--test', 'scripts/backports-seguranca.spec.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8',
      })
    : null;
  backportsValidados = provas?.status === 0;
  if (!backportsValidados) {
    console.error('Backports locais ausentes ou reprovados nos testes de regressao.');
    if (provas?.stdout) console.error(provas.stdout);
    if (provas?.stderr) console.error(provas.stderr);
  }
}

const avaliacao = avaliarAuditoria(relatorio, { backportsValidados });
const prefixo = avaliacao.excecoes.length > 0 ? 'ATENCAO' : 'OK';
console.log(`${prefixo}: ${avaliacao.mensagem}`);

if (!avaliacao.aprovado) process.exit(1);
