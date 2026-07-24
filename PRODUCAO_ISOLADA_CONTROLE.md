# OctaClin - Controle da producao isolada de staging

Este arquivo acompanha a execucao real da Fase 131, seguindo
`RUNBOOK_PRODUCAO_ISOLADA.md`. Nunca registre valores reais de secrets, URLs de
banco/cache com credencial ou dominio privado aqui - apenas status.

## Status atual

Estrutura da fase entregue em 2026-07-23 (runbook, este controle e validador
documental). Banco Neon de producao e Redis Upstash de producao criados e
validados em 2026-07-23. Servicos Render de producao e secrets exclusivos
(JWT/AES) ainda pendentes de acao do usuario.

## Recursos a criar

| Recurso | Status | Data | Observacao |
| --- | --- | --- | --- |
| Banco Neon de producao (projeto/branch proprio) | Feito | 2026-07-23 | Projeto dedicado `Octaclin-db-producao`, host proprio, distinto do staging (`ep-rough-bird-atunz76m`). |
| Migrations aplicadas no banco novo (`pnpm --dir octaclin-backend migration:run`) | Feito | 2026-07-23 | 8/8 migrations aplicadas (`migration:show` sem pendencias). Confirmado `tenants=0` e `usuarios=0` apos a migracao: banco vazio, sem dado de staging. |
| Redis Upstash de producao | Feito | 2026-07-23 | Instancia dedicada (`relieved-goose-91945.upstash.io`). `PING` validado via TLS (`rediss://`) com `ioredis`. |
| Render backend de producao | Pendente | - | Servico separado do staging, `Language: Docker` (mesmo runtime do backend de staging). |
| Render web de producao | Pendente | - | Servico separado do staging, `Language: Node` (confirmado com o usuario que o staging usa Node, nao Docker, apesar de existir `octaclin-web/Dockerfile` no repo). |
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

1. Rotacionar a senha do role `neondb_owner` (Neon) e o token da instancia
   Upstash de producao, seguindo `RUNBOOK_ROTACAO_SECRETS.md` (ambos
   apareceram em texto no chat durante o provisionamento).
2. Criar os servicos Render de producao (backend e web), separados dos de
   staging, com `NODE_ENV=production` e as variaveis de
   `VARIAVEIS_AMBIENTE.md`.
3. Validar `/health` e `/health/detalhado` apos o primeiro deploy e atualizar
   a tabela acima a cada etapa concluida.
