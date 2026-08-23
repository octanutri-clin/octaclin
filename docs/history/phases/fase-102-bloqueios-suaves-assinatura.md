# Fase 102 - Bloqueios suaves por inadimplencia/limite

Data: 2026-07-22

## Objetivo

Bloquear novas acoes quando a assinatura estiver suspensa/cancelada ou quando o limite do plano for atingido, sem impedir acesso aos dados existentes.

## Entregue

- `ServicoPortalCliente.checarLimite` passou a retornar motivo de bloqueio por limite excedido ou assinatura bloqueada.
- Assinatura `suspensa` ou `cancelada` bloqueia novas acoes e informa mensagem operacional clara.
- Criacao de usuarios administrativos consulta `usuariosAdministrativos` antes de gravar usuario, token ou email de convite.
- Criacao de pacientes consulta `pacientes` antes de gravar dados sensiveis.
- Portal do cliente exibe aviso de assinatura bloqueada e desabilita convite de usuario.
- Teste visual cobre o estado de assinatura suspensa no portal do cliente.

## Regra de produto

O bloqueio e suave: novas criacoes sao bloqueadas, mas leitura, historico, configuracoes, listagens, exportacoes e dados essenciais continuam acessiveis.

## Validacoes

- `pnpm --dir octaclin-backend exec jest servico-portal-cliente.spec.ts servico-usuarios-cliente.spec.ts servico-pacientes.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-web build`
- `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list`

## Pendencias

- Fase 103: dashboard inicial do profissional.
- Futuro: expandir bloqueios para outros recursos limitaveis, como formularios ativos, mensagens mensais e armazenamento.
