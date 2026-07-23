# Fase 126 - Backups e restore testado

Data: 2026-07-23

## Objetivo

Definir e automatizar o procedimento inicial de backup PostgreSQL/Neon e restore de teste do OctaClin, reduzindo risco operacional antes de producao real.

## Entregas

- Criado `RUNBOOK_BACKUP_RESTORE.md` com politica, periodicidade, retencao, procedimento de backup, restore de teste e incidente de perda de dados.
- Adicionado `backups/` ao `.gitignore`.
- Criado `scripts/backup-restore-plan.mjs` para gerar plano seguro sem imprimir senha real.
- Criado `scripts/test-backup-restore-plan.mjs` cobrindo validacoes criticas.
- Criado `validar-backup-restore.ps1` para executar `pg_dump`, validar dump com `pg_restore --list` e, opcionalmente, restaurar em banco dedicado.
- Adicionados scripts `backup:plan` e `test:backup` no `package.json`.
- `RUNBOOK_PRODUCAO.md`, `TESTES_E_VALIDACOES.md`, `CHECKLIST_GO_LIVE.md`, checklist de fases e resumo consolidado foram atualizados.

## Decisoes

- Backup usa formato custom do PostgreSQL para permitir validacao e restore flexivel.
- O restore de teste exige `RESTORE_DATABASE_URL` diferente de `DATABASE_URL`.
- O restore de teste exige `CONFIRMAR_RESTORE_TESTE=SIM` para evitar execucao acidental.
- O script nao automatiza restore sobre producao.
- O plano JSON usa URLs mascaradas e placeholders nos comandos para evitar vazamento de credenciais em logs.
- A retencao inicial recomendada e 7 diarios, 4 semanais e 3 mensais.

## Arquivos principais

- `RUNBOOK_BACKUP_RESTORE.md`
- `validar-backup-restore.ps1`
- `scripts/backup-restore-plan.mjs`
- `scripts/test-backup-restore-plan.mjs`
- `.gitignore`
- `package.json`
- `RUNBOOK_PRODUCAO.md`
- `TESTES_E_VALIDACOES.md`
- `CHECKLIST_GO_LIVE.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
pnpm test:backup
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Validacao operacional real

Sem um banco dedicado de restore fornecido nesta sessao, o restore real contra Neon nao foi executado. Para executar:

```powershell
$env:DATABASE_URL='<url do banco origem>'
$env:RESTORE_DATABASE_URL='<url do banco dedicado para restore>'
$env:CONFIRMAR_RESTORE_TESTE='SIM'
powershell -ExecutionPolicy Bypass -File .\validar-backup-restore.ps1 -RestoreTeste
```

## Pendencias para fases futuras

- Criar/definir banco dedicado de restore em staging/producao.
- Executar restore real com dump recente antes do go-live.
- Definir armazenamento externo criptografado para dumps fora da maquina local.
- Automatizar agenda de backup quando o ambiente de producao estiver separado.
