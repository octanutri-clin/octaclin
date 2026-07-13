# Fase 36 - Persistencia e Listagens de IA e Mobile

## Objetivo

Aplicar o padrao de persistencia/listagens aos consoles de IA e Mobile, para que as telas carreguem registros persistidos no backend em vez de mostrar apenas dados criados na sessao atual.

## Entregas

- GET real no backend Nest para listar analises de sentimento por tenant.
- GET real no backend Nest para listar reconhecimentos alimentares por tenant.
- GET real no backend Nest para listar diario rapido, arquivos de midia e acompanhantes por tenant.
- Retorno de acompanhantes sanitizado, sem `pinHash` nem campos criptografados.
- Rotas BFF equivalentes para IA e Mobile.
- API demo local com as novas listagens em memoria.
- Clientes `ia-api.ts` e `mobile-api.ts` carregando listagens no bootstrap.
- Paineis de IA e Mobile exibindo registros persistidos.
- Smoke E2E BFF validando que cada listagem retorna o registro criado e que acompanhantes nao expoem `pinHash`.

## Arquivos principais

- `outputs/octaclin-backend/src/modulos/ia/aplicacao/servico-ia.ts`
- `outputs/octaclin-backend/src/modulos/ia/apresentacao/controlador-ia.ts`
- `outputs/octaclin-backend/src/modulos/mobile/aplicacao/servico-mobile.ts`
- `outputs/octaclin-backend/src/modulos/mobile/apresentacao/controlador-mobile.ts`
- `outputs/octaclin-backend/scripts/api-demo-local.mjs`
- `outputs/octaclin-web/app/api/ia/**/route.ts`
- `outputs/octaclin-web/app/api/mobile/**/route.ts`
- `outputs/octaclin-web/lib/ia-api.ts`
- `outputs/octaclin-web/lib/mobile-api.ts`
- `outputs/octaclin-web/components/ia/painel-ia.tsx`
- `outputs/octaclin-web/components/mobile/painel-mobile.tsx`
- `outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`

## Validacao esperada

- `node --check outputs/octaclin-backend/scripts/api-demo-local.mjs`
- `node --check outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`
- `tsc --noEmit` no backend
- `next build`
- `tsc --noEmit` no web
- `outputs/verificar-demo-local.ps1`
- `outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`

## Proximo passo sugerido

Avancar para Comunicacoes e Automacoes com historico/listagens de mensagens e execucoes, fechando os consoles operacionais que ainda exibem parte do resultado apenas localmente.
