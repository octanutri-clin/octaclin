# OctaClin - Testes e validacoes

Este arquivo define quais comandos rodar antes de concluir fases. Use validacao proporcional ao risco, mas nunca conclua fase sem evidencia fresca.

## Setup de PATH no Windows

Se `node` ou `pnpm` nao estiverem no PATH, use o runtime empacotado do Codex:

```powershell
$env:PATH='C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;' + $env:PATH
```

## Validacao minima para documentacao

Use quando alterar apenas `.md`:

```powershell
git diff --check
git status --short
```

Opcional:

```powershell
Select-String -Path *.md -Pattern '^# '
```

## Validacao backend focada

Use quando alterar servicos, controllers, DTOs ou dominio no backend:

```powershell
pnpm --dir octaclin-backend test --runInBand <spec1> <spec2>
pnpm --dir octaclin-backend typecheck
```

Specs recentes importantes:

```powershell
pnpm --dir octaclin-backend test --runInBand servico-usuarios-cliente.spec.ts servico-recuperacao-senha.spec.ts servico-portal-cliente.spec.ts permissoes.spec.ts guarda-permissoes.spec.ts
```

No Windows/Codex, prefira o script `test` do pacote backend. O formato `pnpm --dir octaclin-backend exec jest ...` pode nao resolver o binario local do Jest corretamente em alguns shells.

## Validacao web focada

Use quando alterar componentes, BFF ou autorizacao de rotas:

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
```

## Build web

Use quando alterar rotas, BFF, layout, componentes ou contratos frontend:

```powershell
pnpm --dir octaclin-web build
```

## Playwright visual

Use quando alterar UI/UX, portal do cliente, portal do paciente ou rotas visuais:

```powershell
pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "dashboard profissional" --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite remarcar e cancelar consulta agendada|agrega rotina diaria do profissional" --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "prontuario do paciente" --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite registrar evolucao clinica privada|exibe linha do tempo clinica consolidada" --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite prescrever tarefa de acompanhamento|permite registrar evolucao clinica privada|exibe linha do tempo clinica consolidada" --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite criar material e enviar ao paciente|permite prescrever tarefa de acompanhamento|permite registrar evolucao clinica privada|exibe linha do tempo clinica consolidada" --project=desktop-chromium --project=mobile-chromium --reporter=list
```

Antes de rodar Playwright, garanta servidor limpo:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
```

Subir dev server temporario:

```powershell
$out='next-dev.out.log'
$err='next-dev.err.log'
$p = Start-Process -FilePath 'pnpm.cmd' -ArgumentList '--dir','octaclin-web','dev','--hostname','127.0.0.1','--port','3000' -WorkingDirectory (Get-Location) -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 16
pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list
Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Remove-Item $out,$err -ErrorAction SilentlyContinue
```

## Validacao para fases de permissao

Fase 95 e semelhantes devem rodar:

```powershell
pnpm --dir octaclin-backend test --runInBand permissoes.spec.ts guarda-permissoes.spec.ts
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
```

Tambem atualizar e revisar `MAPA_ROTAS_PERMISSOES.md`.

## Preflight de producao

Use antes de iniciar uma fase relevante ou antes de passar o projeto para outro agente:

```powershell
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Use antes de concluir fases de maior risco:

```powershell
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -Full
```

Atalhos equivalentes:

```powershell
pnpm validate:docs
pnpm validate
pnpm validate:full
```

## Validacao de secrets

Use antes de commit, handoff ou deploy quando houver qualquer mudanca em ambiente, docs ou integracoes:

```powershell
npm run security:secrets
npm run test:security
```

O preflight executa `security:secrets` automaticamente. O runbook de resposta e rotacao fica em `RUNBOOK_ROTACAO_SECRETS.md`.

## Validacao para integracoes

Quando mexer em Gmail, Meta, Calendar, Redis ou Render:

1. Rodar testes/typecheck aplicaveis.
2. Fazer deploy ou aguardar auto-deploy.
3. Validar `/health`.
4. Validar uma acao real controlada da integracao.
5. Conferir logs.
6. Atualizar `RUNBOOK_PRODUCAO.md` ou `VARIAVEIS_AMBIENTE.md` se necessario.

## Validacao antes de commit

Sempre:

```powershell
git diff --check
git status --short
```

Antes de finalizar resposta:

```powershell
git log --oneline --max-count=5
```

## Validacao antes de go-live

Executar o checklist completo em `CHECKLIST_GO_LIVE.md`.
