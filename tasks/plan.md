# Handoff — Fase 309: implementação e validações

## Branch / objetivo

Branch `feature/fase-309-preferencias-notificacoes`, base `1dec202f` (PR #385,
Fase 308 MERGED, confirmado no GitHub em 2026-10-09). Worktree:
`/workspace/octaclin/.worktrees/feature-fase-309-preferencias-notificacoes`.
Uma branch contém planejamento + implementação. PR da 309 ainda pendente de
abertura; não houve merge.

Implementar preferências próprias para classes opcionais, digest interno e
e-mail opt-in, preservando avisos obrigatórios, destinatários e isolamento.
Plano completo e decisões: [PLANO_FASE_309.md](../docs/history/phases/PLANO_FASE_309.md).
Sequência executável: [todo.md](todo.md).

## Implementado

- Merge 308 reconfirmado e documentação de estado reconciliada nesta branch.
- Mapeados writer transacional, destinatários, índice dedup, RLS, serviço,
  controlador, sino, BFFs, transporte SMTP/Gmail e gates web/worker.
- Snapshots prospectivos, geração transacional com lock do usuário, agregação,
  DTO mínimo, marcação de resumos, preferências protegidas e cancelamento.
- Migration aditiva 1065, entidades, constraints/FKs compostas, índices e FORCE
  RLS registrados no TypeORM. `down` recusa rollback destrutivo.
- Processador gated por worker/all usa o AdaptadorEmailSmtp; claim persistido,
  opt-in e destinatário resolvidos no backend, sem retry incerto.
- BFFs no-store, página protegida, API/UI, mock da demo local, harness BFF,
  Playwright desktop/mobile + axe e prova concorrente Postgres incluídos.
- Nenhuma migration fora do banco descartável, e-mail real ou deploy executado.

## Decisões implementadas

- Obrigatórios: mensagens, solicitações de agendamento e falhas de envio.
- Opcionais: formulários respondidos, tarefas concluídas e automações executadas;
  imediato/diário/semanal/silenciado. Padrão imediato; alterações prospectivas.
- Resumo gerado no próximo acesso após 09h diária ou segunda 09h, no fuso escolhido;
  junta períodos vencidos com datas reais. E-mail opt-in enviado após essa geração.
- Uma tentativa externa; entrega incerta não é reenviada.
- Desligar e-mail cancela envios não iniciados e eventos ainda não resumidos;
  reativar vale só para novos eventos. Modos/fusos/resumos internos preservados.

Contrato, estados, riscos e rollback detalhados em
`docs/history/phases/PLANO_FASE_309.md`. Não há perguntas pendentes.

## Validações deste ciclo

- PASS: Node 22.23.3/pnpm 11.25.0; backend typecheck/build; Jest integral: 267
  suítes e 2.416 testes passaram (3 suítes/40 testes ignorados). Playwright
  Fase 309: 6/6 desktop/mobile, incluindo axe; Web lint/typecheck/build;
  harness BFF, scanner secrets, inventário, confiabilidade, guardas, migration
  governance e tooling de agentes.
- PASS: CI pós-merge 308 `37987983251`, Semgrep `37987983322`, Trivy
  `37987983323` e CodeQL `37987983326`, todos `success` sobre base `1dec202f`.
- PASS: `test:authz` integral, incluindo o harness BFF da Fase 309.
- FAIL (ambiente): PostgreSQL Testcontainers excedeu 180s no hook `beforeAll`
  sem iniciar container. RLS, migration em PostgreSQL real e concorrência não
  foram validados; o teste não conta como PASS.
- SKIPPED/NA: provider, staging/produção, envio real e aplicação fora de banda;
  migration 1065 não foi aplicada a banco operacional. Nenhum alvo consultado.
- Monitor produção `37977323201`: FAIL em saúde externa; causa não diagnosticada
  e sem vínculo demonstrado com a fase. Não declarar aceite de produção.

## Arquivos e commits

Planejamento: `docs/history/phases/PLANO_FASE_309.md`, `tasks/plan.md`,
`tasks/todo.md`. Reconciliação: status, checklist, resumo, roadmap e adendo ao
plano histórico 308. Código integrado de referência: merge `1dec202f`.
Commits de planejamento: `4682e964` e `c9f700d2`. Os arquivos de implementação
estão no working tree até a criação do commit final e PR; conferir `git status`,
diff, testes finais e estado remoto antes de atualizar esta seção.

## Próxima ação

Concluir os checks pendentes, revisar o diff, atualizar evidências, commitar,
fazer push da branch e abrir uma PR. Não mesclar. R4: revisão independente e
aplicação da migration fora de banda são gates separados; produção não é
aprovada por mocks ou CI.
