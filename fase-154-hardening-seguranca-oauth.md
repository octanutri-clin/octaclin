# Fase 154 - Hardening de seguranca OAuth e bootstrap

## Status

Concluida em 2026-07-29.

## Entregas

- O state OAuth Google exige `GOOGLE_CALENDAR_OAUTH_STATE_SECRET` com pelo menos 32 bytes, sem fallback local previsivel e separado da chave AES.
- Em producao, Client ID, client secret e segredo de state devem existir juntos.
- O bootstrap administrativo exige `CRIPTOGRAFIA_CHAVE_AES_256` antes de criptografar dados.
- Variaveis e testes de inicializacao foram atualizados.

## Pendencia registrada

`google_canais_watch` e um indice global de correlacao de webhook. A aplicacao de RLS forcada exige antes uma resolucao autenticada e tenant-aware; nenhuma migration parcial foi executada.

## Validacoes

```powershell
pnpm --dir octaclin-backend test -- main.spec.ts servico-conexao-google-calendar.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm test:handoff
pnpm validate:docs
git diff --check
```
