# Relatorio de seguranca - PR 53: backup, restore e ransomware

Status em 2026-09-08: **gate externo PASS; checks e review humano pendentes**.
O restore real no banco dedicado aprovou a versao nova do workflow. Este
documento nao autoriza merge enquanto todos os checks do PR nao estiverem
verdes e o review humano nao for concluido.

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
| `pnpm --dir octaclin-mobile test:security` | PASS (13/13) |
| `pnpm --dir octaclin-mobile audit:security` | PASS com as duas excecoes `image-size` sem patch |
| `git diff --check` | PASS |

O host local esta em Node 24, fora do contrato `>=22 <23`; por isso o resultado
local precisa ser repetido pelo CI em Node 22 antes do merge.

## Gate externo

PASS em 2026-09-08 na execucao
[`34286684698`](https://github.com/octanutri-clin/octaclin/actions/runs/34286684698),
commit `4eb12cc50db946fa6ea9d06f0cecd688504d054a`, com
`restore_test=true`, `configurar_retencao=false` e destino dedicado
`octaclin_restore_fase219` previamente confirmado pelo proprietario.

Todos os passos exigidos de configuracao, inventario da origem, dump, checksum,
upload, verificacao remota, validacao do destino, restore, manifesto do destino,
resumo e limpeza terminaram com `success`. A aplicacao de retencao foi o unico
passo `skipped`, como exigido pelo input `configurar_retencao=false`, e nao foi
contada como evidencia do gate. Pelos timestamps sanitizados dos passos:

- restore mais validacao: 124 segundos, contra RTO de 30 minutos;
- idade do snapshot ate o fim da validacao: aproximadamente 152 segundos,
  contra RPO de 24 horas.

Nenhum manifesto, tenant, contagem ou secret foi copiado para esta evidencia.
Object Lock COMPLIANCE permanece `nao_comprovada`; a excecao continua aberta.

Durante os checks surgiu o novo alerta alto `GHSA-2883-xcg3-v3hh` em
`js-yaml@4.3.1`, transitivo da CLI do Expo. Como existe patch, ele nao foi
transformado em excecao: o override e o lockfile foram atualizados para 4.3.2,
e a auditoria voltou a aprovar apenas os dois alertas `image-size` sem correcao.

## Rollback

Reverter os arquivos do PR. Isso nao altera banco, bucket, lifecycle ou objetos.
Nao usar rollback de codigo como autorizacao para apagar backup, reduzir
retencao ou alterar Object Lock no provedor.
