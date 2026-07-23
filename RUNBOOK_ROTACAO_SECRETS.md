# Runbook de rotacao de secrets

Data base: 2026-07-23

## Objetivo

Padronizar como detectar, rotacionar e validar secrets do OctaClin sem expor valores em commits, logs ou mensagens.

## Regras

- Nunca commitar `.env`, tokens, senhas, URLs reais de banco/cache ou chaves privadas.
- Se um secret aparecer em chat, print, log, arquivo versionado ou historico Git, considerar comprometido e rotacionar.
- Atualizar secrets apenas no provedor correto: Render, Neon, Upstash, Meta, Google, OpenAI ou ambiente local privado.
- Depois de rotacionar, validar a integracao afetada antes de remover o secret antigo quando a plataforma permitir janela de transicao.
- Antes de commit e deploy, executar `npm run security:secrets`.

## Scanner local

```powershell
npm run security:secrets
npm run test:security
```

O scanner cobre os principais formatos de risco atuais:

- OpenAI API key (`sk-*` e `sk-proj-*`).
- Token Meta/WhatsApp (`EAAY*`).
- Refresh token Google OAuth (`1//*`).
- URLs Postgres/MySQL/Redis com senha embutida.
- Blocos de chave privada.

O scanner ignora diretórios gerados como `.git`, `node_modules`, `.next`, `dist`, `coverage`, `test-results` e `playwright-report`.

## Rotacao por provedor

### Meta WhatsApp

1. Gerar novo token no Meta Business/System User com as permissoes WhatsApp necessarias.
2. Atualizar `META_WHATSAPP_TOKEN` no Render backend.
3. Executar redeploy.
4. Validar `/health`.
5. Enviar uma mensagem real controlada.
6. Confirmar status interno `enviado`, ID Meta presente e entrega Meta quando disponivel.
7. Revogar ou expirar o token antigo quando a operacao nova estiver validada.

### Gmail SMTP ou Gmail API

1. Para SMTP, gerar nova senha de app no Google Account.
2. Atualizar `EMAIL_SMTP_SENHA` no Render backend.
3. Para Gmail API, rotacionar `GMAIL_CLIENT_SECRET` e/ou gerar novo `GMAIL_REFRESH_TOKEN`.
4. Executar redeploy.
5. Enviar email de validacao por interface ou smoke controlado.
6. Remover credencial antiga no Google quando a nova estiver validada.

### Google Calendar

1. Rotacionar `GOOGLE_CALENDAR_CLIENT_SECRET` se o OAuth client foi exposto.
2. Gerar novo `GOOGLE_CALENDAR_REFRESH_TOKEN` para a conta autorizada.
3. Atualizar Render backend.
4. Executar redeploy.
5. Criar, remarcar e cancelar uma consulta de teste para validar criacao/atualizacao/cancelamento no Calendar.

### OpenAI

1. Criar uma nova chave no painel da OpenAI.
2. Atualizar o secret apenas no servico que consome IA, quando existir variavel privada configurada.
3. Revogar a chave antiga.
4. Executar `npm run security:secrets`.
5. Validar a funcionalidade de IA em ambiente controlado.

### Neon/Postgres

1. Preferir criar/rotacionar credencial de role no Neon.
2. Atualizar `DATABASE_URL` no Render backend.
3. Executar redeploy.
4. Validar `/health`, login e leitura/escrita basica.
5. Revogar a senha antiga no Neon.

### Upstash/Redis

1. Rotacionar token/senha no Upstash.
2. Atualizar `REDIS_URL` no Render backend.
3. Executar redeploy.
4. Validar processamento de outbox/comunicacoes.
5. Revogar credencial antiga quando a fila estiver operacional.

### JWT e criptografia

1. Rotacionar `JWT_SEGREDO` e `JWT_REFRESH_SEGREDO` invalida sessoes existentes; comunicar janela se houver usuarios reais.
2. Rotacionar `CRIPTOGRAFIA_CHAVE_AES_256` exige plano de recriptografia dos dados ja salvos. Nao trocar sem migração controlada.
3. Em vazamento confirmado, congelar novas operacoes sensiveis, gerar plano de recriptografia, executar backup e validar leitura de PII apos migracao.

## Se um secret foi commitado

1. Rotacionar imediatamente no provedor.
2. Remover o valor do arquivo atual.
3. Executar `npm run security:secrets`.
4. Commitar a remocao e o runbook/ajuste necessario.
5. Avaliar limpeza de historico Git apenas depois da rotacao. Limpar historico sem rotacionar nao torna o secret seguro.

## Evidencias minimas apos rotacao

- Comando executado: `npm run security:secrets`.
- Deploy/redeploy concluido.
- `/health` validado quando afetar backend.
- Login validado quando afetar JWT, banco ou backend.
- Integracao afetada validada com envio/criacao real controlada.
