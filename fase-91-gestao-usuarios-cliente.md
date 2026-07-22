# Fase 91 - Gestao inicial de usuarios do cliente

## Objetivo

Permitir que o usuario com papel `Client` gerencie os acessos administrativos iniciais da propria conta no portal `/cliente`, sem acessar rotinas clinicas nem dados de pacientes.

## Entregas

- Backend `GET /cliente/usuarios` para listar apenas usuarios administrativos do tenant (`Client`, `Professional`, `Collaborator`).
- Backend `POST /cliente/usuarios` para criar acessos `Professional` ou `Collaborator` com email criptografado, hash de busca e senha protegida.
- Backend `DELETE /cliente/usuarios/:id` para desativar usuario administrativo da conta, bloqueando a desativacao do proprio gestor logado.
- BFF web `/api/cliente/usuarios` e `/api/cliente/usuarios/[id]`.
- Painel `Gerenciar usuarios` na tela `/cliente`, com listagem, formulario de convite e acao de desativacao.
- Testes focados para isolamento de tenant, nao exposicao de credenciais e bloqueio de auto-desativacao.

## Validacoes

- `pnpm --dir octaclin-backend test -- servico-usuarios-cliente.spec.ts servico-portal-cliente.spec.ts permissoes.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list`
- `pnpm --dir octaclin-web build`

## Proxima fase sugerida

Fase 92 - Convites e fluxo de primeiro acesso para usuarios administrativos, trocando senha inicial manual por convite seguro com expiracao.
