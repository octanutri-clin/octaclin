# Fase 131 - Producao isolada de staging

Status: em andamento (estrutura entregue em 2026-07-23; provisionamento real pendente).

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

## O que ainda falta (pendente de acao do usuario)

Provisionamento real, que exige acesso e decisoes nos consoles dos
provedores:

1. Criar o projeto Neon de producao e rodar
   `pnpm --dir octaclin-backend migration:run` contra ele (nunca
   `pnpm seed:staging`).
2. Criar a instancia Upstash de producao.
3. Criar os servicos Render de producao (backend e web), separados dos
   servicos usados hoje como staging.
4. Gerar secrets exclusivos de producao (`JWT_SEGREDO`,
   `JWT_REFRESH_SEGREDO`, `CRIPTOGRAFIA_CHAVE_AES_256`) e credenciais proprias
   de Gmail/Meta/Google quando disponiveis.
5. Validar `/health`, `/health/detalhado` e login no ambiente novo.
6. Atualizar `PRODUCAO_ISOLADA_CONTROLE.md` a cada etapa e registrar a
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
