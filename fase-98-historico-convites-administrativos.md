# Fase 98 - Convite, reenvio e revogacao com auditoria operacional completa

Data: 2026-07-22

## Objetivo

Evoluir os convites administrativos do cliente para ter historico operacional completo, com visibilidade de quem convidou, reenviou, revogou ou usou o convite, alem de exportacao CSV simples.

## Entregas

- Backend `GET /cliente/usuarios/convites/historico`.
- Backend `GET /cliente/usuarios/convites/historico/exportar.csv`.
- Auditoria explicita nas acoes `cliente.convite.criar`, `cliente.convite.reenviar` e `cliente.convite.revogar`.
- BFF `GET /api/cliente/usuarios/convites/historico`.
- BFF `GET /api/cliente/usuarios/convites/historico/exportar.csv`.
- UI `Historico de convites` no portal do cliente.
- Link `Exportar CSV` no portal do cliente.
- Testes unitarios de servico/controller e teste visual cobrindo a nova area.

## Decisoes

- O historico usa os tokens de primeiro acesso ja persistidos em `tokens_redefinicao_senha`, filtrando `payload.origem = convite_usuario_cliente`.
- O CSV nao exporta `tokenHash`, hash de email, senha ou qualquer token bruto.
- A auditoria registra o usuario executor via `user_action_logs` e metadados operacionais minimos.

## Arquivos principais

- `octaclin-backend/src/modulos/clientes/aplicacao/servico-usuarios-cliente.ts`
- `octaclin-backend/src/modulos/clientes/aplicacao/servico-usuarios-cliente.spec.ts`
- `octaclin-backend/src/modulos/clientes/apresentacao/controlador-portal-cliente.ts`
- `octaclin-backend/src/modulos/clientes/apresentacao/controlador-portal-cliente.spec.ts`
- `octaclin-web/app/api/cliente/usuarios/convites/historico/route.ts`
- `octaclin-web/app/api/cliente/usuarios/convites/historico/exportar.csv/route.ts`
- `octaclin-web/components/cliente/portal-cliente.tsx`
- `octaclin-web/lib/cliente-api.ts`
- `octaclin-web/tests/visual/portal-cliente.spec.mjs`

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest servico-usuarios-cliente.spec.ts controlador-portal-cliente.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list
```

## Resultado

Fase pronta para rastrear e exportar o ciclo operacional de convites administrativos no portal do cliente.
