import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const runbook = readFileSync(resolve(raiz, 'RUNBOOK_PILOTO_INTERNO.md'), 'utf8');
const controle = readFileSync(resolve(raiz, 'PILOTO_INTERNO_CONTROLE.md'), 'utf8');

const secoesRunbookObrigatorias = [
  '# OctaClin - Runbook de piloto interno controlado',
  '## Quem participa',
  '## Perfis a testar',
  '## Jornadas a executar',
  '## Como registrar bugs',
  '## Criterios de sucesso',
  '## Criterios de bloqueio',
  '## Como decidir aceite do piloto'
];

for (const secao of secoesRunbookObrigatorias) {
  assert.ok(runbook.includes(secao), `secao obrigatoria ausente no runbook: ${secao}`);
}

const perfisObrigatorios = ['Cliente', 'Profissional', 'Paciente', 'Suporte/operador'];
for (const perfil of perfisObrigatorios) {
  assert.ok(runbook.includes(perfil), `perfil obrigatorio ausente no runbook: ${perfil}`);
}

const termosObrigatoriosRunbook = [
  'octaclin-staging',
  'RUNBOOK_STAGING_DADOS.md',
  'RUNBOOK_SUPORTE.md',
  'RUNBOOK_BACKUP_RESTORE.md',
  'RUNBOOK_ROTACAO_SECRETS.md',
  'CHECKLIST_GO_LIVE.md',
  'pnpm test:e2e:criticas',
  'PILOTO_INTERNO_CONTROLE.md'
];

for (const termo of termosObrigatoriosRunbook) {
  assert.ok(runbook.includes(termo), `termo operacional ausente no runbook: ${termo}`);
}

const secoesControleObrigatorias = [
  '# OctaClin - Controle do piloto interno controlado',
  '## Status atual',
  '## Participantes',
  '## Checklist de jornadas executadas',
  '## Registro de bugs',
  '## Decisao de aceite'
];

for (const secao of secoesControleObrigatorias) {
  assert.ok(controle.includes(secao), `secao obrigatoria ausente no controle: ${secao}`);
}

const padroesProibidos = [
  /EAAY[A-Za-z0-9_-]{20,}/,
  /sk-proj-[A-Za-z0-9_-]{20,}/,
  /postgres(?:ql)?:\/\/[^<\s]+:[^<\s]+@/i,
  /redis:\/\/[^<\s]+:[^<\s]+@/i,
  /rediss:\/\/[^<\s]+:[^<\s]+@/i
];

for (const padrao of padroesProibidos) {
  assert.equal(padrao.test(runbook), false, `runbook contem possivel secret: ${padrao}`);
  assert.equal(padrao.test(controle), false, `controle contem possivel secret: ${padrao}`);
}
