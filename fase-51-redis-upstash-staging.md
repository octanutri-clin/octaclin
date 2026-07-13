# Fase 51 - Redis Upstash staging

## Objetivo

Conectar o backend staging do OctaClin a um Redis gerenciado para processar filas de comunicacoes e automacoes fora do modo direto/local.

## Provisionamento

- Provedor: Upstash Redis.
- Banco: `octaclin-queue-staging`.
- Plano: Free Tier.
- Regiao: AWS US-EAST-2.
- TLS/SSL: habilitado.

## Variaveis aplicadas no backend Render

As variaveis foram configuradas no servico `octaclin-backend-staging`:

```env
REDIS_URL=rediss://...
REDIS_TLS=true
```

O valor real de `REDIS_URL` permanece apenas no painel do Render/Upstash e nao deve ser versionado.

## Validacao em staging

Depois de salvar as variaveis no Render, o deploy foi acionado e o healthcheck respondeu:

```text
GET https://octaclin-backend-staging.onrender.com/health -> ok
```

Tambem foi feito um envio real de comunicacao pela web staging:

- Mensagem criada como `pendente`.
- Mensagem processada para `enviado`.
- `enviadoEm`: `2026-07-13T19:10:30.358Z`.

## Resultado

O staging agora usa Redis gerenciado para publicar/processar a fila `notificacoes`, mantendo o fallback direto do backend para cenarios em que a fila esteja indisponivel.

## Proximo passo recomendado

Configurar a Meta Cloud API para WhatsApp:

1. Criar ou selecionar app no Meta for Developers.
2. Habilitar WhatsApp no app.
3. Obter `Phone Number ID` e token de acesso.
4. Configurar no Render:
   - `META_WHATSAPP_TOKEN`
   - `META_WHATSAPP_PHONE_NUMBER_ID`
   - `META_WHATSAPP_API_VERSION`
5. Criar canal/template WhatsApp no console OctaClin.
6. Validar envio com numero de teste antes de usar numero real.
