# Fase 138 - Atualizacao controlada de dependencias de seguranca

Status: concluida em 2026-07-26.

## Objetivo

Reduzir vulnerabilidades conhecidas sem aplicar atualizacoes maiores sem
validacao de compatibilidade, especialmente em autenticacao, agenda, filas e
bootstrap de producao.

## Checkpoint backend entregue

- NestJS atualizado da linha 10 para a linha 11, incluindo `common`, `core`,
  `platform-express`, `config`, `jwt`, `schedule`, `typeorm`, `bullmq`, CLI,
  schematics e testing.
- TypeORM atualizado de 0.3.30 para 0.3.31, que corrige a vulnerabilidade de
  geracao de migration.
- O servico de autenticacao passou a validar as duracoes JWT de ambiente antes
  de assinar tokens, atendendo a tipagem mais estrita do `@nestjs/jwt` 11.
- A auditoria de dependencias de producao do backend caiu de 6 vulnerabilidades
  altas, 9 moderadas e 1 baixa para 1 vulnerabilidade alta e nenhuma moderada
  ou baixa.

## Validacoes do checkpoint

```powershell
pnpm --dir octaclin-backend test --runInBand src/modulos/auth/aplicacao/servico-auth.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-backend audit --prod
```

Resultado: 47 suites e 244 testes aprovados.

## Fechamento da pendencia transitoria

- A Fase 141 atualizou TypeORM de 0.3.31 para 1.1.0 e removeu o wrapper CLI
  obsoleto. O codemod oficial foi executado sobre `src` sem transformacoes
  necessarias; o datasource passou a carregar `dotenv/config` explicitamente
  para preservar o CLI de migrations fora do bootstrap Nest.
- A auditoria de producao do backend passou a retornar zero vulnerabilidades
  altas, moderadas, baixas e criticas.

## Pendencia separada

- O frontend continua em Next.js 14/React 18. A auditoria web exige migracao
  major para Next.js atual e React 19, com codemods e regressao visual/BFF em
  fase propria antes de qualquer deploy.
