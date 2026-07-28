# Fase 149 - Limpeza do canal de watch do Google Calendar ao desconectar

Status: entregue em 2026-07-27.

## Objetivo

Fechar o debito documentado nas Fases 136 e 145: `ServicoConexaoGoogleCalendar.desconectar()`
limpava os campos locais (`canalWatchId`, `canalRecursoId`, `canalExpiraEm`)
mas nunca avisava o Google para parar de enviar notificacoes push
(`POST /calendar/v3/channels/stop`), nem removia o registro correspondente
da tabela de lookup `google_canais_watch` usada pelo webhook de notificacoes.
O metodo `pararCanalWatch` ja existia em `ServicoGoogleCalendar` (usado pelo
processador de renovacao noturna), so nao era chamado no fluxo de
desconexao manual.

## Escopo

Unico modulo alterado: `octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.ts`
(+ teste correspondente).

- `desconectar()` agora, quando ha canal de watch ativo (`canalWatchId` e
  `canalRecursoId` presentes): chama `ServicoGoogleCalendar.pararCanalWatch`
  com as credenciais decodificadas da conexao e remove o registro de
  `GoogleCanalWatchOrm` pelo `canalWatchId` — antes de limpar os campos
  locais e marcar `desconectadoEm`.
- A chamada ao Google e tolerante a falha (try/catch com log de warning via
  `Logger`, mesmo padrao do `ProcessadorRenovacaoGoogleCalendar`): se o
  canal ja tiver expirado no lado do Google ou a chamada falhar por
  qualquer motivo, a desconexao local continua e conclui normalmente. O
  usuario nunca fica "preso" sem conseguir desconectar por causa de uma
  falha transitoria na API do Google.
- Se `GOOGLE_CALENDAR_CLIENT_ID`/`GOOGLE_CALENDAR_CLIENT_SECRET` nao
  estiverem configurados, ou nao havia canal de watch ativo, o passo e
  pulado silenciosamente (comportamento identico ao anterior nesses casos).
- Dois novos construtor-deps via injecao do NestJS: `ServicoGoogleCalendar`
  e `DataSource` (mesmos padroes ja usados por
  `ProcessadorRenovacaoGoogleCalendar`, que fica no mesmo modulo). Nenhuma
  mudanca de assinatura publica dos metodos existentes.

## Validacoes

```powershell
pnpm --dir octaclin-backend typecheck   # limpo
pnpm --dir octaclin-backend exec jest src/modulos/agenda/aplicacao/servico-conexao-google-calendar.spec.ts src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.spec.ts --runInBand   # 14 passed
pnpm --dir octaclin-backend exec jest --runInBand   # 59 suites / 321 testes
pnpm --dir octaclin-backend build       # ok
```

## Observacao

O achado original (Fase 136) tambem citava a ausencia de importacao inbound
por `syncToken` e recorrencia avancada — esses permanecem fora do escopo
desta fase e continuam registrados como pendencia futura em
`CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
