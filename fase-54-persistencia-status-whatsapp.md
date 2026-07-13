# Fase 54 - Persistencia de status WhatsApp

## Objetivo

Transformar callbacks reais da Meta Cloud API em rastreabilidade operacional dentro do OctaClin.

## Implementacao

- Novo `ServicoWebhookWhatsapp`.
- O webhook passa a processar `statuses` recebidos da Meta.
- Cada status e correlacionado com `mensagens_notificacao.payload.resultadoEnvio.idExterno`.
- A mensagem recebe `payload.ultimoStatusMeta` com:
  - `status`
  - `timestamp`
  - `recipientId`
  - `errors`, quando enviado pela Meta.
- Quando a Meta retorna `failed`, a mensagem e marcada como `falhou` e `erro` recebe um resumo seguro.
- O endpoint continua respondendo `200` mesmo se a persistencia falhar, evitando retries desnecessarios da Meta por erro interno nosso.

## Validacao

- `pnpm exec jest --runInBand src/modulos/comunicacoes/apresentacao/controlador-webhook-whatsapp.spec.ts src/modulos/comunicacoes/aplicacao/servico-webhook-whatsapp.spec.ts`: passou.
- `pnpm typecheck`: passou.

## Proximo passo

Expor o `ultimoStatusMeta` no console de Comunicacoes para diferenciar aceito, entregue, lido e falho.
