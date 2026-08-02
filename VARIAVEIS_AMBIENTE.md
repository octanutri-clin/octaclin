# OctaClin - Variaveis de ambiente

Este arquivo documenta variaveis sem expor valores. Nunca commite `.env` real ou secrets.

## Regras

- Valores reais devem ficar apenas no provedor adequado: Render, Neon, Upstash, Google, Meta ou ambiente local privado.
- Se um token aparecer no chat ou em arquivo versionado, rotacione.
- Use nomes consistentes entre staging e producao.
- Producao deve ter secrets separados de staging.
- O backend recusa iniciar em producao se `CORS_ORIGINS`, `JWT_SEGREDO`,
  `JWT_REFRESH_SEGREDO`, `CRIPTOGRAFIA_CHAVE_AES_256` ou
  `FORMULARIO_PUBLICO_SEGREDO` estiverem ausentes.
  Quando Google Calendar estiver configurado, tambem exige
  `GOOGLE_CALENDAR_OAUTH_STATE_SECRET` com pelo menos 32 bytes;
  `CORS_ORIGINS` nao pode conter `*`.
- Na Fase 201, processos que executam filas em producao tambem exigem Redis e
  devem receber papel explicito antes de escalar: `web` para HTTP e `worker`
  para consumidores/cron.

## Backend

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Sim | Ambiente (`development`, `production`) | Render/backend | Logs e comportamento de producao |
| `OCTACLIN_PROCESSO` | Sim no rollout multi-instancia | `web`, `worker` ou `all` (somente compatibilidade/local) | Render/backend e worker | HTTP nao consome jobs; worker nao abre porta HTTP |
| `PORT` | Sim | Porta do backend | Render/backend | `/health` responde |
| `CORS_ORIGINS` | Sim em producao | Origens web autorizadas, separadas por virgula e sem `*` | Render/backend | Login/BFF funciona apenas pela origem oficial |
| `DATABASE_URL` | Sim | Conexao Neon/Postgres por papel sem `BYPASSRLS` | Render/backend | `/health`, login, migrations e RLS |
| `BANCO_EXECUTAR_MIGRACOES` | Depende | Executar migrations automaticamente | Render/backend | Deploy sem erro de migration |
| `REDIS_URL` | Sim para worker em producao | Filas/outbox/cache | Render/backend e worker | Comunicacoes processam |
| `JWT_SEGREDO` | Sim | Assinatura access token | Render/backend | Login funciona |
| `JWT_REFRESH_SEGREDO` | Sim | Assinatura refresh token | Render/backend | Renovacao de sessao funciona |
| `CRIPTOGRAFIA_CHAVE_AES_256` | Sim | Criptografia de PII | Render/backend | Dados sensiveis salvam/leem |
| `FORMULARIO_PUBLICO_SEGREDO` | Sim em producao | Assinatura dedicada dos links publicos de formularios, minimo 32 bytes | Render/backend | Link de formulario abre e aceita rascunho/resposta |
| `OCTACLIN_WEB_URL` | Sim | Links de convite/recuperacao | Render/backend | Link de email aponta para web correta |
| `WEB_URL` | Opcional | Fallback para links | Render/backend | Links gerados |
| `EXPOR_LINK_RECUPERACAO_SENHA` | Nao em producao | Expor link em resposta para debug | Local/staging restrito | API retorna link quando esperado |

## Email/Gmail

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `EMAIL_PROVEDOR` | Recomendado | `smtp` ou `gmail_api` | Render/backend | Envio usa provedor correto |
| `EMAIL_REMETENTE` | Recomendado | Remetente exibido | Render/backend | Email recebido com remetente correto |
| `EMAIL_SMTP_HOST` | Para SMTP | Host SMTP | Render/backend | Envio SMTP funciona |
| `EMAIL_SMTP_PORT` | Para SMTP | Porta SMTP | Render/backend | Envio SMTP funciona |
| `EMAIL_SMTP_SECURE` | Para SMTP | TLS/SSL SMTP | Render/backend | Envio SMTP funciona |
| `EMAIL_SMTP_USUARIO` | Para SMTP | Usuario SMTP | Render/backend | Envio SMTP autentica |
| `EMAIL_SMTP_SENHA` | Para SMTP | Senha/app password SMTP | Render/backend | Envio chega |
| `EMAIL_SMTP_FAMILY` | Opcional | Forcar IPv4/IPv6 | Render/backend | Corrige timeout SMTP |
| `EMAIL_SMTP_CONNECTION_TIMEOUT_MS` | Opcional | Timeout conexao SMTP | Render/backend | Logs sem timeout |
| `EMAIL_SMTP_GREETING_TIMEOUT_MS` | Opcional | Timeout greeting SMTP | Render/backend | Logs sem timeout |
| `EMAIL_SMTP_SOCKET_TIMEOUT_MS` | Opcional | Timeout socket SMTP | Render/backend | Logs sem timeout |
| `GMAIL_USUARIO` | Para Gmail API | Usuario Gmail | Render/backend | Gmail API envia |
| `GMAIL_CLIENT_ID` | Para Gmail API | OAuth client id | Render/backend | Token renova |
| `GMAIL_CLIENT_SECRET` | Para Gmail API | OAuth client secret | Render/backend | Token renova |
| `GMAIL_REFRESH_TOKEN` | Para Gmail API | Refresh token | Render/backend | Envio Gmail API funciona |
| `GMAIL_TOKEN_URI` | Opcional | Endpoint OAuth | Render/backend | Token renova |

