# Fase 46 - GitHub Actions CI

## Objetivo

Transformar a validacao local consolidada da Fase 45 em um workflow GitHub Actions versionavel, sem exigir secrets para a rotina de CI.

## Entregas

- Atualizado `outputs/.github/workflows/ci.yml`.
- Mantidos jobs separados por superficie:
  - `backend`;
  - `web`;
  - `mobile`;
  - `ai-service`;
  - `demo-smoke`.
- Adicionado `workflow_dispatch` para execucao manual.
- Adicionadas permissoes minimas com `contents: read`.
- Adicionado `concurrency` para cancelar execucoes antigas da mesma referencia.
- O job `demo-smoke`:
  - instala dependencias de backend e web;
  - gera build web;
  - sobe `api-demo-local.mjs` em `3001`;
  - sobe `next start` em `3000`;
  - aguarda `/health` e `/login`;
  - roda `smoke-ui-regression.mjs`;
  - roda `smoke-e2e-bff.mjs`;
  - instala Chromium do Playwright;
  - roda `pnpm smoke:visual`;
  - publica logs e artefatos Playwright em falha ou sucesso.

## Acesso GitHub

Esta fase nao exigiu acesso ao GitHub remoto. Os arquivos foram preparados localmente em `outputs/.github/workflows`.

Para publicar no GitHub, sera necessario fazer commit e push para o repositorio remoto. Isso pode ser feito pelo usuario localmente ou via conector GitHub/autenticacao Git se autorizado.

## Validacao executada

- Varredura ASCII.
- Varredura para evitar referencia textual ao sistema usado apenas como modelo.
- Verificacao textual do workflow.
- Execucao do CI local da Fase 45 como proxy funcional antes do push.
- `powershell -ExecutionPolicy Bypass -File outputs/validar-ci-local.ps1`.

## Observacao

Nao havia parser YAML instalado no ambiente local para validar o arquivo com uma biblioteca dedicada. A validacao feita foi textual/estrutural e funcional via CI local completo.
