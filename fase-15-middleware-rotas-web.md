# Fase 15 - Middleware de rotas web protegidas

## Objetivo

Melhorar a experiencia e a postura de seguranca da area operacional, redirecionando usuarios sem sessao antes da renderizacao client-side.

## Entregas

- Novo `octaclin-web/middleware.ts`.
- Protecao de `/operacoes` por presenca dos cookies `HttpOnly`:
  - `octaclin_access_token`
  - `octaclin_refresh_token`
- Redirecionamento de `/operacoes` sem sessao para `/login?redirect=/operacoes`.
- Redirecionamento de `/login` com sessao presente para `/operacoes`.

## Decisoes

- O middleware faz apenas gate de navegacao por existencia de cookies.
- A validacao real, renovacao de token e proxy autenticado continuam nas rotas BFF.
- Essa divisao evita expor tokens ao cliente e mantem o middleware simples.

## Proximo risco a fechar

Adicionar testes automatizados de middleware/rotas BFF e depois iniciar uma navegacao administrativa completa entre questionarios, operacoes e cadastros.

## Validacao executada

- Web `tsc --noEmit`: passou.
- Web `next build`: passou, incluindo bundle de middleware.
- `work/checar-imports-web.js`: 25 imports web OK.
- `GET http://localhost:3001/login` sem cookie: HTTP 200.
- `GET http://localhost:3001/operacoes` sem cookie: HTTP 307 para `/login?redirect=%2Foperacoes`.
- `GET http://localhost:3001/login` com cookies simulados: HTTP 307 para `/operacoes`.
- Varredura de nome legado em `outputs`: sem ocorrencias.
