# Fase 58 - Token permanente Meta WhatsApp

## Objetivo

Substituir o token temporario/de desenvolvimento da Meta por um token permanente de System User, reduzindo o risco de expiracao silenciosa da integracao WhatsApp em staging e preparando o caminho para producao.

## Contexto

O envio e recebimento WhatsApp ja estao funcionais no OctaClin:

- envio real via Meta Cloud API;
- webhook validado;
- status Meta persistido;
- mensagens recebidas persistidas;
- respostas associadas ao paciente por contato ou por envio anterior.

O risco atual e operacional: tokens gerados na tela de API setup da Meta sao temporarios. Para uso continuo, a Meta recomenda criar um System User no Business Manager e gerar um token com as permissoes do app/WhatsApp.

## Caminho na Meta

Use uma conta administradora do Business Manager associado ao app OctaClin.

1. Acesse o Business Settings:
   - `https://business.facebook.com/settings`
2. Abra `Users` > `System users`.
3. Crie um System User:
   - nome sugerido: `octaclin-staging-whatsapp`
   - tipo/papel: `Admin`, se disponivel para o ambiente.
4. Associe assets ao System User:
   - app Meta `OctaClin`;
   - WhatsApp Business Account usado no app;
   - permissao suficiente para gerenciar/enviar mensagens.
5. Gere um novo token para esse System User selecionando o app OctaClin.
6. Marque as permissoes:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
   - `whatsapp_business_manage_events`, se disponivel no seletor.
7. Copie o token apenas uma vez e mantenha fora do Git.

## Atualizacao no Render

Servico:

```text
octaclin-backend-staging
```

Variavel a substituir:

```text
META_WHATSAPP_TOKEN=<novo token permanente>
```

Variaveis que devem permanecer:

```text
META_WHATSAPP_PHONE_NUMBER_ID=1166704896532308
META_WHATSAPP_API_VERSION=v25.0
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=<segredo atual>
META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN=<segredo atual>
```

Depois de salvar a variavel no Render, aguarde o redeploy automatico ou execute um manual deploy do backend.

## Validacao

Depois do deploy:

1. Confirmar `GET /health` do backend.
2. Fazer um disparo WhatsApp pelo console `/comunicacoes`.
3. Confirmar que a mensagem chega no WhatsApp.
4. Confirmar em `/comunicacoes` que:
   - a mensagem fica `enviado`;
   - o status Meta atualiza para `Entregue` ou equivalente;
   - uma resposta do usuario aparece como `recebido`.

### Tentativa em staging - 2026-07-13

- `META_WHATSAPP_TOKEN` foi substituido no Render por um novo token gerado manualmente.
- Render disparou deploy do backend e `GET /health` respondeu `status: ok`.
- Um disparo WhatsApp pelo endpoint `POST /comunicacoes/mensagens` criou a mensagem `d3a3e796-c4ec-4fc6-861e-92589aa64ef7`.
- O processamento falhou na Meta Cloud API com `OAuthException`, codigo `190`, indicando erro de autenticacao do token.
- Nenhum token foi registrado neste documento ou no Git.

Conclusao: a troca operacional no Render esta validada, mas o token gerado ainda nao esta valido para o app/ativo WhatsApp usado pelo OctaClin.

### Segunda tentativa em staging - 2026-07-13

- Novo token gerado manualmente foi salvo em `META_WHATSAPP_TOKEN` no Render.
- Chamada direta para a Graph API com o novo token foi aceita pela Meta, confirmando que o token e valido.
- O envio pelo OctaClin continuou falhando com `OAuthException`, codigo `190`.
- Causa encontrada no backend: o adaptador WhatsApp priorizava `canal.configuracao.token` antes de `META_WHATSAPP_TOKEN`; como o canal de staging tinha token antigo salvo no banco, a variavel nova do Render era ignorada.
- Correcao aplicada: `META_WHATSAPP_TOKEN` passa a ter precedencia; `canal.configuracao.token` fica apenas como fallback.
- Validacao local:
  - `pnpm exec jest --runInBand src/modulos/comunicacoes/infraestrutura/adaptadores/adaptador-whatsapp-meta.spec.ts`: passou.
  - Backend `pnpm typecheck`: passou.

### Validacao final em staging - 2026-07-13

- Commit `eb485da` publicado no backend staging.
- `META_WHATSAPP_TOKEN` foi salvo novamente no Render usando edicao interativa do campo para garantir que a UI aplicasse a mudanca.
- `GET /health` respondeu `status: ok`.
- Disparo real pelo OctaClin criou a mensagem `a5adb39e-1eef-4f8a-864a-24dbafa32ff5`.
- Resultado do processamento:
  - `status: enviado`
  - `erro: null`
  - ID externo Meta presente
  - `payload.ultimoStatusMeta.status: delivered`

Conclusao: token permanente funcional em staging e backend usando a variavel de ambiente corretamente.

## Rollback

Se o novo token falhar:

1. Recolocar temporariamente o token anterior em `META_WHATSAPP_TOKEN`, se ainda estiver valido.
2. Confirmar se o System User tem acesso ao app e ao WhatsApp Business Account.
3. Gerar novo token com as permissoes listadas.
4. Repetir a validacao.

## Correcao do token invalido

Para a proxima tentativa, gerar o token novamente conferindo estes pontos antes de salvar no Render:

1. O System User deve pertencer ao mesmo Business Manager do app `OctaClin`.
2. O System User precisa ter acesso ao app Meta do OctaClin.
3. O System User precisa ter acesso ao WhatsApp Business Account que contem o Phone Number ID `1166704896532308`.
4. O token deve ser gerado selecionando o app OctaClin.
5. O token deve incluir `whatsapp_business_messaging` e `whatsapp_business_management`.
6. Se a Meta mostrar prazo de expiracao, selecionar a opcao permanente/sem expiracao quando disponivel.
7. Testar o envio `hello_world` para `5511992362080` logo apos salvar no Render.

## Cuidados

- Nunca colar o token em arquivo versionado.
- Nunca registrar o token em docs, issues ou commits.
- Evitar colocar token em configuracao de canal no banco; o OctaClin ja usa `META_WHATSAPP_TOKEN` como variavel de ambiente.
- Rotacionar o token se ele for exposto em chat, print, commit ou log.

## Status

Concluida em staging: envio WhatsApp pelo OctaClin validado com token permanente salvo em `META_WHATSAPP_TOKEN`, status Meta entregue e sem erro de autenticacao.

### Rotacao final antes da proxima fase - 2026-07-13

- Token Meta rotacionado manualmente pelo usuario e inserido em META_WHATSAPP_TOKEN no Render.
- Nenhum valor de token foi registrado no Git.
- Backend GET /health respondeu status: ok apos a troca.
- Disparo real pelo OctaClin criou a mensagem 15bcd0c3-e397-45ba-955f-a167e2ae1eb2.
- Resultado do processamento:
  - status: enviado
  - erro: null
  - ID externo Meta presente
  - payload.ultimoStatusMeta.status: delivered

