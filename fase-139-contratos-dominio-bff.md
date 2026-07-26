# Fase 139 - Contratos de dominio e fronteiras BFF

Status: concluida em 2026-07-26.

## Entrega

- Criado contrato tipado para resultados de notificacao de agenda e para o
  resumo de notificacoes de consulta, incluindo email, WhatsApp e Google
  Calendar.
- Substituido `any` por `EntityManager` nas operacoes transacionais de convite
  administrativo do cliente.
- Eliminados `any` residuais no codigo de producao do backend; mocks de testes
  continuam explicitamente flexiveis quando necessario.
- Revisada a fronteira BFF autenticada. O helper
  `requisitarBackendAutenticado` continua sendo o unico ponto que trata sessao,
  renovacao de token, indisponibilidade de rede e HTML indevido vindo do backend
  antes de entregar resposta para as rotas Next.js.

## Validacoes executadas

```powershell
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web build
```

Resultado: backend com 47 suites/244 testes; frontend com lint, typecheck,
autorizacao de rotas e build aprovados.
