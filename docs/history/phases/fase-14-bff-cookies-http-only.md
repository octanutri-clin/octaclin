# Fase 14 - BFF web com cookies HttpOnly

## Objetivo

Reduzir a exposicao de tokens no navegador movendo access token e refresh token do `localStorage` para cookies `HttpOnly` emitidos pelo Next.js.

## Entregas

- Helper server-side `octaclin-web/lib/server/sessao-bff.ts`.
- Cookies `HttpOnly`, `SameSite=Lax`, `Secure` em producao e `path=/`.
- Rotas BFF de autenticacao:
  - `POST /api/auth/login`
  - `GET /api/auth/session`
  - `POST /api/auth/sair`
- Rotas BFF operacionais:
  - `GET /api/operacoes/resumo`
  - `GET /api/operacoes/outbox/falhas`
  - `POST /api/operacoes/outbox/:id/reprocessar`
  - `GET /api/operacoes/mobile/sincronizacoes`
- Renovacao server-side:
  - antes da chamada quando o access token esta perto de expirar;
  - depois de HTTP 401, com retry da chamada original.
- Remocao do armazenamento client-side de tokens.

## Decisoes

- O navegador agora fala apenas com `/api/*` no proprio web.
- A sessao publica retorna apenas `apiUrl`, `tenantSlug`, `email` e `expiraEm`.
- O logout tenta revogar o refresh token no backend e sempre limpa cookies locais.

## Proximo risco a fechar

Adicionar middleware Next.js para redirecionar `/operacoes` antes da renderizacao client-side e melhorar a experiencia de rota protegida.

## Validacao executada

- Web `tsc --noEmit`: passou.
- Web `next build`: passou, com rotas BFF dinamicas geradas.
- `work/checar-imports-web.js`: 24 imports web OK.
- `GET http://localhost:3001/login`: HTTP 200.
- `GET http://localhost:3001/operacoes`: HTTP 200.
- `GET http://localhost:3001/api/auth/session` sem cookie: HTTP 401.
- Varredura de nome legado em `outputs`: sem ocorrencias.
