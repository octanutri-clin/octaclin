# OctaClin - Runbook de producao isolada de staging

Este runbook descreve como criar um ambiente de producao totalmente separado do
staging atual antes de qualquer cliente real de consultoria (Fase 131). Ele
complementa `RUNBOOK_PRODUCAO.md` (operacao do dia a dia) e `VARIAVEIS_AMBIENTE.md`
(lista de variaveis sem valores).

## Objetivo

Ter banco, Redis, servicos Render, variaveis e secrets de producao totalmente
independentes do staging atual, de forma que nenhuma acao em producao possa
afetar staging e vice-versa.

## Por que isso e necessario agora

O ambiente hoje usado como staging (`octaclin-staging`, ver `RUNBOOK_STAGING_DADOS.md`
e `PILOTO_INTERNO_CONTROLE.md`) roda no mesmo projeto Neon rotulado "production"
no console, porque o produto ainda nao foi lancado e nao existe outro projeto.
Antes de convidar clientes reais, producao precisa de recursos proprios, nunca
compartilhados com staging.

## Recursos a criar

Cada recurso abaixo deve ser criado do zero, sem reaproveitar o que hoje serve
como staging.

1. **Banco Neon de producao**: novo projeto Neon dedicado (branch `main` propria),
   nunca o mesmo projeto/branch usado para staging.
2. **Redis Upstash de producao**: nova instancia Upstash dedicada, separada da
   usada em staging. Observacao: staging usa hoje o servico nativo
   `Key Value` do Render (Valkey 8, `octaclin-redis-staging`), nao Upstash
   externo. Producao pode usar um provedor diferente do de staging sem
   problema - o requisito desta fase e isolamento, nao paridade de provedor.
   O importante e que `REDIS_URL` de producao use `rediss://` (TLS) quando o
   provedor exigir, conforme `configuracao-redis.ts`.
3. **Render backend de producao**: novo servico Render (ou novo environment),
   nunca o mesmo servico Render usado para staging.
4. **Render web de producao**: novo servico Render (ou novo environment),
   separado do servico Render de staging.
5. **Variaveis e secrets de producao**: todas as variaveis de
   `VARIAVEIS_AMBIENTE.md` configuradas com valores proprios de producao,
   nunca copiadas de staging (`JWT_SEGREDO`, `JWT_REFRESH_SEGREDO`,
   `CRIPTOGRAFIA_CHAVE_AES_256`, `DATABASE_URL`, `REDIS_URL` e credenciais de
   Gmail/Meta/Google devem ser exclusivas de producao).
6. **Dominio**: fica formalizado na Fase 132 (`RUNBOOK_PRODUCAO.md` ja preve
   dominio/SSL separados); nesta fase basta reservar a URL Render de producao
   e nao publicar o dominio oficial ainda.

## Ordem recomendada de execucao

1. Criar o projeto Neon de producao e guardar a `DATABASE_URL` apenas no
   gerenciador de secrets do Render (nunca em arquivo do repositorio).
2. Rodar as migrations no banco novo, sem aplicar `pnpm seed:staging`
   (producao nunca recebe massa ficticia):

   ```powershell
   $env:DATABASE_URL='<url do Neon producao>'
   pnpm --dir octaclin-backend migration:run
   ```

3. Criar a instancia Upstash de producao e guardar a `REDIS_URL` apenas no
   Render.
4. Criar o(s) servico(s) Render de producao (backend e web), separados dos
   servicos de staging, com `NODE_ENV=production`. Ver "Como criar os
   servicos no Render" abaixo para o passo a passo no dashboard.
5. Gerar valores exclusivos de producao para `JWT_SEGREDO`,
   `JWT_REFRESH_SEGREDO` e `CRIPTOGRAFIA_CHAVE_AES_256` (nunca reaproveitar os
   de staging). Guardar apenas no Render.
6. Configurar credenciais proprias de producao para Gmail/SMTP, Meta WhatsApp
   e Google Calendar quando disponiveis; enquanto nao houver credencial de
   producao aprovada, manter a integracao correspondente desativada em vez de
   reaproveitar a credencial de staging.
7. Fazer o primeiro deploy do backend e do web de producao.
8. Validar o ambiente novo (ver secao seguinte) antes de registrar qualquer
   avanco em `PRODUCAO_ISOLADA_CONTROLE.md`.

## Como criar os servicos no Render

Staging usa runtimes diferentes por servico, confirmado no dashboard Render:

- `octaclin-backend-staging`: `Language: Docker`.
- `octaclin-web-staging`: `Language: Node` (nao Docker, mesmo havendo um
  `octaclin-web/Dockerfile` no repositorio - esse arquivo existe mas nao e o
  usado pelo servico web hoje).
