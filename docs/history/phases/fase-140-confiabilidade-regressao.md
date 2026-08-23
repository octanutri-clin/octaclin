# Fase 140 - Cobertura de confiabilidade e regressao

Status: concluida em 2026-07-26.

## Entrega

- Criada `MATRIZ_CONFIABILIDADE_TESTES.md` com os riscos que bloqueiam deploy,
  testes correspondentes, comandos de execucao e gates operacionais.
- Criado `pnpm test:confiabilidade`, que valida as referencias de testes
  criticos e categorias de risco obrigatorias na matriz.
- Consolidado o uso de suites negativas ja existentes para multi-tenant,
  autorizacao, BFF/sessao e falhas de integracao.

## Validacoes

```powershell
pnpm test:confiabilidade
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
```

## Regra de continuidade

Qualquer fase que inclua um novo fluxo clinico, integracao externa, dado
sensivel ou permissao deve atualizar a matriz com risco, teste e gate antes de
ser considerada concluida.
