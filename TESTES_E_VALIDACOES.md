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
pnpm --dir octaclin-web test:fase248
pnpm --dir octaclin-web exec playwright test tests/visual/fase-248-estados-recuperacao.spec.mjs --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web test:fase249
pnpm --dir octaclin-web exec playwright test tests/visual/fase-249-densidade-responsividade.spec.mjs --project=mobile-chromium --reporter=list
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

## Validacao da operacao de lancamento

Use ao alterar janela, responsabilidades, gates GO/NO-GO, classificacao de
incidente, rollback ou comunicacao do primeiro piloto:

```powershell
pnpm test:lancamento
pnpm exercicio:lancamento
pnpm test:monitor-producao
pnpm security:secrets
```

O exercicio e inteiramente sintetico e nao deve receber URL, credencial, tenant
ou dado real. O gate exige classificacao P0-P3, bloqueio automatico de
lancamento inseguro, rollback sem revert cego de migration, duas leituras de
recuperacao e comunicacao sanitizada.

## Validacao para integracoes

Quando mexer em Gmail, Meta, Calendar, Redis ou Render:

1. Rodar testes/typecheck aplicaveis.
2. Fazer deploy ou aguardar auto-deploy.
3. Validar `/health`.
4. Validar uma acao real controlada da integracao.
5. Conferir logs.
6. Atualizar `RUNBOOK_PRODUCAO.md` ou `VARIAVEIS_AMBIENTE.md` se necessario.

## Performance do backend

O runner da Fase 215 faz somente leituras e usa `PERF_DATABASE_URL`, nunca a
`DATABASE_URL` corrente. Ele recusa banco de producao e exige confirmacao exata
do nome; banco remoto de teste exige um segundo aceite explicito.

```powershell
$env:PERF_DATABASE_URL='<url do banco de integracao>'
$env:PERF_CONFIRMAR_BANCO='octaclin_test_fase150b'
$env:CONFIRMAR_PERFORMANCE_REMOTA='SIM'
$env:PERF_TENANT_SLUG='octaclin-staging'
pnpm --dir octaclin-backend performance:backend
Remove-Item Env:PERF_DATABASE_URL
Remove-Item Env:PERF_CONFIRMAR_BANCO
Remove-Item Env:CONFIRMAR_PERFORMANCE_REMOTA
Remove-Item Env:PERF_TENANT_SLUG
```

O resultado registra p50/p95/p99, maximo e maior fila observada no pool para a
agregacao do portal do cliente. O runner tambem recusa role com `SUPERUSER` ou
`BYPASSRLS`, exige RLS habilitado e forcado em `pacientes`, valida que nenhuma
linha fica visivel sem tenant e confirma o contexto dentro de `ExecutorTenant`.
Crie a role de benchmark por SQL: roles criadas pelo Console Neon recebem
privilegios administrativos e nao servem para validar RLS. Nao execute contra
producao.

## Suite E2E de jornadas criticas

Use antes de go-live, ao alterar portal do cliente, pacientes, agenda, comunicacoes ou portal do paciente:

```powershell
pnpm test:e2e:criticas
```

A suite `octaclin-web/tests/visual/jornadas-criticas.spec.mjs` valida convite administrativo, criacao de paciente, agendamento com email/WhatsApp/Google Calendar e portal do paciente com notificacoes/plano. O comando raiz usa `validar-jornadas-criticas.ps1` para subir o Next temporariamente e encerrar a porta ao final.

A suite `octaclin-web/tests/visual/questionarios-editor.spec.mjs` (Fase 194) valida a guarda de alteracoes nao salvas do editor de questionarios, a recorrencia de check-in em linguagem comum (sem expor cron) e o preview simultaneo em telas largas:

```powershell
pnpm --dir octaclin-web exec playwright test tests/visual/questionarios-editor.spec.mjs --reporter=list
```

## Portal e jornadas publicas da Fase 195

```powershell
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web exec playwright test tests/visual/portal-paciente.spec.mjs tests/visual/agendamento-publico.spec.mjs tests/visual/formulario-publico.spec.mjs --reporter=list
pnpm --dir octaclin-web exec playwright test tests/visual/acessibilidade.spec.mjs --grep "portal do paciente" --reporter=list
```

Esses gates cobrem navegacao autenticada com um bootstrap, ausencia de score
clinico, confirmacao do agendamento publico, rascunho versionado, retomada sem
storage local, BFF publico sem credenciais, expiracao/limpeza e acessibilidade
em desktop e celular.

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

### Fase 220 - monitor e alertas externos

