# Fase 55 - Status WhatsApp no console

## Objetivo

Exibir no console de Comunicacoes o status de entrega retornado pela Meta, sem depender de leitura do payload bruto.

## Implementacao

- Historico de mensagens agora mostra:
  - canal
  - template
  - destino
  - data de criacao e envio
  - status interno da mensagem
  - status Meta, como `Aceito`, `Enviado`, `Entregue`, `Lido` ou `Falhou`
- O payload bruto deixou de ser a informacao principal da lista.
- O contrato web de mensagem foi alinhado aos status reais do backend: `pendente`, `processando`, `enviado` e `falhou`.
- Campo de destino do disparo manual passa a respeitar o canal selecionado:
  - e-mail usa input de e-mail;
  - WhatsApp usa input de texto com placeholder de numero E.164.
- Quando o template WhatsApp tem `conteudo.idioma`, o disparo manual envia esse idioma no payload.

## Validacao

- `pnpm typecheck`: passou.
- `pnpm build`: passou.

## Proximo passo

Validar a tela em staging apos deploy da web e fazer um disparo manual via console usando o canal WhatsApp.
