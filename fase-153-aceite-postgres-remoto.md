# Fase 153 - Aceite PostgreSQL remoto das fases 150B/150C

## Status

Concluida em 2026-07-29.

## Objetivo

Executar o aceite real das suites PostgreSQL criadas nas fases 150B e 150C,
sem reutilizar staging ou producao.

## Ambiente aceito

- Projeto Neon exclusivo: `octaclin-integration-tests`.
- Banco descartavel: `octaclin_test_fase150b`.
- Confirmacao destrutiva exigida: `OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR=APAGAR`.
- Nenhuma credencial foi gravada em arquivo, commit, log de projeto ou Git.

## Resultado

- `servico-ia.postgres-integracao.spec.ts`: 3 testes aprovados.
- `servico-mobile.postgres-integracao.spec.ts`: 3 testes aprovados.
- Total: 2 suites e 6 testes ativos, sem skips.
- Controles confirmados: lock concorrente, cache isolado por paciente,
  bloqueio de profissional, constraint real de sincronizacao, corrida de
  chave unica e isolamento de `idLocal`.

## Ajustes feitos

- As duas suites receberam timeout explicito de 30 segundos para acomodar
  latencia de PostgreSQL remoto, sem alterar o timeout global de testes.
- O setup Mobile remove `atrasar_diario_mobile()` antes de cada teste. A
  funcao e usada apenas para simular corrida e poderia sobreviver a uma
  execucao local interrompida.

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest modulos/ia/aplicacao/servico-ia.postgres-integracao.spec.ts modulos/mobile/aplicacao/servico-mobile.postgres-integracao.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-backend build
pnpm test:handoff
pnpm validate:docs
git diff --check
```
