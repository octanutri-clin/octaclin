# Fase 52 - WhatsApp Meta Cloud em staging

## Objetivo

Configurar a integracao WhatsApp Meta Cloud API no backend de staging do OctaClin e validar que o envio chega ate a Meta.

## Configuracao aplicada

- App Meta: OctaClin.
- Permissoes concedidas ao token:
  - `whatsapp_business_management`
  - `whatsapp_business_messaging`
  - `whatsapp_business_manage_events`
- Render backend `octaclin-backend-staging` atualizado com:
  - `META_WHATSAPP_TOKEN`
  - `META_WHATSAPP_PHONE_NUMBER_ID`
  - `META_WHATSAPP_API_VERSION=v25.0`
- Phone Number ID usado em staging: numero de teste da Meta.
- Canal OctaClin criado:
  - tipo: `whatsapp`
  - nome: `WhatsApp Meta Cloud staging`
- Template OctaClin criado:
  - canal: `whatsapp`
  - codigo externo: `hello_world`
  - idioma: `en_US`
  - aprovado: `true`

## Validacao

Foi executado um disparo controlado pelo BFF de staging usando destino invalido, para evitar envio real. O backend carregou as variaveis do Render, chamou a Meta Cloud API e recebeu erro esperado da Meta:

```text
(#131030) Recipient phone number not in allowed list
```

Esse resultado confirma que token, versao da API e Phone Number ID chegaram corretamente ao adaptador WhatsApp. A validacao real de entrega depende de adicionar um telefone de destino permitido na tela de teste da Meta.

## Proximo passo

Adicionar um telefone de destino na lista permitida do numero de teste da Meta e repetir o envio com esse numero em formato E.164, por exemplo `5511999999999`.
