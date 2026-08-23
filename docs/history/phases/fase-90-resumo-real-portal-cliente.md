# Fase 90 - Resumo real do portal do cliente

## Entregue

- Criado o endpoint backend `GET /cliente/resumo`, protegido por JWT e papel `Client`.
- Criado o modulo backend `ModuloClientes`.
- O resumo do cliente usa `TenantOrm` para dados reais da conta autenticada.
- O resumo calcula usuarios ativos por papel com isolamento por `tenantId`.
- Criada a BFF `GET /api/cliente/resumo`.
- Criado o contrato frontend `ResumoPortalClienteApi`.
- A tela `/cliente` deixou de usar dados estaticos e passou a carregar conta, assinatura e usuarios via BFF.
- O seed demo agora inclui o usuario `gestor@octaclin.local` com papel `Client`.

## Decisoes

- A assinatura permanece como `Plano gratuito` com origem `base_inicial` ate existir integracao real de billing.
- O resumo de usuarios conta apenas usuarios ativos do tenant autenticado.
- Perfis `SuperAdmin`, `Professional` e `Collaborator` entram no total de profissionais para a visao comercial da conta.
- O endpoint fica em `/cliente/resumo`, separado de `/portal/paciente`, para evitar mistura de responsabilidades.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-portal-cliente.spec.ts permissoes.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`
- `playwright test tests/visual/portal-cliente.spec.mjs`

## Proxima fase

Fase 91: criar gestao inicial de usuarios do cliente para convidar/organizar acessos de conta sem entrar no console clinico.
