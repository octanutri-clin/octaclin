# Fase 100 - Tela de assinatura e uso no portal do cliente

Data: 2026-07-22.

## Objetivo

Evoluir a area de assinatura do portal do cliente para sair de uma leitura passiva de limites e permitir acao comercial manual antes de integrar gateway definitivo.

## Entregas

- Card de plano recomendado no portal do cliente.
- CTA de upgrade para o proximo plano aplicavel.
- CTA de revisao de limite para casos sem upgrade direto ou quando o cliente quiser negociacao manual.
- Endpoint backend `POST /cliente/assinatura/interesse`.
- Rota BFF `POST /api/cliente/assinatura/interesse` protegida por `cliente.assinatura.ler`.
- Persistencia da solicitacao comercial em `tenant_configuracoes` com chave `assinatura_interesse`.
- Auditoria `cliente.assinatura.solicitar_ajuste` sem registrar observacao livre nos metadados.
- Teste visual cobrindo solicitacao de upgrade pelo portal.

## Decisoes

- A fase ainda nao troca plano automaticamente e nao cobra pagamento.
- A solicitacao fica com status `pendente` para operacao/admin ajustar manualmente ou tratar na futura integracao de billing.
- O plano recomendado e derivado no frontend a partir do plano atual: gratuito -> profissional -> clinica -> enterprise.
- A observacao padrao do portal e curta e operacional; dados comerciais detalhados devem ser tratados fora do metadado de auditoria.

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest servico-portal-cliente.spec.ts controlador-portal-cliente.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list
pnpm --dir octaclin-web build
```

## Proxima fase recomendada

Fase 101 - Integracao de pagamento sem custo inicial ou gateway definitivo, decidindo entre controle manual administrativo, Stripe, Mercado Pago ou Asaas.
