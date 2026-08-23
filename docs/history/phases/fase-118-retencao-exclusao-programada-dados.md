# Fase 118 - Retencao e exclusao programada de dados

Data: 2026-07-23

## Objetivo

Criar a base operacional de governanca LGPD para retenção de dados, permitindo enxergar dados vencidos por politica e registrar uma programacao auditavel antes de qualquer exclusao fisica.

## Entregas

- Backend adiciona politicas versionadas de retencao por tipo de dado.
- Politicas cobrem auditoria operacional, outbox processado, sincronizacao mobile, mensagens de notificacao e consentimentos LGPD.
- Backend calcula itens vencidos por corte temporal usando `LessThanOrEqual` por tenant.
- Nova rota `GET /operacoes/lgpd/retencao` retorna versao, politicas e resumo consolidado.
- Nova rota `POST /operacoes/lgpd/retencao/programar` gera protocolo `RET-*` e registra evento auditavel.
- Programacao de retencao e salva em `consentimentos_lgpd` com tipo `retencao_dados_programada`.
- BFF web expõe as rotas autenticadas em `/api/operacoes/lgpd/retencao` e `/api/operacoes/lgpd/retencao/programar`.
- Painel operacional LGPD exibe total de itens vencidos, politicas, acao prevista e corte temporal.
- Painel permite programar retencao LGPD e mostra confirmacao com protocolo.
- Regressao visual cobre a nova area no desktop e mobile sem overflow horizontal.

## Decisoes

- A fase nao executa exclusao fisica nem anonimizacao automatica; ela cria governanca, previsao e protocolo auditavel.
- `consentimentos_lgpd` foi reutilizada como trilha de eventos LGPD para evitar nova tabela antes do workflow de execucao real.
- A versao inicial das politicas de retencao e `2026-10`.
- Eventos de outbox elegiveis sao apenas `processado`; falhas continuam preservadas para diagnostico operacional.
- Consentimentos antigos sao contados como vencidos para acompanhamento, mas a acao da politica e `preservar`.

## Arquivos principais

- `octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.ts`
- `octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts`
- `octaclin-backend/src/modulos/operacoes/apresentacao/controlador-operacoes.ts`
- `octaclin-web/app/api/operacoes/lgpd/retencao/route.ts`
- `octaclin-web/app/api/operacoes/lgpd/retencao/programar/route.ts`
- `octaclin-web/lib/operacoes-api.ts`
- `octaclin-web/components/operacoes/painel-operacoes.tsx`
- `octaclin-web/tests/visual/console-regression.spec.mjs`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest --runInBand src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
$env:E2E_WEB_URL='http://localhost:3108'; pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --grep "operacoes LGPD"
```

## Pendencias para fases futuras

- Definir fluxo de aprovacao dupla antes de executar exclusao ou anonimizacao real.
- Implementar job seguro de execucao com dry-run, logs e reversibilidade quando aplicavel.
- Conectar a exportacao LGPD completa por titular antes de atender pedidos de portabilidade em producao.
