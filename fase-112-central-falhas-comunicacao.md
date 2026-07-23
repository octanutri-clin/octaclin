# Fase 112 - Central de falhas de comunicacao

Data: 2026-07-22

## Objetivo

Criar uma central operacional para suporte acompanhar e reprocessar falhas de comunicacao envolvendo mensagens, WhatsApp, email, Google Calendar e outbox.

## Entregas

- Central consolidada de falhas em `ServicoOperacoes`.
- Classificacao por origem: `mensagem`, `outbox` e `google_calendar`.
- Classificacao por canal: email, WhatsApp, Google Calendar, outbox, push ou outro.
- Resumo operacional com totais por canal e quantidade reprocessavel.
- Reprocessamento unificado por id composto, como `mensagem:<id>`, `outbox:<id>` e `google_calendar:<consultaId>`.
- Reprocessamento de mensagens falhas via `ProcessadorNotificacoes`.
- Reprocessamento de Google Calendar com criacao, atualizacao ou cancelamento conforme estado da consulta.
- Endpoints backend e BFF para listar e reprocessar falhas da central.
- Tela `/operacoes` com filtros por origem, canal, tipo/evento e periodo.
- Manutencao da antiga area de outbox bruto para diagnostico tecnico complementar.

## Decisoes

- A central reaproveita dados existentes, sem migracao nova: `mensagens_notificacao`, `outbox_eventos` e `agenda_consultas.notificacoes.googleCalendar`.
- Falhas de Google Calendar com motivo `evento_google_ausente` nao entram na central, pois indicam ausencia esperada de evento externo, nao erro operacional.
- O reprocessamento de mensagens usa `propagarErro: false` para reenfileirar/processar sem derrubar a acao operacional quando o provedor continuar indisponivel.
- O reprocessamento de outbox continua usando o fluxo existente que volta o evento para `pendente`.

## Arquivos principais

- `octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.ts`
- `octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts`
- `octaclin-backend/src/modulos/operacoes/apresentacao/controlador-operacoes.ts`
- `octaclin-backend/src/modulos/operacoes/modulo-operacoes.ts`
- `octaclin-web/app/api/operacoes/comunicacoes/falhas/route.ts`
- `octaclin-web/app/api/operacoes/comunicacoes/falhas/[id]/reprocessar/route.ts`
- `octaclin-web/lib/operacoes-api.ts`
- `octaclin-web/components/operacoes/painel-operacoes.tsx`

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand servico-operacoes.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web build
cd octaclin-web; .\node_modules\.bin\playwright.cmd test tests/visual/console-regression.spec.mjs -g "operacoes LGPD" --project=desktop-chromium --reporter=list
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Adicionar exportacao CSV especifica da central consolidada.
- Adicionar notificacao/alerta automatico quando falhas criticas ultrapassarem limite por canal.
- Evoluir reprocessamento em lote com selecao multipla e auditoria por operador.
