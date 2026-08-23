# Fase 60 - Inbox WhatsApp

## Objetivo

Evoluir a area de Comunicacoes para uma inbox operacional de conversas WhatsApp, usando as mensagens recebidas e enviadas ja persistidas no OctaClin.

## Implementacao

- Backend passou a retornar ate 200 mensagens recentes em `GET /comunicacoes/mensagens`, aumentando a janela usada pela inbox.
- Console `/comunicacoes` ganhou a secao `Inbox WhatsApp`.
- Conversas sao agrupadas por paciente vinculado ou contato WhatsApp.
- Cada conversa exibe:
  - paciente ou contato;
  - telefone;
  - ultima mensagem;
  - totais de mensagens recebidas, enviadas e falhas.
- Inbox ganhou filtros:
  - todas;
  - com entrada;
  - com falha.
- Ao selecionar uma conversa, a tela mostra a thread em ordem cronologica.
- Mensagens enviadas e recebidas aparecem em lados diferentes da thread.
- Status da mensagem e status Meta continuam visiveis na thread.
- Botao `Responder` prepara o formulario de disparo manual com:
  - paciente, quando vinculado;
  - canal WhatsApp ativo;
  - template WhatsApp aprovado disponivel;
  - telefone da conversa;
  - observacao de resposta manual.

## Limite atual

Enquanto os templates reais em portugues ainda nao forem aprovados na Meta, a resposta manual usa o template WhatsApp aprovado disponivel no OctaClin, hoje o `hello_world` em staging.

Depois da aprovacao dos templates reais, o mapeamento da Fase 59 deve alimentar a inbox com templates adequados para resposta operacional.

## Validacao

- Backend `pnpm typecheck`: passou.
- Web `pnpm typecheck`: passou.

## Proximo passo

Publicar em staging, validar visualmente `/comunicacoes` e testar o botao `Responder` em uma conversa real.
