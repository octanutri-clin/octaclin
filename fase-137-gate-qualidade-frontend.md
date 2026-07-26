# Fase 137 - Gate de qualidade do frontend

Data: 2026-07-26.

## Objetivo

Transformar o lint do frontend em uma verificacao reproduzivel localmente e no
CI, removendo problemas estaticos encontrados na primeira revisao transversal
do codigo ja entregue.

## Entrega

- Criada a configuracao `.eslintrc.json` com `next/core-web-vitals` e
  `next/typescript`.
- Substituido o comando interativo `next lint` por `eslint .` no pacote web.
- Incluido `pnpm lint` no job `Web Next.js` do GitHub Actions.
- Removidos 18 erros de lint: casts `any` de rotas, tipos vagos de
  notificacoes da agenda, importacoes mortas, parametros mortos e dependencia
  incompleta de hook.

## Validacoes executadas

```powershell
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web build
```

Todos os comandos passaram em 2026-07-26. O `typecheck` deve ser executado
fora de concorrencia com `pnpm build`, pois o `tsconfig` usa arquivos gerados
em `.next/types` e o build pode recria-los temporariamente.

## Achados para a proxima fase

As auditorias de dependencias localizaram vulnerabilidades conhecidas em
dependencias de producao. A Fase 138 deve tratar as atualizacoes de forma
controlada, sem `upgrade` massivo: `multer`, `lodash`, `typeorm` e `postcss`
tem correcoes disponiveis; o Next.js exige uma atualizacao major planejada e
testada separadamente.
