# Fase 132 - Preparacao de dominio e identidade de envio

## Decisao atual

O OctaClin nao tera dominio proprio antes da conclusao das validacoes de
producao. Portanto, esta fase foi iniciada apenas como preparacao: nao ha DNS,
SPF, DKIM, DMARC, dominio customizado ou troca de remetente para executar
agora.

As URLs atuais do Render continuam sendo o endereco temporario do web e do
backend. Elas nao devem ser divulgadas como endereco comercial definitivo.

## Escopo que pode avancar sem dominio

- Definir o dominio oficial e onde o DNS sera hospedado.
- Definir se o envio transacional usara Google Workspace, Gmail SMTP ou
  provedor dedicado, sem compartilhar credenciais reais em arquivos ou chat.
- Manter o nome exibido das comunicacoes consistente com OctaClin.
- Preparar a lista de registros DNS que sera aplicada quando o dominio existir:
  verificacao do provedor de envio, SPF, DKIM, DMARC e apontamento HTTPS.

## O que fica bloqueado propositalmente

- Apontar dominio para os servicos Render.
- Emitir ou validar SSL do dominio customizado.
- Criar registros SPF, DKIM e DMARC sem conhecer o dominio e o provedor final.
- Declarar a Fase 132 como concluida.

## Criterio de conclusao

1. Dominio oficial registrado e sob controle da operacao OctaClin.
2. DNS aponta somente para os servicos de producao aprovados.
3. HTTPS/SSL validado no endereco publico oficial.
4. SPF, DKIM e DMARC publicados e validados para o remetente escolhido.
5. Um email transacional real e uma mensagem de agendamento chegam com
   identidade consistente, sem expor URL temporaria do Render.

## Dependencias

- Fechamento da Fase 131, incluindo rotacao de credenciais e aceite
  operacional.
- Definicao do dominio e do responsavel pela conta de DNS.
- Conclusao separada do callback OAuth de producao do Google Calendar.
