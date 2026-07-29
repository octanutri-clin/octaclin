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
pnpm --dir octaclin-web lint
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

## Validacao multi-tenant

Use quando alterar servicos que recebem IDs de entidades relacionadas, como `pacienteId`, `profissionalId`, `questionarioId`, `canalId`, `templateId`, `usuarioId` ou `tenantId` derivado de JWT:

```powershell
pnpm --dir octaclin-backend test --runInBand src/modulos/pacientes/aplicacao/servico-pacientes.spec.ts src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts
pnpm --dir octaclin-backend typecheck
```

Regra esperada: toda busca por entidade relacionada deve validar `tenantId` junto do `id`. Quando a entidade existir em outro tenant, responder como nao encontrada.

## Validacao PostgreSQL destrutiva de integracao

Use somente quando uma fase exigir locks, constraints ou transacoes reais do
PostgreSQL. A URL deve apontar para uma base descartavel cujo nome seja
`octaclin_test_<nome>`, nunca staging ou producao. A suite exige confirmacao
literal e apaga o schema antes de executar:

```powershell
$env:OCTACLIN_POSTGRES_INTEGRACAO_URL='<url do banco descartavel>'
$env:OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR='APAGAR'
pnpm --dir octaclin-backend exec jest modulos/ia/aplicacao/servico-ia.postgres-integracao.spec.ts modulos/mobile/aplicacao/servico-mobile.postgres-integracao.spec.ts --runInBand
```

Sem as duas variaveis a suite fica ignorada; isso nao e evidencia de aceite.

## Validacao de observabilidade

Use quando alterar logs, interceptors, auditoria, healthchecks, middleware global ou bootstrap do backend:

```powershell
pnpm --dir octaclin-backend test --runInBand src/infraestrutura/observabilidade/contexto-requisicao.spec.ts src/infraestrutura/observabilidade/middleware-correlacao.spec.ts src/infraestrutura/observabilidade/interceptor-log-requisicao.spec.ts src/infraestrutura/auditoria/servico-auditoria.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
```

Regra esperada: logs podem conter `requestId`, `tenantId`, `usuarioId`, metodo, rota sem query string, status e duracao; nao devem conter corpo da requisicao, query string, email, token, senha, refresh token ou mensagem de erro com dado de negocio sensivel.

## Validacao de alertas operacionais

Use quando alterar `/operacoes/alertas`, `/api/operacoes/alertas`, healthchecks, outbox, central de falhas ou painel operacional:

```powershell
pnpm --dir octaclin-backend test --runInBand src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts src/modulos/operacoes/apresentacao/controlador-operacoes.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "operacoes LGPD" --project=desktop-chromium --reporter=list
```

Regra esperada: alertas indicam severidade, origem, metrica e acao sugerida sem expor payload bruto, secrets, tokens, senhas ou mensagens de erro com dados sensiveis.

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

## Validacao de backup e restore

Use quando alterar scripts, runbooks ou politica de backup/restore:

```powershell
pnpm test:backup
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Para validacao operacional real com banco:

```powershell
$env:DATABASE_URL='<url do banco origem>'
powershell -ExecutionPolicy Bypass -File .\validar-backup-restore.ps1
```

Para restore de teste, use somente banco dedicado:

```powershell
$env:DATABASE_URL='<url do banco origem>'
$env:RESTORE_DATABASE_URL='<url do banco dedicado para restore>'
$env:CONFIRMAR_RESTORE_TESTE='SIM'
powershell -ExecutionPolicy Bypass -File .\validar-backup-restore.ps1 -RestoreTeste
```

Regra esperada: o plano de backup nao pode imprimir senha real, `RESTORE_DATABASE_URL` nao pode ser igual a `DATABASE_URL`, e dumps em `backups/` nao devem entrar no Git.

## Validacao do runbook de suporte

Use quando alterar fluxos de atendimento, incidentes comuns, comunicacoes, agenda, login ou convites:

```powershell
pnpm test:suporte
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Regra esperada: `RUNBOOK_SUPORTE.md` deve cobrir triagem inicial, login, convites, recuperacao de senha, WhatsApp, email, agenda e escalonamento, sem padroes obvios de secrets.

## Validacao para integracoes

Quando mexer em Gmail, Meta, Calendar, Redis ou Render:

1. Rodar testes/typecheck aplicaveis.
2. Fazer deploy ou aguardar auto-deploy.
3. Validar `/health`.
4. Validar uma acao real controlada da integracao.
5. Conferir logs.
6. Atualizar `RUNBOOK_PRODUCAO.md` ou `VARIAVEIS_AMBIENTE.md` se necessario.

## Suite E2E de jornadas criticas

Use antes de go-live, ao alterar portal do cliente, pacientes, agenda, comunicacoes ou portal do paciente:

```powershell
pnpm test:e2e:criticas
```

A suite `octaclin-web/tests/visual/jornadas-criticas.spec.mjs` valida convite administrativo, criacao de paciente, agendamento com email/WhatsApp/Google Calendar e portal do paciente com notificacoes/plano. O comando raiz usa `validar-jornadas-criticas.ps1` para subir o Next temporariamente e encerrar a porta ao final.

## Dados realistas de staging

Use quando alterar massa de staging, seeds ou dados de QA:

```powershell
pnpm test:staging-fixtures
pnpm --dir octaclin-backend typecheck
```

Para aplicar no banco de staging:

```powershell
$env:DATABASE_URL='<url do Neon staging>'
pnpm seed:staging
```

Regra esperada: `staging-fixtures.json` deve usar apenas dados ficticios, dominio `@octaclin.test`, telefones sinteticos e origem `seed_staging`.

## Validacao do piloto interno

Use quando alterar `RUNBOOK_PILOTO_INTERNO.md` ou `PILOTO_INTERNO_CONTROLE.md`:

```powershell
pnpm test:piloto
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Regra esperada: o runbook deve cobrir participantes, perfis, jornadas, criterios de sucesso/bloqueio, registro de bugs e aceite; o controle deve manter status, checklist de jornadas, registro de bugs e decisao de aceite, sem secrets nem dados reais de clientes/pacientes.

## Validacao da producao isolada

Use quando alterar `RUNBOOK_PRODUCAO_ISOLADA.md` ou `PRODUCAO_ISOLADA_CONTROLE.md`:

```powershell
pnpm test:producao-isolada
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Regra esperada: o runbook deve cobrir os recursos a criar (Neon, Upstash, Render
backend/web), a ordem de execucao, validacao do ambiente novo e regras de
separacao de staging; o controle deve manter status, tabela de recursos,
registro de execucao e decisao de aceite, sem secrets nem URLs reais.

Para aplicar as migrations no banco novo de producao (nunca `pnpm seed:staging`):

```powershell
$env:DATABASE_URL='<url do Neon producao>'
pnpm --dir octaclin-backend migration:run
```

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
