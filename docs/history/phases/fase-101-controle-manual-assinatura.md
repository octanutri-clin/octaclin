# Fase 101 - Controle manual de assinatura

Data: 2026-07-22

## Objetivo

Entregar uma alternativa sem custo inicial para administracao de assinatura enquanto um gateway definitivo fica para decisao posterior.

## Entregue

- Backend operacional para listar solicitacoes comerciais de assinatura registradas em `tenant_configuracoes`.
- Backend operacional para aplicar manualmente um plano SaaS por tenant.
- Encerramento automatico da solicitacao comercial ao aplicar o plano.
- BFF web para `/api/operacoes/assinaturas/solicitacoes`.
- BFF web para `/api/operacoes/assinaturas/plano`.
- Secao `Assinaturas` no painel `/operacoes`, com fila de solicitacoes e acao de aplicar plano.
- Atualizacao do mapa de rotas e permissoes.

## Decisao de produto

Para o MVP, o OctaClin passa a suportar controle manual administrativo de assinatura. Isso evita custo e complexidade imediata de gateway, mantendo status de plano confiavel por tenant. Stripe, Mercado Pago ou Asaas continuam como opcoes futuras quando houver necessidade de cobranca automatica.

## Validacoes

- `pnpm --dir octaclin-backend exec jest servico-operacoes.spec.ts --runInBand`
- `pnpm --dir octaclin-backend exec jest servico-operacoes.spec.ts servico-portal-cliente.spec.ts controlador-portal-cliente.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-web build`
- `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "operacoes (LGPD|assinatura)" --project=desktop-chromium --project=mobile-chromium --reporter=list`
- `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`
- Scan local de padroes de secrets sem ocorrencias.

## Pendencias

- Fase 102: bloqueios suaves por inadimplencia/limite.
- Futuro: escolher gateway definitivo se a operacao manual deixar de ser suficiente.
