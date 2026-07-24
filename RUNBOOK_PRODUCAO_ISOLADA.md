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
2. **Redis Upstash de producao**: nova instancia Upstash dedicada.
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
   servicos de staging, com `NODE_ENV=production`.
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
