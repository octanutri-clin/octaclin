# Fase 95 - Permissoes finas para usuarios administrativos

## Objetivo

Separar as capacidades de `Client`, `Professional` e `Collaborator` para reduzir acesso excessivo e migrar rotas sensiveis para checagem por permissao explicita.

## Entregas

- Matriz de permissoes refinada:
  - `Client`: conta, assinatura, configuracoes, usuarios e convites administrativos.
  - `Professional`: rotinas clinicas completas, incluindo pacientes, questionarios, agenda, comunicacoes, automacoes, IA e gamificacao.
  - `Collaborator`: operacao delegada, com leitura/listagem, agenda e mensagens, sem gestao clinica avancada.
- Novo decorator backend `@Permissoes(...)`.
- Novo `GuardaPermissoes` no backend, exportado pelo modulo de auth.
- Controllers sensiveis protegidos por permissao alem de papel.
- BFF do portal do cliente validando permissoes antes de proxyar chamadas administrativas.
- Middleware web bloqueando rotas operacionais quando a sessao nao contem a permissao exigida.
- UI escondendo menus e acoes administrativas sem permissao correspondente.
- Testes backend e web cobrindo matriz, guard e decisao de rota por permissao.

## Decisoes

- `Collaborator` permanece com acesso operacional para agenda, mensagens e leitura/listagem de pacientes/questionarios.
- `Collaborator` nao gerencia pacientes, questionarios, automacoes, IA, mobile, gamificacao nem profissionais.
- `Professional` pode gerenciar pacientes/questionarios e recursos clinicos.
- `Client` continua isolado no portal do cliente e nao acessa rotinas clinicas.
- As checagens por papel continuam existindo como primeira barreira; permissoes viram a segunda barreira fina.

## Arquivos principais

- `octaclin-backend/src/modulos/auth/dominio/permissoes.ts`
- `octaclin-backend/src/modulos/auth/apresentacao/guarda-permissoes.ts`
- `octaclin-backend/src/modulos/auth/apresentacao/decorators.ts`
- `octaclin-backend/src/modulos/clientes/apresentacao/controlador-portal-cliente.ts`
- `octaclin-web/lib/server/autorizacao-rotas.ts`
- `octaclin-web/lib/server/permissoes-bff.ts`
- `octaclin-web/lib/server/sessao-bff.ts`
- `octaclin-web/components/app/console-shell.tsx`
- `octaclin-web/components/cliente/portal-cliente.tsx`

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest permissoes.spec.ts guarda-permissoes.spec.ts servico-usuarios-cliente.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web typecheck
```

## Resultado

Fase concluida. O OctaClin passa a ter controle fino de capacidades administrativas e operacionais, reduzindo o risco de um perfil delegado acessar rotinas de gestao indevidas.
