# FOOD01 — checklist de execução

Plano e contratos: [plan-pos-320-food01.md](plan-pos-320-food01.md).
Planejamento em 2026-10-17, base `d36b12e7`; implementação autorizada em
“Pode seguir”. T02–T07 implementados e validados localmente na worktree;
T08 em preparação da PR única/CI. Sem migration ou deploy externos.

- [x] T00 — merge PA07, base/worktree e gaps conferidos; D01–D03 confirmadas.
- [x] T01 — somente R017 examinado/pinado; GPL, inspiração e limites registrados.
- [x] T02 — contratos HTTP/editorial, materialização e ciclos RED/GREEN.
- [x] T03 — migration1075 aditiva, ORM/serviço, RLS/CAS/idempotência e rollback conservador.
- [x] T04 — conversão/snapshots/schema1, save editorial, preservação factual e omissão legada; cópias não transportam o descriptor privado.
- [x] T05 — PostgreSQL15 real descartável:28 PASS/29 filtrados; acesso/revogação, transferência, CAS e aplicação/desativação sob locks. Extensões do CI não cobertas localmente.
- [x] T06 — rotas BFF, editor, biblioteca CRUD, cálculo em aritmética exata,
  snapshot reaplicável, estado por contexto e Playwright desktop/mobile.
- [x] T07 — revisão manual R4 e regressões proporcionais backend/Web/BFF,
  PostgreSQL/RLS/concorrência, portal/impressão e coordenação de abas.
  Revisão própria identificada; revisão independente não executada.
- [~] T08 — relatório/documentação e gates locais concluídos; PR única e
  acompanhamento de CI do HEAD. Merge/rollout continuam ações posteriores.

## Decisões fechadas

- D01: pessoal ou da clínica; pessoal é o padrão.
- D02: equivalência explícita em gramas, sem densidade presumida.
- D03: alterações da biblioteca não atualizam itens existentes, inclusive rascunhos.

## Gates desta rodada

- PASS: merge #423 em `d36b12e7` e CI38975905269 SUCCESS reconferidos no GitHub;
  essa evidência pertence à PA07, não a uma implementação FOOD01.
- PASS: `git diff --check`, conferência dos dois links locais dos novos
  documentos e presença de D01–D03/T00–T08; `node scripts/scan-secrets.mjs`
  sem achados. Scanner documental executado no Node24 disponível, sem instalar
  dependências ou tratar esse resultado como gate runtime do projeto (Node22).
- PASS:407 testes focados backend/migration; PostgreSQL28 PASS e governança24 PASS.
- PASS finais: backend343 suítes/3086 testes, typecheck/build/artefato;
  6 suítes/127 testes SKIPPED por condições próprias da suíte. Secrets/diff
  e matriz40 referências PASS. PostgreSQL focado não substitui extensões de CI.
- PASS T06 local: typecheck Web; suíte BFF de planos alimentares45/45;
  `test:nutricao-plano`62/62; `test:authz` executado sem falhas reportadas;
  Playwright sintético FOOD01 desktop/mobile2/2, incluindo Axe no seletor,
  criação/edição/desativação e preservação do snapshot após reload. Evidência
  detalhada em [Web](../docs/governance/EVIDENCIAS_FOOD01_WEB_2026-10-17.md).
- PASS lint focado nos arquivos Web novos/helpers. Lint amplo dos arquivos
  modificados terminou sem erros; registrou avisos em
  `plano-alimentar-profissional.tsx` (hooks/refs) fora das linhas FOOD01.
- PASS integração Sol: backend407, PostgreSQL28/29 filtrados, cópias10,
  Playwright FOOD01/PA07 desktop/mobile32, rodada final FOOD01/impressão10,
  portal plural2, governança24 e matriz40 referências. Foram corrigidos com
  RED/GREEN a perda do cadastro da biblioteca no autosave e a troca de edição
  durante request. CI do HEAD continua separado dos gates locais.
- PASS finais Web: build, typecheck, lint completo sem erros (70 avisos
  existentes), APIs dinâmicas151 arquivos, segurança operacional10/10 e smoke
  de segurança sobre build de produção.
- SKIPPED: revisão independente formal, PowerShell DocsOnly local (executável
  ausente), suíte visual inteira e validação manual por leitor de tela.
- SKIPPED: ambiente externo, migration/deploy; fora do escopo desta rodada.
- SKIPPED: revisão independente; não executada.

Próxima ação: concluir T08 na PR única/CI. Sol médio é suficiente, sem troca de
modelo pendente. Não pedir outra decisão sobre D01–D03. A migration1075 deve
preceder a publicação do backend pelo runbook, em operação autorizada separada.

Evidências: [backend](../docs/governance/EVIDENCIAS_FOOD01_BACKEND_2026-10-17.md),
[Web](../docs/governance/EVIDENCIAS_FOOD01_WEB_2026-10-17.md) e
[relatório final](../docs/governance/RELATORIO_FOOD01_2026-10-17.md).
