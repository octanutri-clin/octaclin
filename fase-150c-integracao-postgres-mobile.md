# Fase 150C - Integracao PostgreSQL para Mobile

Status: concluida em 2026-07-29.

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

O aceite foi executado em 2026-07-29 no projeto Neon exclusivo
`octaclin-integration-tests`, banco `octaclin_test_fase150b`, com confirmacao
`APAGAR`. O banco tem o schema apagado antes de cada suite. Staging e producao
nao foram usados.

## Como executar o aceite conjunto 150B e 150C

```powershell
$env:OCTACLIN_POSTGRES_INTEGRACAO_URL='<url do banco octaclin_test_fase150b>'
$env:OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR='APAGAR'
pnpm --dir octaclin-backend exec jest modulos/ia/aplicacao/servico-ia.postgres-integracao.spec.ts modulos/mobile/aplicacao/servico-mobile.postgres-integracao.spec.ts --runInBand
```

O aceite conjunto resultou em `2 passed, 0 skipped`, com seis testes de
integracao ativos.

## Validacoes ja executadas

```powershell
pnpm --dir octaclin-backend exec jest modulos/mobile/aplicacao/servico-mobile.postgres-integracao.spec.ts --runInBand
```

O aceite PostgreSQL remoto passou em 2026-07-29. O setup agora remove a funcao
temporaria de atraso antes de cada teste, permitindo repeticao segura apos uma
execucao interrompida; a suite usa timeout explicito de 30 segundos para Neon.
