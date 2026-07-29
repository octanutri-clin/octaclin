# Fase 150B - Integracao PostgreSQL para IA

Status: em andamento em 2026-07-28.

## Objetivo

Comprovar, em PostgreSQL real e isolado, os controles de concorrencia e
isolamento implementados na Fase 150A para o reconhecimento alimentar. A
prova nao usa Neon staging/producao, Render, nem o provedor de IA real.

## Escopo implementado

- Harness opt-in que so habilita a suite quando `OCTACLIN_POSTGRES_INTEGRACAO_URL`
  estiver definido e `OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR=APAGAR`.
- Protecao de nome: o banco da URL precisa corresponder a
  `octaclin_test_<nome>`. Qualquer outro nome falha antes de abrir conexao.
- `DataSource` TypeORM restrito as entidades do cenario; ele recria somente as
  quatro tabelas necessarias e a extensao `pgcrypto` usada pela geracao UUID
  do PostgreSQL. Nenhuma migration ou configuracao de producao e reutilizada.
- Suite de integracao preparada para validar PostgreSQL real em tres casos:
  concorrencia do mesmo paciente/midia com um unico cache e uma unica chamada
  ao provedor simulado; duas chaves de cache distintas para pacientes
  diferentes com a mesma imagem; e bloqueio de acesso entre profissionais
  antes da chamada ao provedor.

## Limites e dependencia externa

A maquina atual nao possui Docker, PostgreSQL local nem
`OCTACLIN_POSTGRES_INTEGRACAO_URL`. Por isso a suite de banco real permanece
`skipped` e esta fase nao esta concluida. O aceite requer uma base descartavel
exclusiva, por exemplo `octaclin_test_fase150b`, e a execucao com confirmacao
explicita. Nunca use staging ou producao.

## Como executar o aceite

```powershell
$env:OCTACLIN_POSTGRES_INTEGRACAO_URL='<url do banco octaclin_test_fase150b>'
$env:OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR='APAGAR'
pnpm --dir octaclin-backend exec jest modulos/ia/aplicacao/servico-ia.postgres-integracao.spec.ts --runInBand
```

O resultado valido precisa conter `1 passed, 0 skipped`. A suite apaga o
schema desse banco de teste durante a inicializacao.

## Validacoes ja executadas

```powershell
pnpm --dir octaclin-backend exec jest infraestrutura/testes/postgres-integracao.spec.ts modulos/ia/aplicacao/servico-ia.postgres-integracao.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
```

Os guards passaram; a suite PostgreSQL ficou ignorada pela ausencia deliberada
da URL de teste.
