# Fase 92 - Convites para usuarios administrativos

## Objetivo

Trocar a senha inicial manual do portal do cliente por um fluxo de convite com link de primeiro acesso enviado por email.

## Entregas

- `POST /cliente/usuarios` agora recebe apenas `email` e `role`.
- O usuario criado recebe senha temporaria aleatoria, nao conhecida pelo cliente nem retornada pela API.
- O backend cria token em `tokens_redefinicao_senha` com origem `convite_usuario_cliente`, expiracao de 7 dias e vinculo ao usuario criador.
- O convite usa a tela existente `/recuperar-senha?token=...` para o convidado criar a propria senha.
- O email de convite e enviado pelo adaptador atual (`AdaptadorEmailSmtp`), reaproveitando a configuracao Gmail/SMTP existente.
- A tela `/cliente` removeu o campo `Senha inicial` e passou a informar que o link de primeiro acesso sera enviado por email.

## Validacoes

- `pnpm --dir octaclin-backend test -- servico-usuarios-cliente.spec.ts servico-recuperacao-senha.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list`
- `pnpm --dir octaclin-web build`

## Proxima fase sugerida

Fase 93 - Auditoria e reenvio/revogacao de convites administrativos, para o cliente acompanhar convites pendentes e corrigir e-mails enviados incorretamente.
