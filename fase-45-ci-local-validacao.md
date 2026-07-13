# Fase 45 - CI local e validacao consolidada

## Objetivo

Criar um unico ponto de entrada para validar o OctaClin localmente antes de demonstracoes, handoff ou novas fases de desenvolvimento.

## Entregas

- Criado `outputs/validar-ci-local.ps1`.
- Atualizado `outputs/HANDOFF-TECNICO-OCTACLIN.md` com o comando de CI local.
- O script executa, por padrao:
  - typecheck do backend;
  - build do backend;
  - specs focadas do backend;
  - typecheck do web;
  - build do web;
  - typecheck do mobile;
  - reinicio da demo local;
  - healthcheck da demo;
  - smoke UI;
  - smoke E2E BFF.
  - smoke visual Playwright.

## Opcoes

```powershell
powershell -ExecutionPolicy Bypass -File outputs/validar-ci-local.ps1 -SkipBackendBuild
powershell -ExecutionPolicy Bypass -File outputs/validar-ci-local.ps1 -SkipBackendTests
powershell -ExecutionPolicy Bypass -File outputs/validar-ci-local.ps1 -SkipWebBuild
powershell -ExecutionPolicy Bypass -File outputs/validar-ci-local.ps1 -SkipMobile
powershell -ExecutionPolicy Bypass -File outputs/validar-ci-local.ps1 -SkipVisual
powershell -ExecutionPolicy Bypass -File outputs/validar-ci-local.ps1 -SkipDemo
```

## Validacao executada

- Parser PowerShell do novo script.
- Varredura ASCII.
- Varredura para evitar referencia textual ao sistema usado apenas como modelo.
- Execucao completa do CI local.
- `powershell -ExecutionPolicy Bypass -File outputs/validar-ci-local.ps1`.
