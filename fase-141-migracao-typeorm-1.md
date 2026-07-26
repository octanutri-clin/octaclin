# Fase 141 - Migracao major do TypeORM

Status: concluida em 2026-07-26.

## Objetivo

Eliminar a dependencia transitoria vulneravel de `brace-expansion` sem usar
overrides incompativeis no TypeORM 0.3.

## Entrega

- TypeORM atualizado de 0.3.31 para 1.1.0.
- Removido `typeorm-ts-node-commonjs`; o CLI CommonJS agora e fornecido pelo
  pacote oficial TypeORM.
- Codemod oficial `@typeorm/codemod v1 src` executado: 222 arquivos analisados,
  sem erros e sem transformacoes necessarias.
- Adicionado `dotenv/config` ao datasource para que migrations executadas pelo
  CLI preservem o carregamento de ambiente fora do bootstrap Nest.

## Validacoes executadas

```powershell
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-backend typeorm -- migration:run --help
pnpm --dir octaclin-backend audit --prod
```

Resultado: typecheck, build, CLI e 47 suites/244 testes aprovados. A auditoria
de producao do backend retornou zero vulnerabilidades de qualquer severidade.

## Limite de validacao

Nenhuma migration foi aplicada nesta fase. Antes de um deploy que altere banco,
continuar usando o procedimento de migration/restore em ambiente dedicado,
nunca o banco de producao para teste.
