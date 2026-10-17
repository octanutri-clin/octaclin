# FOOD01 — checklist de execução

Plano e contratos: [plan-pos-320-food01.md](plan-pos-320-food01.md).
Planejamento em 2026-10-17, base `d36b12e7`; implementação não iniciada.

- [x] T00 — merge PA07, base/worktree e gaps conferidos; D01–D03 confirmadas.
- [x] T01 — somente R017 examinado/pinado; GPL, inspiração e limites registrados.
- [ ] T02 — fechar DTOs/materialização; testes RED antes da correção; depende de autorização para implementar.
- [ ] T03 — migration nova, ORM/serviço; RLS/CAS/idempotência e rollback.
- [ ] T04 — conversão e snapshots, editorial/save/cópias, D03 e legado.
- [ ] T05 — PostgreSQL real descartável, acesso/revogação e concorrência.
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
- SKIPPED: testes runtime, RLS e concorrência FOOD01; código ainda não implementado.
- SKIPPED: ambiente externo, migration/deploy; fora do escopo desta rodada.
- SKIPPED: revisão independente; não executada.

Próxima ação: após autorização de implementação, executar T02 com Sol6.1 médio.
Não pedir outra decisão sobre D01–D03. Não criar PR documental separada.
