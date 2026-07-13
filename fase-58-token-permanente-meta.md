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

## Rollback

Se o novo token falhar:

1. Recolocar temporariamente o token anterior em `META_WHATSAPP_TOKEN`, se ainda estiver valido.
2. Confirmar se o System User tem acesso ao app e ao WhatsApp Business Account.
3. Gerar novo token com as permissoes listadas.
4. Repetir a validacao.

## Cuidados

- Nunca colar o token em arquivo versionado.
- Nunca registrar o token em docs, issues ou commits.
- Evitar colocar token em configuracao de canal no banco; o OctaClin ja usa `META_WHATSAPP_TOKEN` como variavel de ambiente.
- Rotacionar o token se ele for exposto em chat, print, commit ou log.

## Status

Pendente de acao manual no Meta Business Manager: criar System User, gerar token permanente e substituir `META_WHATSAPP_TOKEN` no Render.