## WhatsApp Meta

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `META_WHATSAPP_TOKEN` | Sim | Envio Meta Cloud API | Render/backend | Envio real controlado |
| `META_WHATSAPP_PHONE_NUMBER_ID` | Sim | Numero remetente | Render/backend | Envio para numero de teste |
| `META_WHATSAPP_VERIFY_TOKEN` | Sim | Verificacao webhook | Render/backend e Meta | Webhook valida |
| `META_WHATSAPP_APP_SECRET` | Recomendado | Validacao de assinatura webhook | Render/backend | Webhook seguro |
| `META_WHATSAPP_API_VERSION` | Opcional | Versao Graph API | Render/backend | Logs/URL Meta corretos |

## Google Calendar

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `GOOGLE_CALENDAR_CLIENT_ID` | Sim | Client ID do OAuth Google | Render/backend | Botao redireciona ao consentimento |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Sim | Client secret do OAuth Google | Render/backend | Callback conclui sem erro |
| `GOOGLE_CALENDAR_OAUTH_STATE_SECRET` | Sim com OAuth Google | Segredo HMAC dedicado para state OAuth, minimo 32 bytes | Render/backend | Callback valida state sem fallback previsivel |
| `OCTACLIN_BACKEND_URL` | Recomendado | Base publica do callback e webhook | Render/backend | URL gerada aponta para producao |
| `OCTACLIN_WEB_URL` | Sim em producao | Retorno apos o consentimento | Render/backend | Retorna para `/agenda?google=conectado` |
| `GOOGLE_CALENDAR_REFRESH_TOKEN` | Opcional | Compatibilidade com agenda compartilhada antiga | Render/backend | Health indica modo compativel |
| `GOOGLE_CALENDAR_ID` | Opcional | Calendario da agenda compartilhada antiga | Render/backend | Evento aparece no calendario |
| `GOOGLE_CALENDAR_TOKEN_URI` | Opcional | Endpoint OAuth alternativo | Render/backend | Apenas testes/desenvolvimento |

Na conexao individual da Fase 136, os refresh tokens sao obtidos no callback
OAuth e armazenados criptografados por profissional. No Google Cloud Console,
registre exatamente `https://octaclin-backend-producao.onrender.com/agenda/google/callback`
como redirect URI autorizado do cliente OAuth de producao.

## Frontend/BFF

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `OCTACLIN_COOKIE_SECURE` | Sim em producao | Cookies apenas HTTPS | Render/web | Login persiste em HTTPS |
| `OCTACLIN_BACKEND_URL` | Sim | Backend usado pelo BFF antes e depois do login | Render/web | Login e recuperacao respondem |
| `OCTACLIN_TENANT_SLUG` | Sim em producao | Organizacao atendida pelo frontend | Render/web | Login resolve o tenant sem campo tecnico |
| `OCTACLIN_API_ORIGENS_PERMITIDAS` | Sim em producao | Allowlist da origem do backend | Render/web | BFF aceita apenas backend correto |
| `NEXT_PUBLIC_*` | Evitar secrets | Variaveis publicas do Next | Render/web | Inspecionar bundle se necessario |

## Armazenamento de anexos

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `ARMAZENAMENTO_S3_ENDPOINT` | Sim | Endpoint do bucket privado S3-compativel | Render/backend | Assinatura e `HEAD` funcionam |
| `ARMAZENAMENTO_S3_REGION` | Sim | Regiao informada pelo provedor | Render/backend | Cliente S3 inicializa |
| `ARMAZENAMENTO_S3_ACCESS_KEY_ID` | Sim | Chave restrita ao bucket | Render/backend | Upload real funciona |
| `ARMAZENAMENTO_S3_SECRET_ACCESS_KEY` | Sim | Segredo da chave restrita | Render/backend | Nunca aparece na web/logs |
| `ARMAZENAMENTO_BUCKET_MIDIA` | Sim | Nome do bucket privado | Render/backend | Objeto fica no bucket esperado |
| `ARMAZENAMENTO_S3_IF_NONE_MATCH` | Nao | `false` apenas quando o provedor nao aceita escrita condicional, como Backblaze B2 | Render/backend | Upload assinado nao retorna `501` |

O bucket nao pode ter acesso publico. O CORS deve liberar somente a origem web
do ambiente, `PUT`, `GET` e `HEAD`, `content-type`, `if-none-match` e
`x-amz-meta-*`. Configure lifecycle de 1 dia apenas no prefixo `pendentes/`.
Use bucket e credencial diferentes em staging e producao.

## Neon

Secrets ficam no painel Neon e em `DATABASE_URL` no Render. Nao registrar usuario/senha reais em docs.

## Upstash

Secrets ficam no painel Upstash e em `REDIS_URL` no Render. Nao registrar URL real em docs.

## Checklist de rotacao

Runbook detalhado: `RUNBOOK_ROTACAO_SECRETS.md`.

Antes de commit ou deploy:

```powershell
npm run security:secrets
```

Rotacionar imediatamente se exposto:

- `META_WHATSAPP_TOKEN`
- `GMAIL_REFRESH_TOKEN`
- `GOOGLE_REFRESH_TOKEN`
- `EMAIL_SMTP_SENHA`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SEGREDO`
- `JWT_REFRESH_SEGREDO`
- `CRIPTOGRAFIA_CHAVE_AES_256`
- `FORMULARIO_PUBLICO_SEGREDO`
- `ARMAZENAMENTO_S3_ACCESS_KEY_ID`
- `ARMAZENAMENTO_S3_SECRET_ACCESS_KEY`

Depois da rotacao:

1. Atualizar Render.
2. Redeploy.
3. Validar `/health`.
4. Validar login.
5. Validar integracao afetada.
