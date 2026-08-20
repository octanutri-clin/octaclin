import { spawnSync } from 'node:child_process';

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

const avaliacao = avaliarAuditoria(relatorio);
const prefixo = avaliacao.excecoes.length > 0 ? 'ATENCAO' : 'OK';
console.log(`${prefixo}: ${avaliacao.mensagem}`);

if (!avaliacao.aprovado) process.exit(1);
