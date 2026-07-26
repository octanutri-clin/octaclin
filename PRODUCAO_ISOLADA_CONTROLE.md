# OctaClin - Controle da producao isolada de staging

Este arquivo acompanha a execucao real da Fase 131, seguindo
`RUNBOOK_PRODUCAO_ISOLADA.md`. Nunca registre valores reais de secrets, URLs de
banco/cache com credencial ou dominio privado aqui - apenas status.

## Status atual

Estrutura da fase entregue em 2026-07-23 (runbook, este controle e validador
documental). Banco Neon de producao e Redis Upstash de producao criados e
validados em 2026-07-23.

Em 2026-07-26, os servicos Render de producao foram corrigidos, receberam
deploy e ficaram em live. O health detalhado confirmou banco e Redis
operacionais, e o login do usuario SuperAdmin foi validado pela interface.
A fase foi aceita em 2026-07-26 apos a confirmacao da rotacao de credenciais,
auditoria de variaveis sem staging e conferencia do banco sem dados de staging.
Google Calendar permanece degradado ate o callback OAuth de producao ser
concluido no trabalho separado da Fase 136.

## Recursos a criar

| Recurso | Status | Data | Observacao |
| --- | --- | --- | --- |
| Banco Neon de producao (projeto/branch proprio) | Feito | 2026-07-23 | Projeto dedicado `Octaclin-db-producao`, host proprio, distinto do staging (`ep-rough-bird-atunz76m`). |
| Migrations aplicadas no banco novo (`pnpm --dir octaclin-backend migration:run`) | Feito | 2026-07-23 | 8/8 migrations aplicadas (`migration:show` sem pendencias). Confirmado `tenants=0` e `usuarios=0` apos a migracao: banco vazio, sem dado de staging. |
| Redis Upstash de producao | Feito | 2026-07-23 | Instancia dedicada (`relieved-goose-91945.upstash.io`). `PING` validado via TLS (`rediss://`) com `ioredis`. |
| Render backend de producao | Feito | 2026-07-26 | Servico `octaclin-backend-producao` em live; health e health detalhado respondendo. |
| Render web de producao | Feito | 2026-07-26 | Servico `octaclin-web-producao` em live; login e dashboard validados pela interface. |
| Secrets de producao (`JWT_SEGREDO`, `JWT_REFRESH_SEGREDO`, `CRIPTOGRAFIA_CHAVE_AES_256`, `DATABASE_URL`, `REDIS_URL`) | Feito | 2026-07-26 | Credenciais expostas rotacionadas e atualizadas apenas no Render; auditoria de isolamento confirmada pelo responsavel. |
| Credenciais de integracao proprias de producao (Gmail/SMTP, Meta WhatsApp, Google Calendar) | Feito para Fase 131 | 2026-07-26 | Gmail e WhatsApp saudaveis; Google Calendar permanece desabilitado/degradado ate o callback OAuth da Fase 136. |
| Primeiro deploy validado (`/health`, `/health/detalhado`, login) | Feito | 2026-07-26 | Backend e web em live; health, health detalhado e login SuperAdmin confirmados. |

## Registro de execucao

Use esta lista para registrar cada passo real conforme for executado (data,
o que foi feito, quem confirmou). Nao inclua valores de secrets.

- 2026-07-23: estrutura da fase (runbook, este controle e validador) criada e
  commitada. Nenhum recurso de infraestrutura provisionado ainda.
- 2026-07-23: usuario criou o projeto Neon de producao dedicado
  (`Octaclin-db-producao`). `DATABASE_URL` usada apenas como variavel de
  ambiente de sessao para rodar `pnpm --dir octaclin-backend migration:run`;
  nao foi gravada em nenhum arquivo do repositorio. 8/8 migrations aplicadas
  com sucesso; `migration:show` sem pendencias; contagem confirmada de
  `tenants=0` e `usuarios=0` no banco novo. Observacao de seguranca: a URL
  apareceu em texto no chat durante a troca de credencial; recomendado
  rotacionar a senha do role `neondb_owner` no console Neon (`RUNBOOK_ROTACAO_SECRETS.md`,
  secao Neon/Postgres) antes de considerar o secret definitivo.
