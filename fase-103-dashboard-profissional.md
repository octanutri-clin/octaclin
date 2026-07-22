# Fase 103 - Dashboard inicial do profissional

Data: 2026-07-22.

## Objetivo

Criar a primeira tela util do console profissional, com resumo de agenda, pacientes recentes, formularios pendentes e mensagens.

## Entregue

- Nova rota web `/dashboard`.
- Menu lateral com item `Dashboard`.
- Redirecionamento raiz `/` para `/dashboard`.
- Permissao `dashboard.ler` para `SuperAdmin`, `Professional` e `Collaborator`.
- Destino inicial operacional alterado para `/dashboard`.
- Dashboard com:
  - consultas de hoje;
  - total de consultas futuras;
  - pacientes recentes;
  - pacientes em risco;
  - formularios em rascunho;
  - mensagens recebidas, pendentes ou com falha;
  - links diretos para agenda, pacientes, formularios e comunicacoes.

## Arquivos principais

- `octaclin-web/app/dashboard/page.tsx`
- `octaclin-web/components/dashboard/painel-dashboard.tsx`
- `octaclin-web/lib/dashboard-api.ts`
- `octaclin-web/components/app/console-shell.tsx`
- `octaclin-web/lib/server/autorizacao-rotas.ts`
- `octaclin-backend/src/modulos/auth/dominio/permissoes.ts`
- `MAPA_ROTAS_PERMISSOES.md`

## Validacoes

- RED inicial: `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "dashboard profissional" --project=desktop-chromium --reporter=list`.
- RED de permissao backend: `pnpm --dir octaclin-backend exec jest permissoes.spec.ts --runInBand`.
- `pnpm --dir octaclin-backend exec jest permissoes.spec.ts --runInBand`.
- `pnpm --dir octaclin-backend typecheck`.
- `pnpm --dir octaclin-web test:authz`.
- `pnpm --dir octaclin-web typecheck`.
- `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "dashboard profissional" --project=desktop-chromium --project=mobile-chromium --reporter=list`.
- `pnpm --dir octaclin-web build`.
- `pnpm --dir octaclin-backend build`.

## Pendencias

- Evoluir o dashboard com filtros por profissional quando houver escopo delegado mais granular.
- Criar cards de tarefas clinicas quando as fases de evolucoes, tarefas e materiais forem entregues.
- Adicionar dados de envios de questionarios pendentes quando o backend expuser resumo agregado por envio/paciente.
