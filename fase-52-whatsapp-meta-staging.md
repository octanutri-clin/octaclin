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
- Phone Number ID usado em staging: `1166704896532308`.
- Canal OctaClin criado:
  - tipo: `whatsapp`
  - nome: `WhatsApp Meta Cloud staging`
- Canal OctaClin validado no envio real:
  - tipo: `whatsapp`
  - nome: `WhatsApp Meta Cloud staging - teste Meta`
  - configuracao: `phoneNumberId` e `apiVersion`
  - observacao: token permanece em variavel de ambiente, nao no banco.
- Template OctaClin criado:
  - canal: `whatsapp`
  - codigo externo: `hello_world`
  - idioma: `en_US`
  - aprovado: `true`

## Validacao

Foi executado inicialmente um disparo controlado pelo BFF de staging usando destino invalido, para evitar envio real. O backend chamou a Meta Cloud API e recebeu erro esperado da Meta:

```text
(#131030) Recipient phone number not in allowed list
```

Esse resultado confirma que token, versao da API e Phone Number ID chegaram corretamente ao adaptador WhatsApp. A validacao real de entrega depende de adicionar um telefone de destino permitido na tela de teste da Meta.

Depois que o destinatario de teste foi adicionado e verificado na Meta, foi executado um disparo real pelo OctaClin com:

- canal: `WhatsApp Meta Cloud staging - teste Meta`
- template: `hello_world`
- idioma: `en_US`
- status final: `enviado`
- retorno Meta: `idExterno` presente

## Proximo passo

Substituir o token temporario por um token permanente de System User/WhatsApp Business antes de uso continuo fora de staging.
