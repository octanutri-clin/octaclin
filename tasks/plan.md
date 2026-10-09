# Handoff — Fase 309: planejamento e análise de gaps

## Branch / objetivo

Branch `feature/fase-309-preferencias-notificacoes`, base `1dec202f` (PR #385,
Fase 308 MERGED, confirmado no GitHub em 2026-10-09). Worktree:
`/workspace/octaclin/.worktrees/feature-fase-309-preferencias-notificacoes`.
Uma branch e uma PR para planejamento + implementação. Ainda sem PR da 309.

Implementar preferências próprias para classes opcionais, digest interno e
e-mail opt-in, preservando avisos obrigatórios, destinatários e isolamento.
Plano completo e decisões: [PLANO_FASE_309.md](../docs/history/phases/PLANO_FASE_309.md).
Sequência executável: [todo.md](todo.md).

## Concluído

- Merge 308 reconfirmado e documentação de estado reconciliada nesta branch.
- Mapeados writer transacional, destinatários, índice dedup, RLS, serviço,
  controlador, sino, BFFs, transporte SMTP/Gmail e gates web/worker.
- Fixados snapshots prospectivos, geração transacional por usuário,
  contratos, migration aditiva prevista 1065, DTO mínimo, rollback e testes.
- Definidos checkpoints para o Luna executar uma etapa por vez sem refazer gaps.
- Nenhum código funcional, migration, e-mail real ou deploy executado.

## Decisões ainda pendentes

Respostas solicitadas ao proprietário para momento de envio por e-mail,
tentativa externa incerta e cancelamento de e-mail ao desligar opt-in.
Manter planejamento ativo no Sol até registrar essas respostas no plano.
Não iniciar partes dependentes nem tratar sugestão como aprovação.

## Validações deste ciclo

- PASS: `git diff --check`, `pnpm security:secrets`, matriz de confiabilidade,
  allowlist/tooling de agentes, redação de auditoria (24 testes).
- Ambiente dos checks editoriais: Node 24.19.0/pnpm 11.19.0; o repositório
  requer Node 22/pnpm 11.25.0. Não usar estes resultados como build/runtime
  validado. Sucessor configura as versões declaradas antes dos checks de código.
- NA: testes/build de comportamento da 309, pois só há planejamento/documentos.
- SKIPPED: PostgreSQL, provider, staging/produção e envio real; nenhum alvo
  autorizado/consultado. Migration 1065 prevista, não criada nem aplicada.
- CI pós-merge 308 `37987983251`: em andamento, Demo local smoke pendente;
  demais jobs observados PASS. Semgrep `37987983322`, Trivy `37987983323`,
  CodeQL `37987983326` PASS sobre `1dec202f`. Reconsultar antes de implementar.
- Monitor produção `37977323201`: FAIL em saúde externa; causa não diagnosticada
  e sem vínculo demonstrado com a fase. Não declarar aceite de produção.

## Arquivos e commits

Planejamento: `docs/history/phases/PLANO_FASE_309.md`, `tasks/plan.md`,
`tasks/todo.md`. Reconciliação: status, checklist, resumo, roadmap e adendo ao
plano histórico 308. Código integrado de referência: merge `1dec202f`.
Rascunho salvo no commit de planejamento da branch (consultar `git log -1`).
Ainda há decisões pendentes; não considerar handoff liberado para implementação.
Sucessor confere `git status`, `git log`, diff e PR antes de escrever.

## Próxima ação exata e troca de modelo

Registrar respostas pendentes, revisar plano e confirmar estado do CI.
Só então avisar e pausar para troca manual a **GPT-6 Luna alto**.
O Luna começa pelos testes de política e calendário do item 1 do checklist;
implementa até a PR/checks/revisão, seguindo os checkpoints. Não refaz a auditoria
nem reabre decisões aprovadas. R4: revisão independente e aplicação de migration
fora de banda são gates separados; não aprovar produção por mocks ou CI.
