# Fase 215 - Performance de backend

Status: concluida em 2026-08-08.

## Objetivo

Medir e reduzir desperdicio no acesso ao PostgreSQL sem enfraquecer o RLS,
introduzir cache sem evidencia ou depender de configuracao implicita do pool.

## Baseline e decisao

O caminho de resumo/limites do portal do cliente executava tres transacoes com
contexto de tenant e sete leituras. Usuarios, pacientes, mensagens,
questionarios e arquivos eram materializados integralmente no Node para depois
serem contados ou somados.

O `ExecutorTenant` foi preservado. `set_config(..., true)` continua dentro de
uma transacao, pois o escopo local fora dela nao oferece a garantia necessaria
para uma conexao reutilizada pelo pool. Nenhum cache foi adicionado: a medicao
nao mostrou fila de pool e guardar resumo clinico/administrativo no Redis
adicionaria invalidacao e risco multi-tenant sem beneficio demonstrado.

## Entrega

- o resumo e a verificacao de limites usam uma transacao tenant, uma leitura de
  configuracao e uma consulta SQL agregada;
- o pool Postgres tem limites explicitos e validados para tamanho, espera de
  conexao e ociosidade;
- `/health/detalhado` mede latencia do banco e expoe apenas contadores
  sanitizados do pool;
- `/health/pronto` responde `503` quando banco ou migrations nao estao prontos;
- checks de banco, migrations e Redis rodam em paralelo e banco/migrations tem
  timeout;
- web e worker habilitam shutdown hooks para liberar o pool no encerramento;
- `performance:backend` recusa producao, exige confirmacao exata do banco e faz
  somente leituras.

## Isolamento e ambiente de integracao

O primeiro canario detectou que `octaclin_app_integracao`, criada pelo Console
do Neon, herdava privilegio capaz de contornar RLS. Nenhum resultado obtido com
essa role foi aceito como evidencia de isolamento.

Foi criada por SQL a role dedicada `octaclin_runtime_integracao`, com login e
permissoes de dados, mas sem `SUPERUSER`, `CREATEROLE`, `CREATEDB`, replicacao ou
`BYPASSRLS`. A role antiga foi mantida intacta. A senha nao foi impressa nem
registrada no repositorio.

O runner agora falha se:

- a role tiver `SUPERUSER` ou `BYPASSRLS`;
- `pacientes` nao tiver `ENABLE` e `FORCE ROW LEVEL SECURITY`;
- qualquer paciente estiver visivel sem contexto de tenant;
- o tenant aplicado dentro de `ExecutorTenant` nao for o confirmado.

## Medicao remota

Banco dedicado: `octaclin_test_fase150b`, com massa sintetica. Pool maximo 10.
Cada nivel executou 50 requisicoes da consulta agregada:

| Concorrencia | Erros | p50 | p95 | p99 | Maximo | Fila maxima |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 612,4 ms | 635,9 ms | 891,8 ms | 891,8 ms | 0 |
| 5 | 0 | 613,6 ms | 1.559,0 ms | 1.991,2 ms | 1.991,2 ms | 0 |
| 10 | 0 | 621,8 ms | 1.570,1 ms | 1.891,0 ms | 1.891,0 ms | 0 |

O canario confirmou RLS habilitado e forcado, zero pacientes visiveis sem
tenant e contexto correto dentro da transacao. Os p50 permaneceram proximos em
uma repeticao completa; a variacao de cauda e compativel com banco remoto
serverless e nao houve espera no pool. Nao foi calculado percentual de ganho
contra o codigo antigo: o baseline anterior e estrutural, nao uma medicao
numerica equivalente.

## Validacao

- 101 suites e 709 testes backend aprovados;
- testes focados da fase: 6 suites e 41 testes aprovados;
- `typecheck` e build backend aprovados;
- scanner de secrets e `git diff --check` aprovados;
- benchmark remoto: 150 leituras, zero erro, RLS aprovado e fila maxima zero.

Nao houve migration, seed, escrita em dados de negocio ou alteracao em
producao.