- `octaclin-redis-staging`: servico Render nativo `Key Value` (Valkey 8), nao
  Upstash externo (ver observacao na secao de Redis mais abaixo).

Repita exatamente essa combinacao de runtimes para producao, em servicos
novos e separados dos de staging: backend em Docker, web em Node.

O `Dockerfile` do backend espera que o contexto de build seja a propria pasta
`octaclin-backend`, porque copia `package.json`/`pnpm-lock.yaml*`/
`pnpm-workspace.yaml` direto na raiz do contexto antes de `COPY . .`. Por
isso o contexto Docker efetivo **nao** pode ser a raiz do repositorio.

Atencao ao monorepo no Render: se o campo `Root Directory` estiver preenchido,
os caminhos de Docker tambem passam a ser relativos a esse root. Use apenas
uma das duas configuracoes abaixo, nunca uma mistura das duas.

- Opcao A, recomendada por ser explicita: `Root Directory` vazio,
  `Dockerfile Path=octaclin-backend/Dockerfile` e
  `Docker Build Context Directory=octaclin-backend`.
- Opcao B, equivalente: `Root Directory=octaclin-backend`,
  `Dockerfile Path=Dockerfile` e `Docker Build Context Directory=.`.

Se `Root Directory=octaclin-backend` for combinado com
`Dockerfile Path=octaclin-backend/Dockerfile`, o Render tende a procurar o
arquivo dentro de `octaclin-backend/octaclin-backend/Dockerfile` e o deploy
falha antes mesmo de construir a aplicacao.

### Backend (`octaclin-backend`)

1. No Render, `New +` > `Web Service` > conectar o repositorio
   `octanutri-clin/octaclin` > escolher `Runtime: Docker` quando perguntado.
2. `Name`: algo que deixe claro que e producao (ex.: `octaclin-backend-producao`),
   nunca reaproveitar o nome/servico do staging.
3. `Root Directory`: deixar vazio se usar a configuracao recomendada abaixo.
4. `Docker Build Context Directory`: `octaclin-backend`.
5. `Dockerfile Path`: `octaclin-backend/Dockerfile`.
6. `Docker Command`: deixar em branco. O `CMD ["node", "dist/main.js"]` ja
   definido no Dockerfile e suficiente; so preencher este campo se precisar
   sobrescrever o comando padrao.
7. `Pre-Deploy Command`: deixar em branco. O backend ja executa as
   migrations pendentes no proprio boot via TypeORM
   (`migrationsRun`, controlado por `BANCO_EXECUTAR_MIGRACOES`), entao nao
   ha comando separado de release/pre-deploy neste projeto.
8. `Auto-Deploy`: `On Commit` (mesmo fluxo ja usado hoje: commit e push para
   `main` dispara deploy).
9. `Build Filters`: `Included Paths` = `octaclin-backend/**`. Isso evita que
   commits que so tocam documentacao ou `octaclin-web` disparem rebuild do
   backend.
10. `Health Check Path`: `/health`.
11. Variaveis de ambiente (todas as obrigatorias de `VARIAVEIS_AMBIENTE.md`
    para as integracoes usadas), incluindo:
    - `NODE_ENV=production`
    - `PORT=3000` (o Dockerfile expoe a porta 3000; defina explicitamente
      para nao depender da porta padrao do Render para outros runtimes)
    - `DATABASE_URL` e `REDIS_URL` de producao ja criadas
    - `BANCO_EXECUTAR_MIGRACOES=false` (as migrations de producao ja foram
      aplicadas manualmente; nao deixar o backend rodar migration
      automatica de novo sem revisao a cada deploy)
    - `OCTACLIN_WEB_URL` apontando para a URL do servico web de producao
      (preencher depois de criar o servico web, passo seguinte)
    - `JWT_SEGREDO`, `JWT_REFRESH_SEGREDO`, `CRIPTOGRAFIA_CHAVE_AES_256`
      exclusivos de producao.
12. Plano: escolher um plano pago do Render (planos gratuitos hibernam e nao
    servem para producao com clientes reais).

### Web/BFF (`octaclin-web`)

O servico de staging (`octaclin-web-staging`) usa `Language: Node` (nao
Docker), mesmo havendo um `octaclin-web/Dockerfile` no repositorio. Repita o
runtime Node para manter paridade com staging.

1. `New +` > `Web Service` > mesmo repositorio > `Language: Node`.
2. `Name`: `octaclin-web-producao` (ou equivalente), separado do staging.
3. `Root Directory`: `octaclin-web`.
4. `Build Command`:
   ```
   corepack enable && pnpm install --frozen-lockfile && pnpm build
   ```
