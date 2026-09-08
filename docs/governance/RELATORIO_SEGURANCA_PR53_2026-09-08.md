# Relatorio de seguranca - PR 53: backup, restore e ransomware

Status em 2026-09-08: **em elaboracao; gate externo pendente**. Este documento
nao autoriza merge enquanto a versao nova do workflow nao executar um restore
real no banco dedicado e todos os checks do PR nao estiverem verdes.

## Escopo

- RPO do banco de 24 horas e RTO do restore do banco de 30 minutos.
- Retencao daily/weekly/monthly de 8/29/93 dias, sem mudar lifecycle neste PR.
- Identidade real das roles de origem e destino, banco dedicado e origem
  diferente do destino.
- Integridade do dump/objeto e equivalencia de migrations, tabelas e tenancy.
- Verificacao de Object Lock sem ativacao automatica.
- Procedimento de contencao, selecao de copia limpa, recuperacao e pos-incidente.

Fora de escopo: restore sobre producao, DDL, mudanca de lifecycle, criacao ou
ativacao de Object Lock, recuperacao completa de todos os provedores, DAST,
fuzzing e os debitos EXC-AUD nao ligados ao backup.

## Baseline observado

O workflow `Backup producao` teve dez execucoes consecutivas bem-sucedidas entre
2026-08-30 e 2026-09-08. A execucao agendada `34020466433`, de 2026-09-06,
incluiu download, checksum, restore no banco dedicado e canario RLS, concluindo
o job em 2m51s. Essa evidencia pertence ao workflow anterior: ela prova o
mecanismo existente, mas nao fecha o novo gate de manifestos e RPO/RTO.

O ambiente `production-backup` declara o destino dedicado
`octaclin_restore_fase219`, a role de origem `octaclin_backup_producao` e a role
de destino `neondb_owner`. Somente nomes e configuracao nao secreta foram
consultados; nenhum valor de connection string ou application key foi exibido.

## Mudancas de controle

1. `manifesto-restore-producao.sql` inventaria migrations, tabelas publicas,
   tabelas com `tenant_id`, RLS, `FORCE RLS`, policy completa e contagens
   sanitizadas de tabelas criticas.
2. O manifesto da origem confirma `current_database()` e `current_user`; o do
   destino precisa corresponder estruturalmente sem usar uma migration fixa.
3. O objeto continua passando por `pg_restore --list`, SHA-256 local/remoto e
   AES-256. O workflow mede a idade do snapshot e todo o caminho de download,
   restore e validacao.
4. O bucket so recebe o estado `object_lock_compliance` quando a configuracao
   padrao e o objeto recem-enviado provam modo COMPLIANCE e retencao futura.
5. O runbook nomeia a ausencia de Object Lock como excecao, em vez de chamar
   versionamento/lifecycle de imutabilidade.

## Evidencia local

| Prova | Resultado |
| --- | --- |
| `pnpm test:backup-producao` | PASS |
| `node --check scripts/backup-producao.mjs` | PASS |
| `node --check scripts/test-backup-producao.mjs` | PASS |
| `git diff --check` | PASS |

O host local esta em Node 24, fora do contrato `>=22 <23`; por isso o resultado
local precisa ser repetido pelo CI em Node 22 antes do merge.

## Gate externo pendente

Confirmar explicitamente o alvo `octaclin_restore_fase219` e disparar `Backup
producao` nesta branch com `restore_test=true` e `configurar_retencao=false`.
Registrar URL, commit, conclusao, idade do snapshot, duracao do restore e estado
de imutabilidade, sem copiar manifests, nomes de tenants, contagens ou secrets.

PASS exige todos os passos executados; `SKIPPED` nao aprova. Se o manifesto
falhar, o comportamento correto e manter o PR aberto, diagnosticar a divergencia
e repetir somente em alvo dedicado. Object Lock ausente nao bloqueia este PR se
permanecer explicitamente `nao_comprovada`; a excecao continua aberta.

## Rollback

Reverter os arquivos do PR. Isso nao altera banco, bucket, lifecycle ou objetos.
Nao usar rollback de codigo como autorizacao para apagar backup, reduzir
retencao ou alterar Object Lock no provedor.
