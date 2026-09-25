# Fase 280 — painel de operação da clínica (PB-26)

## Entregue na branch

- Leitura agregada tenant-aware para `Client`, com mês civil no fuso da
  clínica, sem retorno de paciente individual.
- Aba Operação no portal do cliente: novos, ativos, em risco, carga,
  ocupação, no-show e consultas fora do expediente por profissional.
- Contrato BFF, testes unitários, teste visual desktop/mobile e prova RLS
  de dois tenants no banco efêmero do CI.
- Reconciliados audit de produto, status, checklist, ADR-013, matriz de
  confiabilidade e resumo das fases da Onda 4.

## Validação e pendência

Resultados locais em 2026-09-25:

- **PASS**: backend typecheck e build; Jest completo com 221 suites e 2.106
  testes aprovados.
- **PASS**: Web typecheck, build, `test:authz`, BFF PB-26 (2 testes), lint
  dos arquivos alterados e Playwright do portal do cliente (10 cenarios em
  desktop/mobile).
- **PASS**: `git diff --check`, `pnpm security:secrets` e
  `validar-preflight.ps1 -DocsOnly` apos reconciliar as fases canonicas.
- **SKIPPED**: 4 suites/39 testes backend que exigem infraestrutura externa;
  a prova RLS de dois tenants nesta fase integra esse grupo. O CI deve
  executa-la em PostgreSQL efemero.
- **NA**: migration, backfill, deploy e verificacao de producao; esta fase
  nao altera schema nem executa procedimento externo.

Uma execucao do BFF em paralelo a build Web falhou por `.next/types` removido
durante a compilacao. Executado em sequencia apos a build, o mesmo teste
passou. O preflight documental inicialmente falhou porque as Fases 275–279
nao estavam reconciliadas no checklist canonico; apos a atualizacao, passou.

A revisao cruzada de tenancy nao encontrou vazamento; sua sugestao de prova
real com dois tenants foi adicionada a suite RLS. A branch não executa
migration, backfill ou ação de produção. Merge e aceite permanecem com o
proprietário após os checks da PR.

Contrato, fórmulas, escopo e rollback: `docs/history/phases/PLANO_FASE_280.md`.
