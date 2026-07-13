# Fase 57 - Conversas WhatsApp

## Objetivo

Persistir mensagens recebidas pelo WhatsApp e exibir um historico operacional de conversas no console de Comunicacoes.

## Implementacao

- Webhook WhatsApp agora processa `messages` alem de `statuses`.
- Mensagens recebidas sao persistidas em `mensagens_notificacao` com:
  - `status: recebido`
  - `payload.direcao: recebida`
  - `payload.origem: whatsapp`
  - `payload.idExterno`
  - `payload.remetente`
  - `payload.texto`, quando a mensagem recebida for texto
- Deduplicacao por `payload.idExterno` evita gravar novamente o mesmo evento da Meta.
- Tenant/canal sao identificados pelo `phone_number_id` enviado pela Meta.
- Paciente e associado quando o telefone recebido bate com o contato criptografado descriptografado do paciente.
- Console de Comunicacoes ganhou a secao `Conversas WhatsApp`, agrupando mensagens por paciente ou contato.
- Historico de mensagens diferencia:
  - mensagens enviadas
  - mensagens recebidas
  - status Meta apenas para saidas WhatsApp.

## Validacao

- `pnpm exec jest --runInBand src/modulos/comunicacoes/apresentacao/controlador-webhook-whatsapp.spec.ts src/modulos/comunicacoes/aplicacao/servico-webhook-whatsapp.spec.ts`: passou.
- Backend `pnpm typecheck`: passou.
- Web `pnpm typecheck`: passou.
- Web `pnpm build`: passou.
- Staging web carregou `/comunicacoes` com a nova secao `Conversas WhatsApp`.
- A secao agrupou o historico WhatsApp existente do `Paciente Demo`, ainda sem mensagens recebidas reais apos a publicacao.
- Mensagem real enviada pelo usuario para o numero de teste da Meta foi recebida no webhook e persistida:
  - `status: recebido`
  - `payload.direcao: recebida`
  - `payload.origem: whatsapp`
  - remetente `5511992362080`
  - texto `Ola`
- A mensagem recebida ficou sem `pacienteId` porque o contato cadastrado do paciente demo nao corresponde ao numero usado no teste.

## Proximo passo

Vincular o telefone real ao paciente demo ou adicionar associacao por conversas de saida, para que respostas do mesmo numero aparecam automaticamente no paciente correto.
