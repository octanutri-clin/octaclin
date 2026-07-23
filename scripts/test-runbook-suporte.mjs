import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const runbook = readFileSync(resolve(raiz, 'RUNBOOK_SUPORTE.md'), 'utf8');

const secoesObrigatorias = [
  '# OctaClin - Runbook de suporte',
  '## Triagem inicial',
  '## Login',
  '## Convites',
  '## Recuperacao de senha',
  '## WhatsApp',
  '## Email',
  '## Agenda',
  '## Escalonamento'
];

for (const secao of secoesObrigatorias) {
  assert.ok(runbook.includes(secao), `secao obrigatoria ausente: ${secao}`);
}

const termosObrigatorios = [
  'requestId',
  '/health/detalhado',
  '/operacoes',
  'RUNBOOK_ROTACAO_SECRETS.md',
  'RUNBOOK_BACKUP_RESTORE.md',
  'nunca solicitar senha'
];

for (const termo of termosObrigatorios) {
  assert.ok(runbook.includes(termo), `termo operacional ausente: ${termo}`);
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
}