- 2026-07-23: usuario criou a instancia Upstash de producao dedicada. `REDIS_URL`
  usada apenas como variavel de ambiente de sessao (convertida para
  `rediss://` para forcar TLS, conforme `configuracao-redis.ts`); nao foi
  gravada em nenhum arquivo do repositorio. `PING` respondeu `PONG` via
  `ioredis` com TLS. Mesma observacao de seguranca: o token apareceu em texto
  no chat e deve ser rotacionado no console Upstash antes de considerar o
  secret definitivo (`RUNBOOK_ROTACAO_SECRETS.md`, secao Upstash/Redis).
- 2026-07-24: usuario criou `octaclin-backend-producao` (Docker) e
  `octaclin-web-producao` (Node) no Render seguindo a configuracao de
  `RUNBOOK_PRODUCAO_ISOLADA.md`. Pelo menos um deploy falhou. Sem acesso a
  browser/dashboard Render nesta sessao (Claude Code via CLI) para ler o log
  de build/deploy real, a causa nao foi diagnosticada. Trabalho pausado aqui
  e passado para o Codex (que tem acesso via browser ao Render) continuar o
  diagnostico e a correcao.
- 2026-07-24: usuario confirmou que os dois servicos Render de producao estao
  rodando (web e backend). Criado script minimo
  `octaclin-backend/src/infraestrutura/banco-dados/seeds/criar-admin-producao.ts`
  (`pnpm --dir octaclin-backend run criar-admin:producao`) para gerar apenas
  um tenant + um usuario `SuperAdmin` diretamente em producao, sem dados fake
  de paciente/profissional/mensagens (diferente de `seed-demo.ts`, que nao foi
  usado). Rodado uma vez contra o banco `Octaclin-db-producao` com
  `DATABASE_URL` como variavel de sessao (nao gravada em arquivo); tenant
  `octaclin-admin` e usuario `octavioomarostica@gmail.com` (`SuperAdmin`)
  criados com sucesso. Observacao de seguranca: a `DATABASE_URL` apareceu em
  texto no chat novamente durante esta etapa; ainda pendente a rotacao da
  senha do role `neondb_owner` recomendada anteriormente
  (`RUNBOOK_ROTACAO_SECRETS.md`, secao Neon/Postgres). Login ainda nao
  validado via curl/browser nesta sessao - falta confirmar com a URL publica
  do servico web de producao.
- 2026-07-26: deploy de producao corrigido e confirmado em live. O Redis
  inicialmente recusava autenticacao por credencial invalida; a `REDIS_URL`
  foi atualizada no Render usando a URL TLS da instancia dedicada. Em seguida,
  `/health/detalhado` retornou banco e Redis como `ok`, sem alerta critico, e
  o login do SuperAdmin foi concluido pela web com redirecionamento para
  `/dashboard`. Google Calendar ficou `degradado` enquanto o callback OAuth
  de producao e finalizado em trabalho separado.
- 2026-07-26: revisao de aceite apos a Fase 142. O Render confirmou o web de
  producao em `live` no commit `c110efa`; `/login` respondeu HTTP 200. O
  backend respondeu `ok` em `/health`; em `/health/detalhado`, backend, banco,
  Redis, email e WhatsApp estavam `ok`. O status agregado permaneceu
  `degradado` somente pelo Google Calendar sem callback OAuth de producao,
  pendencia ja tratada em trabalho separado. O aceite final nao foi dado:
  faltam rotacao de credenciais expostas, auditoria de variaveis sem staging e
  confirmacao de ausencia de dados de staging no banco.
- 2026-07-26: responsavel confirmou a rotacao das credenciais expostas, a
  auditoria de variaveis do Render sem referencias de staging e a ausencia de
  dados do tenant de staging no banco Neon de producao. Revalidacao final:
  `/health=ok`, backend/banco/Redis/email/WhatsApp `ok` em
  `/health/detalhado` e `/login` HTTP 200. Aceite operacional registrado;
  Google Calendar continua pendente na Fase 136.

