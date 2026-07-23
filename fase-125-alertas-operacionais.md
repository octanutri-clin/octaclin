# Fase 125 - Alertas operacionais

Data: 2026-07-23

## Objetivo

Criar uma camada operacional de alertas para identificar rapidamente queda de servico, degradacao de integracoes, filas paradas e sinais de deploy incompleto antes de clientes reais dependerem do OctaClin.

## Entregas

- Criado endpoint backend `GET /operacoes/alertas`.
- Criado BFF web `GET /api/operacoes/alertas`.
- Console `/operacoes` passa a exibir `Alertas operacionais` com severidade, origem, metrica, valor e acao sugerida.
- Alertas usam `/health/detalhado` para classificar banco/backend como servico e Redis/email/WhatsApp/Google Calendar como integracoes.
- Outbox pendente ou processando acima de 15 minutos gera alerta operacional.
- Falhas consolidadas de comunicacao geram alerta com resumo por canal.
- Em producao, ausencia de metadados de deploy gera alerta informativo.
- Alertas evitam payload bruto, secrets e mensagens de erro potencialmente sensiveis.

## Decisoes

- A primeira entrega fica sem provedor pago externo de alerta, aproveitando painel operacional e endpoints existentes.
- Severidades: `critico`, `atencao`, `informativo` e `ok`.
- Falha de banco/backend e outbox pendente atrasado sao criticos.
- Degradacao de integracoes e falhas de comunicacao entram como atencao.
- Notificacao externa proativa por email/Slack/Discord pode ser adicionada depois, mas a base de regra e visibilidade ja fica pronta.

## Arquivos principais

- `octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.ts`
- `octaclin-backend/src/modulos/operacoes/apresentacao/controlador-operacoes.ts`
- `octaclin-backend/src/modulos/operacoes/modulo-operacoes.ts`
- `octaclin-backend/src/modulos/saude/modulo-saude.ts`
- `octaclin-web/app/api/operacoes/alertas/route.ts`
- `octaclin-web/lib/operacoes-api.ts`
- `octaclin-web/components/operacoes/painel-operacoes.tsx`
- `RUNBOOK_PRODUCAO.md`
- `TESTES_E_VALIDACOES.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts src/modulos/operacoes/apresentacao/controlador-operacoes.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "operacoes LGPD" --project=desktop-chromium --reporter=list
npm run security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Adicionar canal externo gratuito ou barato para notificar alertas persistentes, como email operacional ou webhook.
- Persistir historico de alertas para tendencia e pos-mortem.
- Ligar alertas de deploy ao provedor Render/GitHub Actions quando houver acesso operacional adequado.
