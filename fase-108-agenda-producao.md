# Fase 108 - Agenda de producao

Data: 2026-07-22

## Objetivo

Amadurecer a agenda interna para uso real, reduzindo risco de conflito de horario e permitindo remarcar/cancelar consultas com reflexo no Google Calendar quando a integracao estiver configurada.

## Entregas

- Validacao backend contra sobreposicao de consultas agendadas do mesmo profissional.
- Remarcacao de consulta com historico no payload e auditoria no controller.
- Cancelamento de consulta com motivo opcional, historico no payload e auditoria no controller.
- Google Calendar expandido para criar, atualizar via `PATCH` e cancelar via `DELETE`.
- BFF web para `PATCH`/`DELETE` em `/api/agenda/consultas/[consultaId]`.
- Tela `/agenda` com controles por consulta para nova data/hora, duracao, local e cancelamento.
- Regressao visual desktop/mobile para remarcar e cancelar consulta.

## Decisoes

- A disponibilidade de producao nesta fase usa conflito local por profissional e janela de horario.
- A sincronizacao Google entregue nesta fase cobre o fluxo OctaClin -> Google Calendar: criar, remarcar e cancelar.
- Recorrencia avancada e importacao bidirecional por `syncToken` nao foram acopladas nesta entrega para evitar automacao parcial sem operacao/observabilidade; permanecem como evolucao futura junto das automacoes e monitoramento.

## Arquivos principais

- `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.ts`
- `octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.ts`
- `octaclin-backend/src/modulos/agenda/apresentacao/controlador-agenda.ts`
- `octaclin-web/app/api/agenda/consultas/[consultaId]/route.ts`
- `octaclin-web/lib/agenda-api.ts`
- `octaclin-web/components/agenda/painel-agenda.tsx`
- `octaclin-web/tests/visual/console-regression.spec.mjs`

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest servico-agenda.spec.ts servico-google-calendar.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite remarcar e cancelar consulta agendada|agrega rotina diaria do profissional" --project=desktop-chromium --project=mobile-chromium --reporter=list
```

## Pendencias para fases futuras

- Recorrencia real com regras versionadas, edicao de serie e excecoes.
- Sincronizacao inbound por `syncToken`/watch channels do Google Calendar.
- Reenvio de comunicacoes especificas de remarcacao/cancelamento por email/WhatsApp.
- Tela de disponibilidade por agenda do profissional.
