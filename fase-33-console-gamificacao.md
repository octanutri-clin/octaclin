# Fase 33 - Console de Gamificacao

## Objetivo

Entregar a tela administrativa de Gamificacao do OctaClin integrada ao BFF e ao backend demo, cobrindo o fluxo minimo de comunidade, desafios, ranking e badges.

## Entregas

- Nova rota protegida `/gamificacao` no console web.
- Painel interativo para criar circulo, adicionar paciente, publicar post, criar desafio, atualizar progresso, consultar ranking e conceder badge.
- Cliente BFF em `lib/gamificacao-api.ts` para encapsular chamadas do modulo.
- Rotas BFF para:
  - `POST /api/gamificacao/circulos`
  - `POST /api/gamificacao/circulos/:id/membros`
  - `POST /api/gamificacao/posts`
  - `POST /api/gamificacao/desafios`
  - `POST /api/gamificacao/desafios/progresso`
  - `GET /api/gamificacao/desafios/:id/ranking`
  - `POST /api/gamificacao/badges`
  - `POST /api/gamificacao/badges/concessoes`
- API demo local com armazenamento em memoria para circulos, membros, posts, desafios, progresso, ranking, badges e concessoes.
- Smoke E2E BFF cobrindo a rota protegida e o fluxo completo de gamificacao.
- README atualizado com a nova tela, endpoints e cobertura do smoke.

## Arquivos principais

- `outputs/octaclin-web/app/gamificacao/page.tsx`
- `outputs/octaclin-web/components/gamificacao/painel-gamificacao.tsx`
- `outputs/octaclin-web/lib/gamificacao-api.ts`
- `outputs/octaclin-web/app/api/gamificacao/**/route.ts`
- `outputs/octaclin-web/components/app/console-shell.tsx`
- `outputs/octaclin-web/middleware.ts`
- `outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`
- `outputs/octaclin-backend/scripts/api-demo-local.mjs`

## Validacao esperada

- `node --check outputs/octaclin-backend/scripts/api-demo-local.mjs`
- `node --check outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`
- `next build`
- `tsc --noEmit`
- `outputs/verificar-demo-local.ps1`
- `outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`

## Credenciais demo

- API: `http://localhost:3001`
- Tenant: `clinica-carla`
- Email: `admin@octaclin.local`
- Senha: `OctaClin@123`
