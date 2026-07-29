# Fase 150C - Integracao PostgreSQL para Mobile

Status: em andamento em 2026-07-28.

## Objetivo

Comprovar em PostgreSQL real, dedicado e descartavel os controles da Fase 150A
para sincronizacao Mobile: idempotencia por paciente, recuperacao da corrida
de chave unica e bloqueio de acesso entre profissionais.

## Escopo implementado

- O harness seguro da Fase 150B ganhou schema minimo Mobile, composto por
  `profissionais`, `pacientes`, `logs_diario_rapido` e
  `sincronizacoes_mobile`, com a constraint real `unique (tenant_id, id_local)`.
- A nova suite prepara uma corrida real com trigger PostgreSQL e `pg_sleep`,
  garantindo que duas sincronizacoes simultaneas disputem a mesma reserva.
- Os cenarios preparados verificam que a corrida retorna o mesmo recurso sem
  duplicar o diario, que o mesmo `idLocal` entre pacientes permanece isolado e
  que um profissional nao reserva sincronizacao de paciente alheio.

## Limites e dependencia externa

Assim como a Fase 150B, a prova exige uma base exclusiva com nome
`octaclin_test_<nome>` e confirmacao `APAGAR`. O banco tem o schema apagado
antes de cada suite. Nao usar staging ou producao. Nesta maquina nao ha Docker,
PostgreSQL local nem URL de integracao; por isso a fase ainda nao esta aceita.

## Como executar o aceite conjunto 150B e 150C

```powershell
$env:OCTACLIN_POSTGRES_INTEGRACAO_URL='<url do banco octaclin_test_fase150b>'
$env:OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR='APAGAR'
pnpm --dir octaclin-backend exec jest modulos/ia/aplicacao/servico-ia.postgres-integracao.spec.ts modulos/mobile/aplicacao/servico-mobile.postgres-integracao.spec.ts --runInBand
```

O aceite exige `2 passed, 0 skipped`, com seis testes de integracao ativos.

## Validacoes ja executadas

```powershell
pnpm --dir octaclin-backend exec jest modulos/mobile/aplicacao/servico-mobile.postgres-integracao.spec.ts --runInBand
```

A suite foi compilada e permaneceu ignorada sem a URL de banco, como previsto.
