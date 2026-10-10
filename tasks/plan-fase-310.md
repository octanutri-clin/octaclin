# Handoff — Fase 310: planejar → implementar

## Branch e estado

- Branch: `feature/fase-310-receitas-compartilhadas`, criada de `origin/main`
  no merge `34d186ec` da Fase 309.
- Worktree: `/workspace/octaclin/.worktrees/feature-fase-310-receitas-compartilhadas`.
- PR #388 aberta em rascunho. Commit inicial `ad03225a`; implementação em
  revisão, sem aplicação de migration ou deploy.
- Plano funcional/gaps: `docs/history/phases/PLANO_FASE_310.md`.
- Checklist da implementação: `tasks/todo-fase-310.md`.

## Objetivo

Adicionar categorias pesquisáveis à biblioteca de receitas e compartilhar com
um paciente escolhido uma versão revisada imutável, disponível apenas no portal
autenticado, com retirada e trilha redigida de leitura.

## Concluído no planejamento

- [x] Confirmar PR #386 merged, merge `34d186ec`; CI da PR #386 completo.
- [x] Inspecionar biblioteca e serviço de receitas (Fase 234), modelos,
  materiais e envios ao paciente, portal, BFFs, sessão, auditoria, RLS e
  permissões.
- [x] Mapear fluxo reutilizável e lacunas: receitas são sobrescritas, não têm
  categoria e não têm envio ao paciente; material educativo não preserva
  snapshot de conteúdo nutricional.
- [x] Propor snapshot cifrado, envio individual, escopo de carteira, abertura
  explícita no portal, retirada, auditoria sem conteúdo e filtros por categoria.
- [x] Separar bloqueador operacional da 309: migration 1065 continua sem prova
  de aplicação fora de banda; CI PostgreSQL/Testcontainers não substitui isso.
- [x] Criar branch/worktree isolada a partir de `origin/main`.

## Decisões solicitadas ao proprietário

Já decidido: categorias livres por clínica e apenas internas; snapshot imutável
com novo envio explícito; opt-in de aviso de receita por canal, separado das
preferências gerais e desligado por padrão; profissional inicia e escolhe
canais permitidos; lote explícito com confirmação, até 10 receitas para um
paciente por ação; envio imediato ou agendado; avisos externos genéricos com
receita apenas no portal; push real nesta fase. Revalidar opt-in, canal,
contato e janela no despacho. Push atual é placeholder; implementar
subscription autenticada, worker e adaptador reais.

## Arquivos de planejamento

- `docs/history/phases/PLANO_FASE_310.md`
- `tasks/plan-fase-310.md`
- `tasks/todo-fase-310.md`

## Próxima ação exata

1. Executar os testes focados de compartilhamento, contratos BFF e PWA, além
   de PostgreSQL Testcontainers/RLS e governance da migration, antes de
   considerar pronta para sair do modo draft.
2. Repetir typecheck/build no runtime suportado Node 22 (a validação deste
   ciclo rodou em Node 24.19.0) e realizar revisão R4 independente.
3. Não aplicar migration fora de banda sem banco/branch/role owner confirmados.

## Evidências e limites

- CI Fase 309 PR #386: run `37998012799` concluído; todos os checks
  consultados passaram, `Provenance do SBOM` `SKIPPED`.
- Backend integral: 267 suítes/2.416 testes aprovados; RLS Testcontainers
  21/21, no ciclo de correção que antecedeu o merge.
- Migration 1065 em banco operacional: `SKIPPED`/não confirmada.
- Revisão R4 formal na PR 386: não registrada na lista de reviews do GitHub.
- Envio real, rollout ou estado de produção: não executados nem inferidos.
- Fase 310: backend e web typecheck/build, auditoria de dependências, scan de
  segredos, validador de licenças e `git diff --check` passaram no Node
  24.19.0. Lint direcionado da web terminou sem erros, com três avisos React
  já existentes na superfície clínica alterada. Os testes próprios da Fase
  310, RLS/PostgreSQL e Playwright não foram executados; estão pendentes e não
  são tratados como aprovados.
- Push restringe endpoints aos provedores conhecidos; compartilhamento envia
  a versão revisada e revalida sob lock; repetição idempotente com canais,
  horário ou versões diferentes retorna conflito.
- PR #388 está em rascunho para receber CI, revisão e os gates pendentes antes
  de sair do modo draft.
- AI DevKit lint da Fase 310 falhou por ausência dos README de configuração
  `docs/ai/*` e convenção de branch incompatível; `init` foi evitado para não
  criar scaffolding paralelo às regras do OctaClin.
