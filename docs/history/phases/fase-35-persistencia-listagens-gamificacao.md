# Fase 35 - Persistencia e Listagens de Gamificacao

## Objetivo

Transformar o console de Gamificacao em uma tela que carrega registros persistidos do backend, em vez de depender apenas do estado criado durante a sessao atual da interface.

## Entregas

- GET real no backend Nest para listar circulos por tenant.
- GET real no backend Nest para listar desafios por tenant.
- GET real no backend Nest para listar badges por tenant.
- Rotas BFF equivalentes em `/api/gamificacao/circulos`, `/api/gamificacao/desafios` e `/api/gamificacao/badges`.
- API demo local retornando listas em memoria para circulos, desafios e badges.
- Cliente `gamificacao-api.ts` com `listarCirculos`, `listarDesafios` e `listarBadges`.
- Bootstrap do painel de Gamificacao carregando profissionais, pacientes, circulos, desafios e badges em paralelo.
- Painel de Gamificacao exibindo contadores e resumo de registros persistidos.
- Smoke E2E BFF validando que as listagens retornam os registros criados durante o fluxo.

## Arquivos principais

- `outputs/octaclin-backend/src/modulos/gamificacao/aplicacao/servico-gamificacao.ts`
- `outputs/octaclin-backend/src/modulos/gamificacao/apresentacao/controlador-gamificacao.ts`
- `outputs/octaclin-backend/scripts/api-demo-local.mjs`
- `outputs/octaclin-web/app/api/gamificacao/circulos/route.ts`
- `outputs/octaclin-web/app/api/gamificacao/desafios/route.ts`
- `outputs/octaclin-web/app/api/gamificacao/badges/route.ts`
- `outputs/octaclin-web/lib/gamificacao-api.ts`
- `outputs/octaclin-web/components/gamificacao/painel-gamificacao.tsx`
- `outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`

## Validacao esperada

- `node --check outputs/octaclin-backend/scripts/api-demo-local.mjs`
- `node --check outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`
- `next build`
- `tsc --noEmit`
- `outputs/verificar-demo-local.ps1`
- `outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`

## Proximo passo sugerido

Repetir o mesmo padrao para os consoles de IA e Mobile, adicionando endpoints de listagem para analises, reconhecimentos, diario rapido, uploads e acompanhantes.
