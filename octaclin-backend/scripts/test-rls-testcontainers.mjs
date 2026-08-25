import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const diretorioBackend = fileURLToPath(new URL('..', import.meta.url));
const ambiente = {
  ...process.env,
  RLS_TESTCONTAINERS: 'true'
};

for (const nome of [
  'DATABASE_URL',
  'BANCO_HOST',
  'BANCO_PORTA',
  'BANCO_USUARIO',
  'BANCO_SENHA',
  'BANCO_NOME',
  'BANCO_SSL',
  'BANCO_EXECUTAR_MIGRACOES',
  'RLS_PROVA_BANCO_HOST',
  'RLS_PROVA_BANCO_PORTA',
  'RLS_PROVA_BANCO_USUARIO',
  'RLS_PROVA_BANCO_SENHA',
  'RLS_PROVA_BANCO_NOME'
]) {
  delete ambiente[nome];
}

const argumentosJest = [
  'exec',
  'jest',
  '--runInBand',
  'src/infraestrutura/banco-dados/rls-isolamento-tenant.integracao.spec.ts'
];
const windows = process.platform === 'win32';
const comandoPnpm = windows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
const argumentos = windows
  ? ['/d', '/s', '/c', `pnpm ${argumentosJest.join(' ')}`]
  : argumentosJest;
const processo = spawn(
  comandoPnpm,
  argumentos,
  {
    cwd: diretorioBackend,
    env: ambiente,
    stdio: 'inherit',
    shell: false
  }
);

processo.once('error', (erro) => {
  console.error(`Falha ao iniciar a prova RLS com Testcontainers: ${erro.message}`);
  process.exitCode = 1;
});

processo.once('exit', (codigo, sinal) => {
  if (sinal) {
    console.error(`Prova RLS com Testcontainers interrompida pelo sinal ${sinal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = codigo ?? 1;
});
