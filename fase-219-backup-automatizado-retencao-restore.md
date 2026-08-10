# Fase 219 - Backup automatizado, retencao e restore recorrente

Status: implementacao concluida; ativacao externa e primeira execucao pendentes.

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

## Aceite pendente

- [ ] Criar/validar `octaclin_backup_producao` e seus grants na producao.
- [ ] Criar bucket B2 privado exclusivo e aplicar a politica versionada.
- [ ] Criar banco Neon dedicado `octaclin_restore_fase219`.
- [ ] Configurar secrets e variables no Environment `production-backup`.
- [ ] Executar manualmente com `restore_test=true` e aprovar o resumo.
- [ ] Confirmar objeto remoto, checksum, AES256 e restore valido.
- [ ] Habilitar o cron e registrar a primeira rodada agendada.

Somente depois desses itens a fase pode ser marcada como concluida e os gates
de backup do go-live podem receber aceite.
