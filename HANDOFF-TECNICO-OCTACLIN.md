# OctaClin - Handoff tecnico

O estado tecnico atual e mantido em `docs/handoffs/ESTADO_ATUAL_AGENTES.md`. Este arquivo permanece como ponto de entrada curto para quem chega ao projeto.

## Arquitetura

- Backend: `octaclin-backend`, NestJS, TypeORM e PostgreSQL.
- Web: `octaclin-web`, Next.js App Router com BFF em `app/api`.
- Multi-tenancy: tenant derivado do JWT e aplicado por `ExecutorTenant`; nunca aceite tenant livre do cliente.
- Sessao web: cookies HttpOnly.
- Dados clinicos e operacionais: preferir arquivamento logico, minimizacao e auditoria em acoes sensiveis.

## Antes de alterar codigo

Leia `AGENTS.md`, `docs/handoffs/ESTADO_ATUAL_AGENTES.md`, checklist, resumo, status e a documentacao da fase. Para integracoes e producao, leia tambem `VARIAVEIS_AMBIENTE.md` e `RUNBOOK_PRODUCAO.md`.

## Fechamento

Cada fase precisa de validacao proporcional, documentacao, atualizacao de estado e branch enviada. Consulte o handoff canonico para saber quais commits podem ser integrados e quais gates externos ainda bloqueiam producao.
