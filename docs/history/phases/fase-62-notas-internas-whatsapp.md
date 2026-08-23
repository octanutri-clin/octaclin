# Fase 62 - Notas internas e status de atendimento WhatsApp

## Objetivo

Permitir operacao interna da inbox WhatsApp sem depender de novos templates Meta: registrar notas, combinados e status de acompanhamento/resolucao dentro da conversa.

## Implementacao

- Backend adicionou `POST /comunicacoes/whatsapp/notas`.
- Notas internas sao persistidas em `mensagens_notificacao` com:
  - `status: nota`;
  - `payload.origem: whatsapp`;
  - `payload.direcao: nota`;
  - `payload.tipo: nota_interna`;
  - `payload.contato`;
  - `payload.texto`;
  - `payload.statusAtendimento`, como `acompanhamento` ou `resolvido`.
- Notas nao criam outbox e nao disparam WhatsApp.
- A acao registra auditoria `comunicacoes.whatsapp.nota_registrar`.
- Web adicionou rota BFF `/api/comunicacoes/whatsapp/notas`.
- Inbox WhatsApp ganhou:
  - campo de nota interna;
  - seletor de status `Em acompanhamento` / `Resolvido`;
  - exibicao das notas no centro da thread;
  - badge de status operacional na lista de conversas.

## Validacao

- `pnpm exec jest --runInBand src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts`: passou.
- Backend `pnpm typecheck`: passou.
- Web `pnpm typecheck`: passou.
- Web `pnpm build`: passou.
- Staging backend `GET /health`: passou.
- Staging web `/comunicacoes`: HTTP 200.
- Staging `POST /comunicacoes/whatsapp/notas` criou a nota `9c7094f0-06cd-4c86-b616-046debaf831d` com:
  - `status: nota`;
  - `payload.direcao: nota`;
  - `payload.statusAtendimento: acompanhamento`.

## Proximo passo

Publicar em staging e validar em `/comunicacoes`:

1. selecionar uma conversa WhatsApp;
2. registrar uma nota interna;
3. marcar `Em acompanhamento`;
4. registrar outra nota marcando `Resolvido`;
5. confirmar que a thread e a lista refletem o status operacional.