```powershell
pnpm test:monitor-producao
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

O teste exige URLs HTTPS sem credenciais, contratos saudaveis dos dois
healthchecks, identidade da web, retentativas, permissao minima do workflow e
controle explicito antes de ativar o cron. O aceite real exige uma execucao
manual com as URLs oficiais de producao configuradas no repositorio.

### Fase 219 - backup automatizado

```powershell
pnpm test:backup-producao
pnpm test:backup
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

O teste de contrato exige role dedicada na origem, banco de restore separado,
endpoint B2 oficial, cron com habilitacao explicita, AES256, lifecycle e limpeza
do runner. Ele tambem rejeita publicacao do dump como GitHub Artifact.

O aceite real exige uma execucao manual do workflow com `restore_test=true` e,
depois, uma execucao pelo cron. Nenhum desses testes pode usar staging como se
fosse producao nem imprimir connection strings.

### Fase 218 - API publica e webhooks

```powershell
pnpm --dir octaclin-backend test -- --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:next15
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web build
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Depois da migration `1022` em producao confirmada, conferir RLS forcada e
policy nas tres tabelas, todos os indices, as FKs compostas e as colunas
`referencia_externa`. O smoke usa apenas dados sinteticos e cobre chave valida,
escopo negado, revogacao imediata, repeticao idempotente, assinatura HMAC sobre
corpo bruto e historico da entrega. Ver `RUNBOOK_PRODUCAO.md`.

### Fase 216 - plano alimentar

```powershell
pnpm --dir octaclin-backend test -- --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web test:planos-alimentares:bff
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:next15
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web build
```

Depois da migration em banco confirmado, validar RLS forcada, policies,
triggers, indices, fonte TACO e contagem de alimentos conforme
`fase-216-plano-alimentar-calculo-nutricional.md`.

Sempre:

```powershell
git diff --check
git status --short
```

Antes de finalizar resposta:

```powershell
git log --oneline --max-count=5
```

### Fase 221 - smoke autenticado somente leitura em producao

O contrato e seguro para CI/local e nao acessa producao:

```powershell
pnpm test:producao:readonly:contrato
```

O smoke real exige opt-in, URL oficial, papel, email e senha apenas na sessao
do processo. Execute uma vez para cada papel conforme
`fase-221-regressao-e2e-producao-isolada.md`. O teste autentica, le as rotas
permitidas, confirma um redirecionamento de autorizacao e nao aciona comandos
de negocio. Em 2026-08-10, os quatro papeis foram aprovados em producao; o
`Patient` percorreu as nove areas do portal depois da correcao transacional de
ativacao.

## Validacao antes de go-live

### Fase 222 - Google Agenda e Gmail

```powershell
pnpm --dir octaclin-backend test -- --runInBand src/modulos/agenda/apresentacao/controlador-google-agenda.spec.ts src/modulos/agenda/aplicacao/servico-google-calendar.spec.ts src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.spec.ts src/infraestrutura/processamento/papel-processo.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web build
node --check octaclin-backend/scripts/gmail-oauth-token.mjs
```

O aceite de producao exige um evento externo sintetico visivel no feed interno,
`syncToken` persistido e uma entrega Gmail real controlada. Nao registrar
refresh tokens, connection strings ou payloads clinicos na evidencia.

Aceite executado em 2026-08-10: `syncToken` persistido, bloqueios externos
limitados a janela movel, Gmail OAuth com escopo `gmail.send`, envio real aceito
pelo Gmail, health detalhado integralmente `ok` e processo Render confirmado
como `all`. Todos os arquivos temporarios da rotacao foram removidos.

Executar o checklist completo em `CHECKLIST_GO_LIVE.md`.

### Fase 240 - estabilizacao do main

O CI deve executar a suite completa do backend, nao apenas uma selecao de
specs. O gate local equivalente e:

```powershell
pnpm --dir octaclin-backend test -- --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web audit --prod --audit-level=high
pnpm --dir octaclin-backend audit --prod --audit-level=high
```

O aceite remoto exige `OctaClin CI` verde e uma rodada do workflow `Backup
producao` usando o canario da migration `1026`. Nunca usar o banco de producao
como destino do restore.

### Fase 229 - seguranca operacional

```powershell
pnpm --dir octaclin-web test:seguranca-operacional
pnpm --dir octaclin-web build
pnpm --dir octaclin-web test:seguranca-runtime
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-backend test -- --runInBand
pnpm --dir octaclin-web audit --prod --audit-level=high
pnpm --dir octaclin-backend audit --prod --audit-level=high
pnpm security:secrets
```

Depois do deploy, `/login` deve responder com CSP, HSTS,
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e
`Permissions-Policy`. Um POST sintetico invalido com origem oficial deve
alcancar a rota e responder `400`; origem externa ou ausente deve responder
`403`. Nao usar credenciais nesse smoke.

## Mobile Expo - Fase 243

```powershell
pnpm --dir octaclin-mobile install --frozen-lockfile
pnpm --dir octaclin-mobile typecheck
pnpm --dir octaclin-mobile doctor
pnpm --dir octaclin-mobile test:security
pnpm --dir octaclin-mobile audit:security
pnpm --dir octaclin-mobile build:validate
```

`audit:security` falha para qualquer vulnerabilidade nova ou excecao alterada.
Ele admite temporariamente somente os dois advisories de `image-size@1.2.1`
sem patch upstream; `audit:raw` mostra o resultado bruto. Essa admissao mantem
o CI verificavel, mas nao autoriza distribuicao. O app exige audit zerado e os
demais gates de `fase-243-modernizacao-hardening-mobile.md` antes de um build de
loja.

### Fase 223 - verdade operacional do go-live

Fase exclusivamente documental. Validar sem tocar banco, variaveis ou servicos:

```powershell
git diff --check
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

