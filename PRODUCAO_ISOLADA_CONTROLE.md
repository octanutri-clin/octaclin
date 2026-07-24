# OctaClin - Controle da producao isolada de staging

Este arquivo acompanha a execucao real da Fase 131, seguindo
`RUNBOOK_PRODUCAO_ISOLADA.md`. Nunca registre valores reais de secrets, URLs de
banco/cache com credencial ou dominio privado aqui - apenas status.

## Status atual

Estrutura da fase entregue em 2026-07-23 (runbook, este controle e validador
documental). Banco Neon de producao e Redis Upstash de producao criados e
validados em 2026-07-23.

**Bloqueado em 2026-07-24**: usuario criou os dois servicos Render de
producao (`octaclin-backend-producao` com `Language: Docker`,
`octaclin-web-producao` com `Language: Node`, conforme
`RUNBOOK_PRODUCAO_ISOLADA.md`), mas o deploy de pelo menos um dos servicos
falhou. O usuario nao chegou a compartilhar o log de erro nesta sessao (sem
acesso a browser/dashboard Render neste ambiente para diagnosticar
diretamente). Decisao do usuario: pular esta etapa aqui e deixar para o
Codex, que tem acesso via browser ao dashboard Render, diagnosticar e
resolver a falha de deploy. Ver secao "Handoff para o Codex" abaixo.

## Recursos a criar

| Recurso | Status | Data | Observacao |
| --- | --- | --- | --- |
| Banco Neon de producao (projeto/branch proprio) | Feito | 2026-07-23 | Projeto dedicado `Octaclin-db-producao`, host proprio, distinto do staging (`ep-rough-bird-atunz76m`). |
| Migrations aplicadas no banco novo (`pnpm --dir octaclin-backend migration:run`) | Feito | 2026-07-23 | 8/8 migrations aplicadas (`migration:show` sem pendencias). Confirmado `tenants=0` e `usuarios=0` apos a migracao: banco vazio, sem dado de staging. |
| Redis Upstash de producao | Feito | 2026-07-23 | Instancia dedicada (`relieved-goose-91945.upstash.io`). `PING` validado via TLS (`rediss://`) com `ioredis`. |
| Render backend de producao | Bloqueado | 2026-07-24 | Servico `octaclin-backend-producao` criado (`Language: Docker`), mas deploy falhou. Log de erro nao coletado nesta sessao. |
| Render web de producao | Bloqueado | 2026-07-24 | Servico `octaclin-web-producao` criado (`Language: Node`), mas deploy falhou (ou pode estar afetado pela falha do backend). Log de erro nao coletado nesta sessao. |
| Secrets de producao (`JWT_SEGREDO`, `JWT_REFRESH_SEGREDO`, `CRIPTOGRAFIA_CHAVE_AES_256`, `DATABASE_URL`, `REDIS_URL`) | Pendente | - | Valores exclusivos, nunca copiados de staging. |
| Credenciais de integracao proprias de producao (Gmail/SMTP, Meta WhatsApp, Google Calendar) | Pendente | - | Enquanto pendente, manter integracao correspondente desativada em producao. |
| Primeiro deploy validado (`/health`, `/health/detalhado`, login) | Pendente | - | Ver criterios em `RUNBOOK_PRODUCAO_ISOLADA.md`. |

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

- [ ] Todos os recursos da tabela acima marcados como `Feito`.
- [ ] `curl https://<backend-producao-url>/health` respondendo `status: ok`.
- [ ] `curl https://<backend-producao-url>/health/detalhado` sem alerta critico.
- [ ] Login validado com usuario criado diretamente em producao.
- [ ] Nenhuma variavel/secret de staging presente no ambiente Render de producao.
- [ ] Nenhum dado do tenant `octaclin-staging` presente no banco de producao.
- [ ] `npm run security:secrets` limpo.

## Decisao de aceite

- Status: pendente.
- Decisao: nao aplicavel ainda (aguardando provisionamento real).
- Responsavel pela decisao final: a definir quando os recursos estiverem
  criados.
- Data: -

## Proximo passo

1. Codex diagnostica e corrige a falha de deploy dos servicos Render de
   producao (ver "Handoff para o Codex" acima).
2. Rotacionar a senha do role `neondb_owner` (Neon) e o token da instancia
   Upstash de producao, seguindo `RUNBOOK_ROTACAO_SECRETS.md` (ambos
   apareceram em texto no chat durante o provisionamento), e atualizar os
   valores novos apenas no Render.
3. Validar `/health` e `/health/detalhado` apos o deploy ficar saudavel e
   atualizar a tabela acima a cada etapa concluida.
