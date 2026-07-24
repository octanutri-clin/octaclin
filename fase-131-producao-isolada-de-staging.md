# Fase 131 - Producao isolada de staging

Status: em andamento (estrutura entregue em 2026-07-23; banco Neon e Redis Upstash de producao criados e validados em 2026-07-23; Render e secrets exclusivos ainda pendentes).

## Objetivo

Criar um ambiente de producao totalmente independente do ambiente hoje usado
como staging: banco Neon, Redis Upstash, servicos Render, variaveis e secrets
proprios, sem nenhum recurso compartilhado com staging.

## Contexto

O piloto interno controlado (Fase 130) foi executado e aprovado em
2026-07-23 usando o unico projeto Neon existente hoje, rotulado "production"
no console mas usado de fato como staging (produto ainda nao lancado, sem
clientes reais). Antes de qualquer cliente real, esse projeto precisa deixar
de ser o unico ambiente: producao precisa de recursos proprios.

## O que foi entregue nesta etapa

- `RUNBOOK_PRODUCAO_ISOLADA.md`: recursos a criar (Neon, Upstash, Render
  backend/web), ordem recomendada de execucao, validacao do ambiente novo,
  regras de separacao de staging e criterio de aceite.
- `PRODUCAO_ISOLADA_CONTROLE.md`: tabela de recursos com status, registro de
  execucao, checklist de validacao e decisao de aceite (hoje pendente).
- `scripts/test-producao-isolada.mjs` e comando `pnpm test:producao-isolada`:
  validador documental garantindo que o runbook e o controle cobrem as secoes
  obrigatorias e nao contem secrets.
- `TESTES_E_VALIDACOES.md`, `validar-preflight.ps1`, `PREFLIGHT_PRODUCAO.md`,
  `CHECKLIST_GO_LIVE.md`, `STATUS_ATUAL_PROJETO.md` e
  `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` atualizados para referenciar os novos
  arquivos e o status real da fase.

## Banco Neon de producao (concluido em 2026-07-23)

O usuario criou o projeto Neon dedicado `Octaclin-db-producao` (host proprio,
distinto do projeto usado como staging). `pnpm --dir octaclin-backend
migration:run` foi executado contra ele com `DATABASE_URL` apenas como
variavel de ambiente de sessao (nunca gravada em arquivo). Resultado: 8/8
migrations aplicadas, `migration:show` sem pendencias, e contagem confirmada
de `tenants=0`/`usuarios=0` (banco vazio, sem dado de staging). A senha desse
role apareceu em texto no chat durante a troca de credencial e deve ser
rotacionada (`RUNBOOK_ROTACAO_SECRETS.md`) antes de considerar o secret
definitivo.

## Redis Upstash de producao (concluido em 2026-07-23)

O usuario criou a instancia Upstash dedicada a producao
(`relieved-goose-91945.upstash.io`). A conexao foi validada com `ioredis`
usando `rediss://` (TLS obrigatorio, conforme `configuracao-redis.ts`): `PING`
respondeu `PONG`. A `REDIS_URL` foi usada apenas como variavel de ambiente de
sessao, nunca gravada em arquivo. O token apareceu em texto no chat durante a
troca de credencial e deve ser rotacionado no console Upstash antes de
considerar o secret definitivo.

## O que ainda falta (pendente de acao do usuario)

Provisionamento real, que exige acesso e decisoes nos consoles dos
provedores:

1. Rotacionar a senha do role `neondb_owner` (Neon) e o token da instancia
   Upstash de producao.
2. Criar os servicos Render de producao (backend e web), separados dos
   servicos usados hoje como staging.
3. Gerar secrets exclusivos de producao (`JWT_SEGREDO`,
   `JWT_REFRESH_SEGREDO`, `CRIPTOGRAFIA_CHAVE_AES_256`) e credenciais proprias
   de Gmail/Meta/Google quando disponiveis.
4. Validar `/health`, `/health/detalhado` e login no ambiente novo.
5. Atualizar `PRODUCAO_ISOLADA_CONTROLE.md` a cada etapa e registrar a
   decisao final de aceite.

## Arquivos principais tocados

- `RUNBOOK_PRODUCAO_ISOLADA.md` (novo)
- `PRODUCAO_ISOLADA_CONTROLE.md` (novo)
- `scripts/test-producao-isolada.mjs` (novo)
- `package.json` (comando `test:producao-isolada`)
- `validar-preflight.ps1` (documentos obrigatorios)
- `TESTES_E_VALIDACOES.md`
- `PREFLIGHT_PRODUCAO.md`
- `CHECKLIST_GO_LIVE.md`
- `STATUS_ATUAL_PROJETO.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`

## Observacoes/pendencias

- Esta etapa nao provisiona nenhum recurso real: nao ha credenciais de Neon,
  Upstash ou Render de producao disponiveis nesta sessao. O proximo passo
  depende do usuario criar os recursos e, quando precisar rodar as migrations
  no banco novo, fornecer a `DATABASE_URL` apenas como variavel de ambiente de
  sessao (nunca em arquivo versionado).
- A fase so deve ser marcada como concluida em
  `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` depois que todos os recursos da tabela
  em `PRODUCAO_ISOLADA_CONTROLE.md` estiverem `Feito` e a decisao de aceite
  estiver registrada.