5. `Start Command`:
   ```
   pnpm start
   ```
6. `Auto-Deploy`: `On Commit`. Com `Root Directory` definido, o Render ja
   restringe autodeploy a mudancas dentro de `octaclin-web/`; nao e
   necessario configurar Build Filters manualmente.
7. Variaveis de ambiente:
   - `NODE_ENV=production`
   - `OCTACLIN_BACKEND_URL` apontando para a URL do backend de producao
   - `OCTACLIN_TENANT_SLUG` com o slug da organizacao atendida pelo servico
   - `OCTACLIN_API_ORIGENS_PERMITIDAS` restrito a essa mesma URL do backend
   - `OCTACLIN_COOKIE_SECURE=true`
   - Nao defina `PORT` manualmente: o Render injeta a variavel `PORT`
     automaticamente para runtime nativo e o `next start` ja respeita esse
     valor.
8. Plano pago, mesmo motivo do backend.

### Depois de criar os dois servicos

1. Copiar a URL publica do servico web e configurar `OCTACLIN_WEB_URL` no
   servico backend (passo 10 acima), depois redeploy do backend se a URL nao
   estava disponivel antes.
2. Aguardar o primeiro deploy de cada servico terminar sem erro de build.
3. Seguir a secao "Validacao do ambiente novo" abaixo.
4. Registrar nome dos servicos (sem URL nem token) e status em
   `PRODUCAO_ISOLADA_CONTROLE.md`.

## Validacao do ambiente novo

Depois do primeiro deploy, validar nesta ordem:

```powershell
curl https://<backend-producao-url>/health
curl https://<backend-producao-url>/health/detalhado
```

Em seguida, validar manualmente:

- login com um usuario criado diretamente em producao (nunca copiar usuario
  de staging);
- `/health/detalhado` sem alertas criticos;
- nenhuma variavel de staging presente no ambiente Render de producao;
- nenhum dado do tenant `octaclin-staging` presente no banco de producao;
- `npm run security:secrets` limpo antes do commit de qualquer ajuste de
  documentacao desta fase.

## Regras que nao podem ser quebradas

- Nunca rodar `pnpm seed:staging` contra o banco de producao.
- Nunca copiar `DATABASE_URL`, `REDIS_URL`, `JWT_SEGREDO`,
  `JWT_REFRESH_SEGREDO` ou `CRIPTOGRAFIA_CHAVE_AES_256` de staging para
  producao.
- Nunca registrar valor real de secret, URL de banco/cache ou dominio privado
  em arquivo versionado. Use `PRODUCAO_ISOLADA_CONTROLE.md` apenas para
  registrar status (feito/pendente), nunca valores.
- Nunca convidar cliente real antes de `CHECKLIST_GO_LIVE.md` estar completo.
- Se qualquer secret aparecer em chat, log ou commit, seguir
  `RUNBOOK_ROTACAO_SECRETS.md` imediatamente.

## Como decidir que a producao isolada esta pronta

1. Confirmar que todos os itens da secao "Recursos a criar" foram executados
   e registrados em `PRODUCAO_ISOLADA_CONTROLE.md`.
2. Confirmar que a validacao do ambiente novo passou sem pendencia critica.
3. Confirmar em `security:secrets` e em revisao manual que nenhum valor real
   foi commitado.
4. Registrar a decisao final em `PRODUCAO_ISOLADA_CONTROLE.md`: pronto ou
   pendente, com a lista do que falta se pendente.
5. Se pronto, atualizar `PREFLIGHT_PRODUCAO.md`, `CHECKLIST_GO_LIVE.md` e
   `STATUS_ATUAL_PROJETO.md`, e liberar a Fase 132 - Dominio, SSL e identidade
   de envio.

## Runbooks relacionados

- `RUNBOOK_PRODUCAO.md` para operacao do ambiente depois de criado.
- `VARIAVEIS_AMBIENTE.md` para a lista completa de variaveis por area.
- `RUNBOOK_ROTACAO_SECRETS.md` para gerar/rotacionar cada secret com seguranca.
- `RUNBOOK_BACKUP_RESTORE.md` para backup/restore do banco de producao.
- `RUNBOOK_STAGING_DADOS.md` para nao confundir producao com o ambiente de
  staging existente.
- `PRODUCAO_ISOLADA_CONTROLE.md` para o acompanhamento vivo desta fase.
- `CHECKLIST_GO_LIVE.md` para a liberacao final de clientes reais.
