# Fase 129 - Staging com dados realistas

Data: 2026-07-23

## Objetivo

Criar massa de dados ficticia e segura para staging, permitindo demonstracao e QA sem uso de PII real.

## Entregas

- Criado fixture `octaclin-backend/src/infraestrutura/banco-dados/seeds/staging-fixtures.json`.
- Criado seed idempotente `octaclin-backend/src/infraestrutura/banco-dados/seeds/seed-staging.ts`.
- Criado validador `scripts/test-staging-fixtures.mjs`.
- Adicionado script raiz `pnpm test:staging-fixtures`.
- Adicionado script raiz `pnpm seed:staging`.
- Adicionado script backend `pnpm --dir octaclin-backend seed:staging`.
- Criado `RUNBOOK_STAGING_DADOS.md`.

## Cobertura da massa

- Tenant ficticio `octaclin-staging`.
- Usuarios cliente, colaborador, profissionais e paciente.
- Profissionais, pacientes, consultas, comunicacoes, materiais, envio de material, tarefas e configuracoes de tenant.
- Dominios ficticios `@octaclin.test`.

## Validacoes

```powershell
pnpm test:staging-fixtures
pnpm --dir octaclin-backend typecheck
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Observacoes

- O seed remoto nao foi executado nesta fase porque a sessao nao recebeu `DATABASE_URL` de staging.
- Para aplicar no Neon staging, seguir `RUNBOOK_STAGING_DADOS.md` e executar `pnpm seed:staging` somente com a URL de staging.
- A Fase 130 deve validar a massa em um piloto interno controlado apos aplicacao no ambiente remoto.
