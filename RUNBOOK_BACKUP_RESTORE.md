# OctaClin - Runbook de backup e restore

Este runbook define como gerar backup PostgreSQL/Neon e validar restore em banco dedicado. Nunca cole `DATABASE_URL`, dump, senha ou connection string real em commits, issues, docs ou chats.

## Politica operacional

- Backup logico: `pg_dump` em formato custom (`--format=custom`) com `--no-owner` e `--no-acl`.
- Periodicidade minima para producao: diario automatizado, antes de migrations sensiveis e antes de alteracoes de billing/LGPD.
- Retencao minima inicial: 7 backups diarios, 4 semanais e 3 mensais.
- Restore testado: pelo menos semanal em banco dedicado, e sempre antes do go-live.
- Separacao obrigatoria: `RESTORE_DATABASE_URL` nunca pode apontar para o mesmo banco de `DATABASE_URL`.
- Local de arquivo: `backups/`, ignorado pelo Git.

## Automacao de producao - Fase 219

O workflow `.github/workflows/backup-producao.yml` executa o backup fora do
runtime do produto. O agendamento fica inativo ate a configuracao externa ser
validada e a variable `OCTACLIN_BACKUP_AUTOMATICO_HABILITADO` receber `true`.

### Recursos exclusivos

1. Role Neon `octaclin_backup_producao`: `LOGIN`, `BYPASSRLS`, sem
   `SUPERUSER`, `CREATEDB`, `CREATEROLE` ou escrita em tabelas.
2. Banco Neon `octaclin_restore_fase219`, separado da producao, acessado por
   `neondb_owner` somente durante o teste de restore.
3. Bucket Backblaze B2 privado e exclusivo para backups, diferente do bucket
   de anexos clinicos.
4. Application Key B2 limitada ao bucket de backup, com leitura, escrita,
   listagem e leitura da configuracao de lifecycle.
5. GitHub Environment privado `production-backup`.

Depois de criar a role pelo Neon, execute como owner, substituindo apenas o
nome do banco quando necessario:

```sql
ALTER ROLE octaclin_backup_producao BYPASSRLS
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CONNECT ON DATABASE "Octaclin-db-producao" TO octaclin_backup_producao;
GRANT USAGE ON SCHEMA public TO octaclin_backup_producao;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO octaclin_backup_producao;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO octaclin_backup_producao;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO octaclin_backup_producao;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO octaclin_backup_producao;
```

O `BYPASSRLS` e necessario para que o dump contenha todos os tenants; ele nao
autoriza escrita. Nao use `neondb_owner` na URL cotidiana do backup.

### Retencao B2

Aplique `.github/backblaze-backup-lifecycle.json` uma vez, com uma credencial
administrativa controlada. O workflow operacional apenas verifica a politica:

```powershell
aws s3api put-bucket-lifecycle-configuration `
  --bucket '<bucket-privado>' `
  --endpoint-url 'https://s3.<regiao>.backblazeb2.com' `
  --lifecycle-configuration file://.github/backblaze-backup-lifecycle.json
```

Nao altere as mesmas regras pelo console B2 depois de passar a administra-las
pela API S3. A politica conserva 7 copias diarias completas, 4 semanais e 3
mensais, com um dia adicional antes da expiracao.

### Secrets e variables do GitHub

Secrets no Environment `production-backup`:

- `OCTACLIN_BACKUP_DATABASE_URL`
- `OCTACLIN_RESTORE_DATABASE_URL`
- `B2_BACKUP_KEY_ID`
- `B2_BACKUP_APPLICATION_KEY`

Variables no mesmo Environment:

- `OCTACLIN_RESTORE_DATABASE_EXPECTED=octaclin_restore_fase219`
- `B2_BACKUP_ENDPOINT`
- `B2_BACKUP_REGION`
- `B2_BACKUP_BUCKET`
- `OCTACLIN_BACKUP_AUTOMATICO_HABILITADO=false`

Execute primeiro `workflow_dispatch` com `restore_test=true` e
`configurar_retencao=true`. Esta ultima opcao e um bootstrap explicito e deve
voltar a `false` nas rodadas seguintes. Confirme o resumo, o objeto remoto e o
restore antes de mudar a ultima variable para `true`. A primeira rodada do cron
tambem deve ser acompanhada.

Aceite inicial concluido em 2026-08-09 nas execucoes `31346127174` (restore
completo) e `31346290507` (caminho operacional com cron habilitado). Acompanhe
as proximas rodadas em GitHub Actions > `Backup producao`.

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

### Neon com TimescaleDB gerenciado

Quando o banco dedicado Neon gerenciar `timescaledb`, use
`scripts/executar-restore-dedicado.ps1`. Copie a connection string do banco
dedicado para a area de transferencia local, sem colar a credencial em chat ou
terminal, e execute as etapas abaixo. O utilitario exclui somente a extensao
gerenciada, compara os dados criticos e remove o dump ao final.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\executar-restore-dedicado.ps1 -BancoOrigem 'banco-producao' -BancoDestino 'banco-restore' -Etapa backup
powershell -ExecutionPolicy Bypass -File .\scripts\executar-restore-dedicado.ps1 -BancoOrigem 'banco-producao' -BancoDestino 'banco-restore' -Etapa restore
powershell -ExecutionPolicy Bypass -File .\scripts\executar-restore-dedicado.ps1 -BancoOrigem 'banco-producao' -BancoDestino 'banco-restore' -Etapa validar
powershell -ExecutionPolicy Bypass -File .\scripts\executar-restore-dedicado.ps1 -BancoOrigem 'banco-producao' -BancoDestino 'banco-restore' -Etapa limpar
```