## Handoff para o Codex

Contexto para quem retomar com acesso ao dashboard Render:

1. Os dois servicos ja existem: `octaclin-backend-producao` (`Language:
   Docker`, Build Context `octaclin-backend`, Dockerfile Path
   `octaclin-backend/Dockerfile`) e `octaclin-web-producao` (`Language:
   Node`, Root Directory `octaclin-web`, Build Command
   `corepack enable && pnpm install --frozen-lockfile && pnpm build`, Start
   Command `pnpm start`). Configuracao completa em
   `RUNBOOK_PRODUCAO_ISOLADA.md`.
2. O banco Neon de producao (`Octaclin-db-producao`) e o Redis Upstash de
   producao ja estao criados e validados (ver tabela acima); as variaveis
   `DATABASE_URL` e `REDIS_URL` de producao ja devem ter sido configuradas
   pelo usuario no Render ao criar os servicos.
3. Pelo menos um deploy falhou. Abrir a aba de logs de build/deploy de cada
   servico no dashboard, identificar a causa exata (dependencia, variavel de
   ambiente ausente, health check, memoria do plano, etc.) e corrigir.
4. Validacao local feita pelo Codex em 2026-07-24: `pnpm --dir
   octaclin-backend build`, `pnpm --dir octaclin-web build` e `pnpm --dir
   octaclin-web typecheck` passaram. A primeira falha local de Next
   (`PageNotFoundError` em `/api/cliente/configuracoes`) desapareceu apos um
   rebuild completo, indicando cache/artefato parcial de `.next`, nao erro de
   codigo versionado. Se o web falhar no Render com esse mesmo erro, usar
   `Manual Deploy` com limpeza de build cache.
5. Suspeitas mais provaveis a descartar primeiro: caminho Docker ambiguo no
   backend (`Root Directory=octaclin-backend` combinado com `Dockerfile
   Path=octaclin-backend/Dockerfile`), variavel obrigatoria
   ausente (`JWT_SEGREDO`, `JWT_REFRESH_SEGREDO`,
   `CRIPTOGRAFIA_CHAVE_AES_256` no backend; `NEXT_PUBLIC_API_URL`/
   `OCTACLIN_BACKEND_URL` no web), `REDIS_URL` sem `rediss://` (TLS
   obrigatorio, ver `configuracao-redis.ts`), `BANCO_EXECUTAR_MIGRACOES` sem
   estar `false` tentando rodar migration de novo, ou plano Free do Render
   sem recurso suficiente para o build.
6. Depois de corrigir e o deploy ficar verde, seguir a secao "Validacao do
   ambiente novo" de `RUNBOOK_PRODUCAO_ISOLADA.md` (`/health`,
   `/health/detalhado`, login) antes de marcar qualquer linha da tabela acima
   como `Feito`.
7. Atualizar esta tabela, o registro de execucao e, se tudo passar, a secao
   "Decisao de aceite" abaixo.

## Validacoes pendentes antes do aceite

- [x] Todos os recursos bloqueantes da Fase 131 marcados como `Feito`.
- [x] `curl https://<backend-producao-url>/health` respondendo `status: ok`.
- [x] `curl https://<backend-producao-url>/health/detalhado` sem alerta critico.
- [x] Login validado com usuario criado diretamente em producao.
- [x] Nenhuma variavel/secret de staging presente no ambiente Render de producao.
- [x] Nenhum dado do tenant `octaclin-staging` presente no banco de producao.
- [x] `pnpm security:secrets` limpo.

## Decisao de aceite

- Status: aceito.
- Decisao: producao isolada de staging aprovada para prosseguir com a Fase 132.
- Responsavel pela decisao final: responsavel do projeto, por confirmacao em
  2026-07-26.
- Data: 2026-07-26.

## Proximo passo

1. Iniciar a Fase 132 quando existir dominio oficial para configurar DNS, SSL e
   identidade de envio.
2. Concluir o callback OAuth e a validacao real da Google Calendar na Fase 136
   antes de habilitar essa integracao para clientes reais.
