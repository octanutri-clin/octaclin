# Fase 47 - Regressao visual Playwright

## Objetivo

Adicionar regressao visual automatizada no OctaClin para validar rotas protegidas em navegador real, desktop e mobile.

## Entregas

- Adicionado `@playwright/test` ao frontend.
- Criado `outputs/octaclin-web/playwright.config.mjs`.
- Criado `outputs/octaclin-web/tests/visual/console-regression.spec.mjs`.
- Adicionado script `npm run smoke:visual`.
- Integrado o smoke visual ao `outputs/validar-ci-local.ps1`.
- Integrado o smoke visual ao job `demo-smoke` do GitHub Actions.
- Atualizados handoff, README web e notas de CI.

## Cobertura

- Login real pela tela `/login`.
- 9 rotas protegidas.
- Projetos Playwright:
  - `desktop-chromium`;
  - `mobile-chromium`.
- Validacoes:
  - `h1` esperado por rota;
  - marca e shell do console;
  - menu completo;
  - ausencia de erro bruto do Next.js;
  - ausencia de overflow horizontal no documento;
  - screenshots anexadas por rota/projeto.

## Validacao executada

- `node node_modules/@playwright/test/cli.js install chromium`.
- `node node_modules/@playwright/test/cli.js test`: 18 testes passaram.
- `node node_modules/typescript/bin/tsc --noEmit` no frontend.
- `node node_modules/next/dist/bin/next build` no frontend.
- `outputs/verificar-demo-local.ps1`.
- `scripts/smoke-ui-regression.mjs`.
- `scripts/smoke-e2e-bff.mjs`.
- `outputs/validar-ci-local.ps1`: CI local OctaClin OK.
- Varredura ASCII.
- Varredura para evitar referencia textual ao sistema usado apenas como modelo.
