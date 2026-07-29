# Fase 158 - Restore real em banco dedicado

## Objetivo

Executar uma recuperacao real da base de producao sem alterar a origem, para validar o procedimento de backup e restore antes do go-live.

## Execucao aprovada

- Origem somente leitura: `Octaclin-db-producao`.
- Destino dedicado: `octaclin_restore_fase158`.
- Ferramentas PostgreSQL 18.4: `pg_dump`, `pg_restore` e `psql`.
- Dump custom com `--no-owner`, `--no-acl` e `--exclude-extension=timescaledb`.
  O Neon gerencia TimescaleDB no destino; seus metadados internos nao devem ser restaurados pela aplicacao.
- Restore com `--clean`, `--if-exists`, `--no-owner` e `--no-acl`, exclusivamente no banco dedicado.
- O dump temporario foi removido apos a validacao.

## Validacao

- `pg_restore --list`: 481 itens no arquivo custom.
- Restore concluido no banco dedicado.
- Contagens equivalentes em 13 tabelas criticas.
- 54 politicas RLS equivalentes.
- 2 usuarios autenticaveis equivalentes.

## Saida

- `scripts/executar-restore-dedicado.ps1` executa backup, restore, validacao e limpeza em etapas; le a connection string do destino pela area de transferencia sem imprimi-la.
- O runbook usa os nomes atuais das tabelas de respostas de formularios.
