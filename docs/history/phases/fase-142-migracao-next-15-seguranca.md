# Fase 142 - Migracao controlada para Next.js 15

Status: concluida em 2026-07-26.

## Objetivo

Remover as vulnerabilidades de producao do frontend sem ampliar o escopo para
React 19 ou Next.js 16.

## Entrega

- Next.js e `eslint-config-next` atualizados para 15.5.22.
- React e React DOM permanecem em 18.3.1, compativeis com Next.js 15.
- Codemod oficial `next-async-request-api` aplicado.
- 35 entradas dinamicas de App Router usam `Promise` e `await` para `params`.
- Paginas de primeiro acesso e recuperacao aguardam `searchParams`.
- `typedRoutes` usa a configuracao estavel e `outputFileTracingRoot` fixa o
  limite do deploy no diretorio do frontend.
- `postcss` 8.5.23 e `sharp` 0.35.3 sao fixados por overrides do pnpm para
  remover vulnerabilidades transitivas do Next.js.
- `sharp` foi autorizado explicitamente na politica de builds do pnpm e
  validado pelo build de producao.
- Novo gate `pnpm --dir octaclin-web test:next15` impede novos parametros
  dinamicos sincronos.

## Compatibilidade e pendencia futura

O Next.js 15 ainda permite o acesso sincrono a `cookies()` como transicao. O
codemod aplicou `UnsafeUnwrappedCookies` em `lib/server/sessao-bff.ts` porque
as funcoes de sessao sao sincronas e usadas pelas rotas BFF. Uma futura
migracao para Next.js 16/React 19 deve tornar essas funcoes assincronas e
remover esse shim; nao antecipar essa mudanca sem uma fase dedicada.

## Validacoes

```powershell
pnpm --dir octaclin-web test:next15
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web build
pnpm --dir octaclin-web audit --prod
```

Resultado: todas aprovadas, com 88 rotas geradas no build e nenhuma
vulnerabilidade conhecida na auditoria de producao.
