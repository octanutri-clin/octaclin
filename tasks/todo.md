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
- [ ] Registrar respostas finais de e-mail no plano/handoff.
- [ ] Revisar diff e links; registrar estado final do CI pós-merge 308.
- [x] Salvar rascunho de planejamento na branch; plano/código na mesma PR futura.
- [ ] Avisar e pausar para troca manual a GPT-6 Luna alto.

## Implementação — Luna alto após troca

- [ ] 1. Reconfirmar branch, base, Git, instruções, runtime e decisões fechadas.
  TDD de política pura, enum/modos, classes obrigatórias, fuso e vencimento.
  Criar helpers em `modulos/notificacoes/dominio/` e seus testes.
- [ ] 2. Testar e criar migration 1065 (reconfirmar número livre), entidades de
  preferências/resumos e snapshots em notificacoes; registrar em opcoes-typeorm
  e módulo. Constraints/FKs compostas, índices e FORCE RLS. PostgreSQL real.
- [ ] 3. Serviço de preferências/DTO/controlador; writer busca preferências em
  lote, snapshot prospectivo e dedup atual. Regressões de callers e rollback.
- [ ] 4. Geração transacional por POST, trava usuário, agregação no banco,
  vínculo único, DTO/contagens, leitura e marcação. Provar duas conexões e
  rollback em PostgreSQL descartável; não aceitar mock como prova concorrente.
- [ ] 5. Transporte existente e intenção durável de e-mail, processador com gate
  worker, opt-in/destinatário/claim conforme contrato fechado. Sem envio real.
- [ ] 6. BFFs no-store/harness dedicado + test:authz; página própria protegida,
  componente de preferências, API/tipos e sino com resumo/link. Atualizar demo
  mock e interceptações globais por path/método; CSRF/401/403/DTO mínimo.
- [ ] 7. Playwright focado desktop/mobile + axe, reflow e estados/retry;
  preferência salva, obrigatórios fixos, resumo/contador/marcação, estado e-mail.
- [ ] 8. Jest focado/migration e integral; backend typecheck/build; Web
  lint/typecheck/build; authz/harness; PostgreSQL; gates proporcionais do plano.
  Diff/scanner. Registrar PASS/FAIL/NA/SKIPPED e limitações sem falso verde.
- [ ] 9. Atualizar matriz de confiabilidade, plano/handoff e documentos de estado
  para implementação/PR. Acrescentar procedimento de rollout e rollback aditivo.
- [ ] 10. Commit/push e uma PR com R4, evidências, gates pendentes e revisão humana.
  Aguardar CI aplicável, resolver falhas; não mudar inventário para mascará-las.

## Gates externos separados

- [ ] Revisão independente R4.
- [ ] Ambiente/banco/branch/role owner identificados antes de aplicar migration.
- [ ] Ensaio e aplicação 1065 fora de banda, confirmação após aplicação.
- [ ] Aceite operacional e prova do provider em ambiente autorizado, se pedido.

Nenhum gate acima marcado implica deploy, produção aprovada ou envio real.
Não abrir PR documental isolada nem iniciar Fase 310 nesta tarefa.
