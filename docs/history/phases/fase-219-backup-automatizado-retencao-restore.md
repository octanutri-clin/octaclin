# Fase 219 - Backup automatizado, retencao e restore recorrente

Status: concluida em 2026-08-09.

## Objetivo

Retirar o backup de producao do processo manual e produzir evidencia diaria de
integridade, com copia privada fora do Neon e restore recorrente em banco
dedicado. A fase nao altera schema nem codigo de produto.

## Entrega tecnica

- workflow `.github/workflows/backup-producao.yml`, diario as 03:17 UTC e
  executavel manualmente;
- cron desativado por padrao ate a variavel
  `OCTACLIN_BACKUP_AUTOMATICO_HABILITADO` receber `true`;
- PostgreSQL 18 em container, dump custom sem owner/ACL e exclusao somente da
  extensao `timescaledb` gerenciada pelo Neon;
- role de origem dedicada, somente leitura, com `BYPASSRLS`, sem usar
  `neondb_owner` no backup cotidiano;
- bucket Backblaze B2 privado e separado dos anexos clinicos;
- checksum SHA-256, metadata, sidecar e cifragem B2 `AES256` verificados apos
  upload;
- retencao declarada em `.github/backblaze-backup-lifecycle.json`: 8 dias para
  `daily/`, 29 para `weekly/` e 93 para `monthly/`;
- bootstrap manual e opt-in da politica; execucoes normais apenas validam o
  lifecycle ja aplicado;
- restore semanal ou forcado em banco Neon dedicado, seguido por validacao de
  migrations, tenants, usuarios e RLS forcada da Fase 218;
- nenhum dump e publicado como GitHub Artifact; temporarios sao removidos em
  `always()`.

## Controles de seguranca

- URLs e chaves ficam apenas no GitHub Environment `production-backup`.
- Banco de origem e role esperados sao conferidos antes do dump.
- Banco de restore deve ser diferente da origem e usar `neondb_owner` apenas
  nesse destino descartavel.
- O workflow valida que o bucket nao concede acesso a `AllUsers`.
- A chave B2 deve ser restrita ao bucket de backup e nao deve ser reutilizada
  pelo backend ou pelo bucket de anexos.
- O resumo do job nao imprime URLs, chaves, hashes de senha ou conteudo do dump.

## Aceite

- [x] `octaclin_backup_producao` validada com `BYPASSRLS`, sem poderes de
  superusuario, criacao de banco/role ou replicacao.
- [x] Bucket privado `octaclin-backups-producao-2026` e lifecycle versionado.
- [x] Banco dedicado `octaclin_restore_fase219` criado.
- [x] Secrets e variables configurados no Environment `production-backup`.
- [x] Execucao `31346127174`: dump, checksum, AES256, upload, download e restore
  aprovados; banco, migration, tenants, usuarios e RLS retornaram `true`.
- [x] Comparacao independente: 72 tabelas da aplicacao nos dois bancos; as 29
  diferencas da origem eram somente catalogos internos do TimescaleDB excluido.
- [x] Cron habilitado e execucao operacional `31346290507` aprovada.

A primeira ocorrencia do cron deve ser acompanhada no GitHub Actions. Uma falha
reabre o incidente operacional, mas nao resta pendencia de implementacao.
