# Fase 231 - Jornadas E2E mutaveis em staging

Data: 2026-08-13

## Objetivo

Validar as principais mutacoes de negocio em infraestrutura descartavel, com
PostgreSQL real, dois tenants sinteticos e os mesmos limites de autorizacao e
RLS esperados pela aplicacao, sem alterar dados de producao nem enviar
comunicacoes externas.

## Implementacao

- O workflow manual `OctaClin staging E2E mutavel` cria uma branch Neon
  descartavel a partir do banco de integracao confirmado.
- As migrations sao aplicadas com `neondb_owner`; a aplicacao e as jornadas
  usam a role restrita `octaclin_runtime_integracao`.
- O preflight prepara exatamente dois tenants sinteticos e valida role,
  `ENABLE/FORCE ROW LEVEL SECURITY` e invisibilidade sem contexto de tenant.
- Redis e MinIO sobem como servicos efemeros. O bucket de teste e criado na
  mesma execucao e e descartado com o runner.
- Backend e BFF Next.js sao compilados e executados como processos reais. O
  workflow nao inicia workers externos e desabilita notificacoes de agenda.
- A jornada cobre cadastro e edicao de paciente, isolamento entre tenants,
  agendamento, reagendamento, cancelamento, comunicacao pendente, convite e
  ativacao do portal, questionario, upload JPEG, envio final e leitura clinica.
- A branch Neon e removida com `if: always()`, inclusive quando uma etapa
  anterior falha. Logs sem credenciais ficam retidos por sete dias.

## Configuracao do repositorio

Variaveis GitHub:

- `NEON_E2E_PROJECT_ID`
- `NEON_E2E_PARENT_BRANCH_ID`
- `NEON_E2E_DATABASE`
- `NEON_E2E_RUNTIME_ROLE`

Secret GitHub:

- `NEON_API_KEY`, limitado ao projeto de integracao e nunca registrado em
  arquivo, log ou artefato.

## Correcoes encontradas durante o aceite

- A criacao do bucket MinIO foi movida para o mesmo container em que o alias
  e configurado, pois a configuracao do `mc` nao persiste entre containers.
- A verificacao de migrations passou a usar explicitamente o data source do
  TypeORM.
- IDs customizados das filas de comunicacoes, automacoes e Google Agenda
  deixaram de usar `:`, caractere rejeitado pela versao atual do BullMQ.

## Gates locais

```powershell
pnpm test:e2e:staging:config
pnpm test:staging-fixtures
pnpm --dir octaclin-backend test -- --runInBand src/infraestrutura/e2e/alvo-staging-e2e.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
pnpm security:secrets
git diff --check
```

## Aceite remoto

- [x] Execucao manual `31731167549` concluida com sucesso no commit
  `04f6bb9`.
- [x] Branch Neon descartavel criada e removida ao final.
- [x] Migrations, role runtime, RLS forcada e isolamento de dois tenants
  aprovados antes das jornadas.
- [x] Redis, MinIO, backend e web reais ficaram prontos.
- [x] Todas as jornadas mutaveis passaram sem envio externo.
- [x] Evidencia: https://github.com/octanutri-clin/octaclin/actions/runs/31731167549

## Resultado

A Fase 231 esta concluida. Producao continua reservada a smokes controlados e
sem mutacao de negocio; novas jornadas mutaveis devem ser adicionadas a este
workflow manual e executadas em branch descartavel.
