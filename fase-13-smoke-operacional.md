# Fase 13 - Smoke operacional ponta a ponta

## Objetivo

Automatizar uma validacao minima de ambiente local apos migrations e seed demo.

## Entregas

- Script `npm run smoke:operacoes`.
- Arquivo `src/infraestrutura/smoke/smoke-operacoes.ts`.
- Fluxo validado pelo script:
  - `POST /auth/login`;
  - `GET /operacoes/resumo`;
  - `GET /operacoes/outbox/falhas`;
  - `POST /operacoes/outbox/:id/reprocessar`, quando houver falha;
  - `GET /operacoes/mobile/sincronizacoes`.

## Configuracao

Valores padrao:

- `SMOKE_API_URL=http://localhost:3000`
- `SMOKE_TENANT_SLUG=clinica-carla`
- `SMOKE_EMAIL=admin@octaclin.local`
- `SMOKE_SENHA=OctaClin@123`

## Ordem recomendada

```bash
npm run migration:run
npm run seed:demo
npm run start:dev
npm run smoke:operacoes
```

## Proximo risco a fechar

Subir a infraestrutura local e executar o smoke contra API real para validar login, refresh, operacoes e reprocessamento com Postgres/Redis.

## Validacao executada

- Backend `tsc --noEmit`: passou.
- Backend `nest build`: passou.
- `work/checar-imports-relativos.js`: 114 imports backend OK.
- Varredura de nome legado em `outputs`: sem ocorrencias.
- Execucao direta do smoke via `ts-node`: script iniciou e falhou somente por API local indisponivel em `localhost:3000` com `ECONNREFUSED`.