O aceite exige que as afirmacoes marcadas como prontas apontem para evidencia
existente e que gates externos, fluxos mutaveis e itens condicionais permanecam
explicitamente pendentes.

### Fase 231 - jornadas E2E mutaveis em staging

O contrato local valida que o workflow permanece manual, descartavel e sem
referencias a producao:

```powershell
pnpm test:e2e:staging:config
pnpm test:staging-fixtures
pnpm --dir octaclin-backend test -- --runInBand src/infraestrutura/e2e/alvo-staging-e2e.spec.ts
```

O aceite real deve ser disparado manualmente no workflow `OctaClin staging E2E
mutavel`. Ele exige as variaveis `NEON_E2E_PROJECT_ID`,
`NEON_E2E_PARENT_BRANCH_ID`, `NEON_E2E_DATABASE`, `NEON_E2E_RUNTIME_ROLE` e o
secret `NEON_API_KEY`. Nunca apontar essas configuracoes para producao.

O gate cria uma branch Neon descartavel, aplica migrations, valida role/RLS e
dois tenants, sobe Redis e MinIO efemeros, executa backend/BFF reais e remove a
branch com `if: always()`. Em 2026-08-13, a execucao `31731167549` passou no
commit `04f6bb9`.

### Fase 242 - observabilidade interna e rollout seguro

```powershell
pnpm test:rollout
pnpm --dir octaclin-backend test -- --runInBand src/infraestrutura/observabilidade/servico-telemetria-operacional.spec.ts src/infraestrutura/observabilidade/interceptor-log-requisicao.spec.ts src/infraestrutura/feature-flags/servico-feature-flags.spec.ts src/infraestrutura/feature-flags/guarda-feature-flag.spec.ts src/modulos/operacoes/aplicacao/servico-rollout-operacional.spec.ts src/modulos/operacoes/apresentacao/controlador-operacoes.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:seguranca-operacional
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --grep "operacoes rollout seguro|operacoes LGPD|operacoes assinatura"
```

O snapshot nao pode conter payload, query string, credencial ou dado clinico.
As rotas BFF de feature flags devem continuar exigindo
`operacoes.tenants.gerenciar`. Nao ha migration nesta fase.

### Fase 251 - linguagem e microcopy

```powershell
pnpm --dir octaclin-web test:linguagem
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web build
pnpm --dir octaclin-web test:fase251
pnpm --dir octaclin-web test:a11y
pnpm --dir octaclin-web test:fase248
pnpm --dir octaclin-web test:fase249
```

O gate AST deve examinar somente texto visivel e nunca reescrever IDs, enums,
rotas ou contratos internos. O aceite no Browser exige `lang=pt-BR`, foco
visivel, nomes acessiveis, contraste AA, ausencia de overflow horizontal e
console sem erros. Todos os dados do teste Playwright devem ser sinteticos.

### Fase 252 - navegacao e descoberta por papel

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web build
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:base-visual
pnpm --dir octaclin-web test:linguagem
pnpm --dir octaclin-web test:fase252
pnpm --dir octaclin-web test:a11y
```

O catalogo deve cobrir exatamente as rotas operacionais publicadas. Papel e
permissao precisam concordar; Patient e Client nao recebem comandos do console,
e Operacoes nunca aparece fora do SuperAdmin. Em 390 px, o disclosure de
modulos deve abrir por teclado, manter foco visivel e nao causar overflow.
