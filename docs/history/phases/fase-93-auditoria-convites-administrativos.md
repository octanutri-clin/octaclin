# Fase 93 - Auditoria e controle de convites administrativos

## Objetivo

Dar ao cliente visibilidade e controle sobre convites administrativos pendentes, com reenvio e revogacao sem criar uma tabela nova.

## Entregas

- Backend `GET /cliente/usuarios/convites` para listar convites pendentes originados em `convite_usuario_cliente`.
- Backend `POST /cliente/usuarios/:id/convite/reenvio` para revogar tokens pendentes anteriores, gerar novo token e reenviar email.
- Backend `DELETE /cliente/usuarios/:id/convite` para revogar tokens pendentes e desativar o usuario convidado.
- Auditoria basica no `payload` do token: criador, reenviador, revogador, motivo e erro de email quando houver.
- BFF web para listar, reenviar e revogar convites administrativos.
- Tela `/cliente` com secao `Convites pendentes`, exibindo email, papel, status, expiracao, reenvio e revogacao.

## Validacoes

- `pnpm --dir octaclin-backend test -- servico-usuarios-cliente.spec.ts servico-recuperacao-senha.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list`
- `pnpm --dir octaclin-web build`

## Proxima fase sugerida

Fase 95 - Perfis e permissoes finas para usuarios administrativos, separando colaborador operacional, profissional e gestor da conta.
