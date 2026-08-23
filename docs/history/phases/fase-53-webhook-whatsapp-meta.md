# Fase 53 - Webhook WhatsApp Meta

## Objetivo

Preparar o backend OctaClin para receber callbacks da Meta Cloud API, permitindo configurar o webhook do app WhatsApp no painel da Meta.

## Implementacao

- Novo endpoint publico:
  - `GET /comunicacoes/webhooks/whatsapp`
  - `POST /comunicacoes/webhooks/whatsapp`
- `GET` implementa o handshake exigido pela Meta:
  - valida `hub.mode=subscribe`
  - compara `hub.verify_token` com `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - retorna `hub.challenge`
- `POST` recebe eventos de WhatsApp e resume:
  - quantidade de `statuses`
  - quantidade de `messages`
  - `phoneNumberIds` presentes no payload
- `POST` pode exigir um token de recebimento por query string quando `META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN` estiver configurado.

## Variaveis

```text
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=<segredo de verificacao da Meta>
META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN=<segredo opcional para URL de recebimento>
```

## URL para Meta

Callback URL de staging:

```text
https://octaclin-backend-staging.onrender.com/comunicacoes/webhooks/whatsapp?token=<META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN>
```

Verify token:

```text
<META_WHATSAPP_WEBHOOK_VERIFY_TOKEN>
```

## Validacao local

- `pnpm test -- --runInBand controlador-webhook-whatsapp.spec.ts`: passou.
- `pnpm typecheck`: passou.

## Validacao em staging

- Variaveis configuradas no Render:
  - `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - `META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN`
- `GET /comunicacoes/webhooks/whatsapp` com `hub.challenge`: passou e retornou o challenge.
- `POST /comunicacoes/webhooks/whatsapp?token=...` com payload simulado: passou e retornou `recebido=true`.
- Callback URL registrada no app Meta e campo `messages` assinado.
- Render recebeu callbacks reais da Meta apos disparo WhatsApp:
  - `statuses=1; messages=0; phoneNumberIds=1166704896532308`
  - eventos repetidos de status foram aceitos pelo endpoint.

## Proximo passo

Persistir os status recebidos da Meta na mensagem correspondente do OctaClin.
