# Fase 309 — Checklist executável

Plano autoritativo: `docs/history/phases/PLANO_FASE_309.md`.
Branch/worktree e evidências: `tasks/plan.md`.

## Planejamento — Sol médio

- [x] Confirmar merge 308/base e criar branch dedicada.
- [x] Mapear código, destinatários, dados, BFF, e-mail e checks.
- [x] Confirmar obrigatórios/opcionais, digest interno + e-mail, geração por
  acesso e preferências prospectivas com proprietário.
- [x] Especificar contratos, algoritmo, migration, rollback e matriz de testes.
- [x] Reconciliar estado da 308 nos documentos vigentes.
- [x] Registrar respostas finais de e-mail no plano/handoff.
- [x] Revisar diff e links; registrar estado observado do CI pós-merge 308
  (run `37987983251` e scanners pós-merge em `success`).
- [x] Salvar rascunho de planejamento na branch; plano/código na mesma PR futura.
- [x] Avisar e pausar para troca manual a GPT-6 Luna alto.

## Implementação — Luna alto após troca

- [x] 1. Reconfirmar branch, base, Git, instruções, runtime e decisões fechadas.
  TDD de política pura, enum/modos, classes obrigatórias, fuso e vencimento.
  Criar helpers em `modulos/notificacoes/dominio/` e seus testes.
- [x] 2. Testar e criar migration 1065 (número livre), entidades de
  preferências/resumos e snapshots em notificacoes; registrar em opcoes-typeorm
  e módulo. Constraints/FKs compostas, índices e FORCE RLS. Spec de migration
  passou; prova Postgres/Testcontainers ainda pendente no ambiente atual.
- [x] 3. Serviço de preferências/DTO/controlador; writer busca preferências em
  lote, snapshot prospectivo e dedup atual. Regressões de callers e rollback.
- [x] 4. Geração transacional por POST, trava usuário, agregação no banco,
  vínculo único, DTO/contagens, leitura e marcação. Teste real concorrente em
  duas conexões continua condicionado ao resultado do Testcontainers.
- [x] 5. Transporte existente e intenção durável de e-mail, processador com gate
  worker, opt-in/destinatário/claim e cancelamento conforme contrato fechado. Sem envio real.
- [x] 6. BFFs no-store/harness dedicado + test:authz; página própria protegida,
  componente de preferências, API/tipos e sino com resumo/link. Atualizar demo
  mock e interceptações globais por path/método; CSRF/401/403/DTO mínimo.
- [x] 7. Playwright focado desktop/mobile + axe, reflow e estados/retry;
  preferência salva, obrigatórios fixos, resumo/contador/marcação, estado e-mail.
- [ ] 8. Jest focado/integral, backend typecheck/build; Web lint/typecheck/build;
  Playwright e harnesses dedicados. PostgreSQL real bloqueado pelo Testcontainers
  (`beforeAll` >180s sem container); `test:authz` integral passou, inclusive o harness dedicado. O item continua
  aberto somente pelo gate PostgreSQL real de RLS/concorrência.
- [x] 9. Atualizar matriz de confiabilidade, plano/handoff e documentos de estado
  para implementação/PR. Procedimento de rollout/rollback aditivo registrado no plano.
- [x] 10. Commit `835b5c46`, push da branch e PR #386 em draft, com evidências
  e gates R4/PostgreSQL pendentes explícitos. Não mergear até revisão e CI/gates.

## Evidências locais observadas neste ciclo

- PASS: backend typecheck/build; Jest integral: 267 suítes, 2.416 testes
  passaram (3 suítes e 40 testes ignorados); specs focadas de notificações e
  migration 1065.
- PASS: Web lint/typecheck/build; Playwright Fase 309 desktop/mobile (6/6),
  incluindo axe; harness BFF dedicado incluído no `test:authz`.
- PASS: `security:secrets`, `test:migracoes-fora-de-banda`,
  `test:guardas-controladores`, `test:tooling-agentes`, `test:confiabilidade`,
  `git diff --check` e sintaxe do mock local.
- PASS: `test:authz` integral, incluindo notificações BFF (4/4).
- FAIL (ambiente): Testcontainers no teste RLS/concorrência excedeu 180s em
  `beforeAll`, sem iniciar container. Rodar com PostgreSQL real no gate CI antes
  de considerar migration, RLS e concorrência comprovados.
- SKIPPED/NA: envio real, provider, staging/produção e aplicação fora de banda
  da migration. Nenhum ambiente operacional foi consultado ou alterado.

## Gates externos separados

- [ ] Revisão independente R4.
- [ ] Ambiente/banco/branch/role owner identificados antes de aplicar migration.
- [ ] Ensaio e aplicação 1065 fora de banda, confirmação após aplicação.
- [ ] Aceite operacional e prova do provider em ambiente autorizado, se pedido.

Nenhum gate acima marcado implica deploy, produção aprovada ou envio real.
Não abrir PR documental isolada nem iniciar Fase 310 nesta tarefa.
