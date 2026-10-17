# FOOD01 — checklist de execução

Plano e contratos: [plan-pos-320-food01.md](plan-pos-320-food01.md).
Planejamento em 2026-10-17, base `d36b12e7`; implementação autorizada em
“Pode seguir”. T02–T05 backend implementados; interface T06 pendente.

- [x] T00 — merge PA07, base/worktree e gaps conferidos; D01–D03 confirmadas.
- [x] T01 — somente R017 examinado/pinado; GPL, inspiração e limites registrados.
- [x] T02 — contratos HTTP/editorial, materialização e ciclos RED/GREEN.
- [x] T03 — migration1075 aditiva, ORM/serviço, RLS/CAS/idempotência e rollback conservador.
- [x] T04 — conversão/snapshots/schema1, save editorial, preservação factual e omissão legada; cópias não transportam o descriptor privado.
- [x] T05 — PostgreSQL15 real descartável:28 PASS/29 filtrados; acesso/revogação, transferência, CAS e aplicação/desativação sob locks. Extensões do CI não cobertas localmente.
- [ ] T06 — BFF/interface após handoff e confirmação manual da troca para Luna.
- [ ] T07 — regressões, segurança, acessibilidade e revisão separada quando viável.
- [ ] T08 — relatório, documentação, diff/secrets, PR única e CI do HEAD.

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
- SKIPPED: T06 BFF/UI/Axe/Playwright e CI final, antes da implementação Web.
- SKIPPED: ambiente externo, migration/deploy; fora do escopo desta rodada.
- SKIPPED: revisão independente; não executada.

Próxima ação: concluir checkpoint e, após confirmação de troca manual, T06 com
Luna alto conforme [handoff](handoff-pos-320-food01-luna.md).
Não pedir outra decisão sobre D01–D03. Não criar PR documental separada.

Evidências: [backend](../docs/governance/EVIDENCIAS_FOOD01_BACKEND_2026-10-17.md).
