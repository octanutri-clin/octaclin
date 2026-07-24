import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const runbook = readFileSync(resolve(raiz, 'RUNBOOK_PRODUCAO_ISOLADA.md'), 'utf8');
const controle = readFileSync(resolve(raiz, 'PRODUCAO_ISOLADA_CONTROLE.md'), 'utf8');

const secoesRunbookObrigatorias = [
  '# OctaClin - Runbook de producao isolada de staging',
  '## Recursos a criar',
  '## Ordem recomendada de execucao',
  '## Validacao do ambiente novo',
  '## Regras que nao podem ser quebradas',
  '## Como decidir que a producao isolada esta pronta'
];

for (const secao of secoesRunbookObrigatorias) {
  assert.ok(runbook.includes(secao), `secao obrigatoria ausente no runbook: ${secao}`);
}

const recursosObrigatorios = [
  'Banco Neon de producao',
  'Redis Upstash de producao',
  'Render backend de producao',
  'Render web de producao'
];

for (const recurso of recursosObrigatorios) {
  assert.ok(runbook.includes(recurso), `recurso obrigatorio ausente no runbook: ${recurso}`);
}

const termosObrigatoriosRunbook = [
  'pnpm seed:staging',
  'migration:run',
  'RUNBOOK_STAGING_DADOS.md',
  'RUNBOOK_ROTACAO_SECRETS.md',
  'RUNBOOK_BACKUP_RESTORE.md',
  'CHECKLIST_GO_LIVE.md',
  'PRODUCAO_ISOLADA_CONTROLE.md'
];

for (const termo of termosObrigatoriosRunbook) {
  assert.ok(runbook.includes(termo), `termo operacional ausente no runbook: ${termo}`);
}

const secoesControleObrigatorias = [
  '# OctaClin - Controle da producao isolada de staging',
  '## Status atual',
  '## Recursos a criar',
  '## Registro de execucao',
  '## Validacoes pendentes antes do aceite',
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

console.log('Validacao documental da producao isolada OK.');
