# OctaClin - Runbook de backup e restore

Este runbook define como gerar backup PostgreSQL/Neon e validar restore em banco dedicado. Nunca cole `DATABASE_URL`, dump, senha ou connection string real em commits, issues, docs ou chats.

## Politica operacional

- Backup logico: `pg_dump` em formato custom (`--format=custom`) com `--no-owner` e `--no-acl`.
- Periodicidade minima para producao: diario automatizado, antes de migrations sensiveis e antes de alteracoes de billing/LGPD.
- Retencao minima inicial: 7 backups diarios, 4 semanais e 3 mensais.
- Restore testado: pelo menos semanal em banco dedicado, e sempre antes do go-live.
- Separacao obrigatoria: `RESTORE_DATABASE_URL` nunca pode apontar para o mesmo banco de `DATABASE_URL`.
- Local de arquivo: `backups/`, ignorado pelo Git.

## Pre-requisitos locais

- `node`.
- `pg_dump` e `pg_restore` no `PATH`.
- `DATABASE_URL` do banco origem.
- Para restore de teste: `RESTORE_DATABASE_URL` apontando para banco vazio/dedicado e `CONFIRMAR_RESTORE_TESTE=SIM`.

## Gerar plano seguro

O plano nao imprime senha real:

```powershell
$env:DATABASE_URL='postgresql://usuario:senha@host/neondb?sslmode=require'
pnpm backup:plan
```

## Gerar backup

```powershell
$env:DATABASE_URL='postgresql://usuario:senha@host/neondb?sslmode=require'
powershell -ExecutionPolicy Bypass -File .\validar-backup-restore.ps1
```

Saida esperada:

- arquivo `.dump` criado em `backups/`;
- `pg_restore --list` executado com sucesso;
- nenhuma credencial impressa no resumo.

## Restore de teste

Use somente banco dedicado para teste de restore:

```powershell
$env:DATABASE_URL='postgresql://usuario:senha@host-origem/neondb?sslmode=require'
$env:RESTORE_DATABASE_URL='postgresql://usuario:senha@host-restore/neondb?sslmode=require'
$env:CONFIRMAR_RESTORE_TESTE='SIM'
powershell -ExecutionPolicy Bypass -File .\validar-backup-restore.ps1 -RestoreTeste
```

Depois do restore:

1. Executar `SELECT count(*)` em tabelas criticas.
2. Apontar backend temporariamente para o banco de restore, se necessario.
3. Validar `/health/detalhado`.
4. Validar login e uma leitura por dominio critico.
5. Descartar o banco de restore depois da verificacao.

## Tabelas criticas para conferencias manuais

- `tenants`
- `usuarios`
- `pacientes`
- `profissionais`
- `questionarios`
- `respostas_questionario`
- `agenda_consultas`
- `mensagens_notificacao`
- `outbox_eventos`
- `user_action_logs`
- `consentimentos_lgpd`
- `tenant_configuracoes`

## Incidente de perda de dados

1. Congelar deploys e pausar automacoes que escrevem dados.
2. Identificar horario do incidente e ultimo backup valido.
3. Criar banco de restore separado.
4. Restaurar o backup nesse banco.
5. Comparar dados criticos com producao atual.
6. Decidir entre restore completo, restore parcial ou correcao manual auditada.
7. Registrar decisao, horario, responsavel, backup usado e impacto.

## Validacao automatizada

```powershell
pnpm test:backup
node scripts\scan-secrets.mjs
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```