Depois do restore:

1. Executar `SELECT count(*)` em tabelas criticas.
2. Apontar backend temporariamente para o banco de restore, se necessario.
3. Validar `/health/detalhado`.
4. Validar login e uma leitura por dominio critico.
5. **Reaplicar exclusoes LGPD tombstoned** (ver secao abaixo) antes de
   promover o restore como fonte de producao.
6. Descartar o banco de restore depois da verificacao.

### Reaplicar exclusoes LGPD apos restore (Fase 261)

Um backup e uma fotografia de um instante no passado: uma solicitacao de
eliminacao LGPD (`ServicoPacientes.solicitarEliminacaoDadosLgpd`) atendida
**depois** do ponto no tempo do backup nao esta refletida nele. Restaurar
esse backup sem tratamento traria de volta um dado que ja foi legitimamente
eliminado -- exatamente o que a tabela `tombstones_exclusao_lgpd` existe
para impedir.

Antes de promover qualquer banco restaurado como fonte de producao:

1. Identificar o ponto no tempo do backup restaurado (`pg_backup_start_time`
   do dump, ou o timestamp registrado no plano de backup).
2. No banco de origem (producao, ainda intacto) ou em uma copia do ledger de
   tombstones preservada fora do backup, listar todo tombstone posterior a
   esse ponto:
   ```sql
   select tenant_id, tabela, registro_id, motivo, excluido_em
   from tombstones_exclusao_lgpd
   where excluido_em > '<ponto-no-tempo-do-backup>'
   order by excluido_em;
   ```
3. Para cada linha retornada, confirmar no banco restaurado que o registro
   (`tabela`/`registro_id`) ainda esta no estado anterior a eliminacao (ex.:
   `pacientes.status_ciclo_vida <> 'DELETED'`).
4. Reaplicar a eliminacao **pela aplicacao**, nunca por `UPDATE` manual: uma
   sessao de backend apontada para o banco restaurado chama de novo
   `ServicoPacientes.solicitarEliminacaoDadosLgpd` para cada
   `registro_id` listado. Isso garante que a mesma lógica de negocio (cifra
   do marcador de eliminacao, limpeza de campos, novo tombstone) seja usada
   -- nunca reescreva a coluna cifrada a mao.
5. So depois de zero tombstone pendente de reaplicacao e que o banco
   restaurado pode ser promovido como fonte de producao.

Isto ainda nao tem automacao dedicada (script ou etapa do
`executar-restore-dedicado.ps1`); e um procedimento manual documentado,
registrado aqui como pendente explicito enquanto a Fase 261 nao tiver uma
restauracao real para validar a automacao contra dado de verdade.

## Tabelas criticas para conferencias manuais

- `tenants`
- `usuarios`
- `pacientes`
- `profissionais`
- `questionarios`
- `envios_questionario`
- `respostas_checkin`
- `resposta_valores`
- `agenda_consultas`
- `mensagens_notificacao`
- `outbox_eventos`
- `user_action_logs`
- `consentimentos_lgpd`
- `tombstones_exclusao_lgpd`
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
