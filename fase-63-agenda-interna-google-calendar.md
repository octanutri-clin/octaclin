# Fase 63 - Agenda interna e Google Calendar

## Objetivo

Implementar uma agenda interna de consultas no OctaClin, com sincronizacao opcional no Google Calendar e disparo de aviso por e-mail e WhatsApp no momento do agendamento.

## Entregue

- Novo modulo backend `agenda` com endpoint autenticado `GET/POST /agenda/consultas`.
- Tabela `agenda_consultas` com isolamento por tenant, indices por horario/paciente e metadados de integracao.
- Integracao Google Calendar via OAuth refresh token usando `events.insert`.
- Tela `/agenda` no console web com formulario de consulta, contatos de e-mail/WhatsApp, status de sincronizacao e listagem de consultas.
- Envio de e-mail com o texto completo do aviso de agendamento.
- Disparo WhatsApp reaproveitando o canal/template aprovado disponivel, mantendo o texto do aviso no payload para mapeamento posterior de templates Meta.

## Variaveis novas

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_CALENDAR_TOKEN_URI`
- `GOOGLE_CALENDAR_TIMEZONE`

## Validacao

- `pnpm --dir octaclin-backend test --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-backend build`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`

## Observacao operacional

Sem as variaveis Google Calendar configuradas, o agendamento interno continua funcionando e registra `configuracao_ausente` no status de sincronizacao. O WhatsApp segue limitado aos templates aprovados pela Meta; o texto exato fica persistido para ser usado no mapeamento quando os templates forem aprovados.
