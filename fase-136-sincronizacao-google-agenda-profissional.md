# Fase 136 - Sincronizacao em tempo real com a Google Agenda pessoal do profissional

Status: planejado (design aprovado em 2026-07-24, implementacao ainda nao iniciada).

## Objetivo

Permitir que cada profissional conecte a propria conta Google via OAuth e
tenha mudancas feitas diretamente na Google Agenda pessoal dele refletidas em
tempo real no OctaClin (sincronizacao inbound), complementando o fluxo
outbound que ja existe hoje (OctaClin -> Google Calendar).

## Contexto

O `ServicoGoogleCalendar` atual
(`octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.ts`)
so envia eventos do OctaClin para uma unica agenda Google compartilhada do
tenant, configurada por variaveis de ambiente
(`GOOGLE_CALENDAR_CLIENT_ID/SECRET/REFRESH_TOKEN/CALENDAR_ID`). Nao existe
conexao OAuth por profissional, nao existe endpoint de webhook/notificacao
push, e nao existe sincronizacao inbound (Google -> OctaClin) em nenhuma
parte do codigo. A Fase 108 ja deixava isso registrado como debito tecnico
("importacao inbound do Google Calendar por syncToken").

Esta fase foi desenhada via a skill `brainstorming` em 2026-07-24, com as
seguintes decisoes tomadas diretamente pelo usuario (`octavioomarostica@gmail.com`):

1. **Escopo da conexao**: cada profissional conecta a propria agenda (OAuth
   individual), nao uma conta unica de admin para o tenant inteiro.
2. **Mecanismo de sync**: notificacao push do Google (Calendar API `watch`),
   nao polling puro.
3. **Eventos externos sem relacao com consulta** (ex.: compromissos
   pessoais): viram apenas bloqueio de horario para checagem de conflito, sem
   criar registro de consulta nem expor detalhes do evento pessoal na
   interface.
4. **Consulta do OctaClin editada/cancelada direto no Google**: aplicar
   automaticamente no OctaClin, reaproveitando o fluxo existente de
   remarcacao/cancelamento (incluindo notificacao ao paciente por
   email/WhatsApp quando configurado).
5. **Armazenamento dos bloqueios externos**: local no Postgres (nao consulta
   a API do Google em tempo real a cada tentativa de agendamento).

## Arquitetura

Extensao do modulo `agenda` existente, sem modulo paralelo novo:

- `ServicoGoogleCalendar` (existente): passa a aceitar credenciais por
  profissional (token OAuth), alem do fallback de variavel de ambiente que
  ja existe hoje para compatibilidade com a agenda compartilhada atual.
- `ServicoConexaoGoogleCalendar` (novo): fluxo de autorizacao OAuth (gerar
  URL de consentimento, trocar `code` por tokens no callback, criar/parar o
  canal de watch).
- `ServicoSincronizacaoGoogleCalendar` (novo): processa notificacoes de
  webhook, busca deltas via `syncToken`, aplica mudanca em consulta existente
  ou em bloqueio externo, e roda a reconciliacao diaria de seguranca.
- Fila BullMQ (reaproveitando `criarConexaoRedis()` /
  `octaclin-backend/src/modulos/comunicacoes/aplicacao/configuracao-redis.ts`,
  mesmo padrao ja usado pela fila de notificacoes de comunicacoes) para
  processar cada notificacao de webhook de forma assincrona e reprocessavel.

## Modelo de dados (2 tabelas novas via migration)

- `profissionais_google_conexao`: `tenant_id`, `profissional_id` (unico por
  tenant), `refresh_token_criptografado` (bytea, via
  `CriptografiaDadosSensiveis`, mesmo padrao ja usado para email/nome
  criptografado em outras entidades), `calendar_id`, `escopos_concedidos`,
  `conectado_em`, `desconectado_em` (nullable), `ultimo_sync_token`,
  `canal_watch_id`, `canal_recurso_id`, `canal_expira_em`.
- `agenda_bloqueios_externos`: `tenant_id`, `profissional_id`,
  `google_event_id`, `inicio_em`, `fim_em`, `atualizado_em`. Usado somente
  para checagem de conflito de horario (`validarConflitoHorario` em
  `servico-agenda.ts` passa a consultar tambem esta tabela); nenhum dado
  clinico ou titulo/descricao do evento pessoal e armazenado.
- `consultas` (existente): reaproveita as colunas `google_calendar_id` e
  `google_event_id` que ja existem hoje para o fluxo outbound; nenhuma
  migration necessaria nela. O outbound passa a gravar tambem
  `extendedProperties.private.octaclinConsultaId` no evento criado no Google,
  para que o fluxo inbound consiga identificar de volta qual consulta
  corresponde a um evento alterado.

## Fluxo de conexao (OAuth)

1. Profissional acessa a pagina de Agenda (`octaclin-web/app/agenda/page.tsx`
   -> `painel-agenda.tsx`) e usa um botao "Conectar Google Agenda".
2. Backend gera a URL de autorizacao Google reaproveitando o
   `client_id`/`client_secret` ja configurados no projeto Google Cloud
   (mesmas credenciais do fluxo outbound atual), com escopo
   `https://www.googleapis.com/auth/calendar` (leitura e escrita, necessario
   tanto para o outbound existente quanto para o inbound novo) e um `state`
   assinado contendo `tenantId`+`profissionalId`+nonce para evitar
   CSRF/injecao de state.
3. Endpoint de callback troca o `code` pelo par de tokens, criptografa e
   grava o refresh token na nova tabela, e cria o canal de watch (push
   notification) para a agenda daquele profissional.
4. Frontend passa a mostrar "Conectado" com a data da conexao; erro no
   callback mostra mensagem clara sem expor detalhes tecnicos do OAuth.

## Sincronizacao inbound (push + syncToken)

1. Endpoint webhook `POST /agenda/google/notificacoes` recebe a notificacao
   do Google (sem corpo, so headers `X-Goog-Channel-Id`,
   `X-Goog-Resource-Id`, `X-Goog-Resource-State`).
2. Backend identifica o profissional pelo `canal_watch_id` salvo na conexao e
   enfileira um job de reconciliacao (nao processa a notificacao
   sincronamente na resposta HTTP).
3. O processador busca os eventos alterados via `events.list` com o
   `ultimo_sync_token` salvo. Para cada evento alterado:
   - Se tiver `extendedProperties.private.octaclinConsultaId` -> aplica a
     mudanca (novo horario ou cancelamento) na consulta correspondente via o
     mesmo fluxo ja existente de remarcacao/cancelamento em
     `servico-agenda.ts`, incluindo notificacao ao paciente quando
     configurado.
   - Senao -> cria/atualiza/remove a linha correspondente em
     `agenda_bloqueios_externos`.
4. Salva o `syncToken` retornado pelo Google para a proxima chamada.

## Renovacao de canal e rede de seguranca

Job `@Cron` diario (mesmo padrao ja usado em
`processador-lembretes-agenda.ts`) com duas responsabilidades:

- Renovar canais de watch que expiram nas proximas 48h (Google expira canais
  em ate ~7 dias).
- Rodar uma reconciliacao completa (nao dependente so do `syncToken`) por
  profissional conectado, como rede de seguranca contra notificacao de
  webhook perdida.

## Erros e casos de borda

- Refresh token revogado/expirado pelo profissional no proprio Google:
  proxima chamada falha com erro especifico da API -> conexao marcada como
  `desconectado_em`, some da checagem de conflito, UI mostra "reconectar"
  sem quebrar o restante da agenda.
- Falha ao processar um job de webhook: log estruturado + reprocessamento
  pela mesma fila BullMQ (mesmo padrao de reprocessamento ja usado em
  comunicacoes/outbox).
- Edicao quase simultanea nos dois lados (OctaClin e Google): last-write-wins
  por timestamp; nao havera merge de conflito nesta fase.

## Testes previstos

- Unit `ServicoConexaoGoogleCalendar`: geracao/validacao de `state`, troca de
  `code` por tokens (API do Google mockada, mesmo padrao de
  `servico-google-calendar.spec.ts`).
- Unit `ServicoSincronizacaoGoogleCalendar`: aplicar evento com
  `octaclinConsultaId` (deve chamar o fluxo de remarcacao/cancelamento) e
  aplicar evento sem correspondencia (deve gravar em
  `agenda_bloqueios_externos`), incluindo o caso de token revogado.
- `validarConflitoHorario` (`servico-agenda.spec.ts`): novo caso cobrindo
  conflito contra um bloqueio externo.
- Teste negativo multi-tenant (`tenant-security-reviewer`): garantir que o
  webhook so consegue atualizar consulta/bloqueio do tenant dono do canal,
  nunca de outro tenant.

## Fora de escopo nesta fase

- Multiplas agendas Google por profissional (so a agenda `primary`).
- Edicao de eventos recorrentes (RRULE) como serie; cada instancia e tratada
  isoladamente.
- Importar eventos historicos anteriores ao momento da conexao.
- Desconexao automatica da agenda ao arquivar/demitir um profissional (fica
  registrado como follow-up, nao bloqueia esta fase).

## Criterios de aceite

- Profissional consegue conectar e desconectar a propria Google Agenda pela
  UI.
- Uma consulta criada no OctaClin aparece na Google Agenda do profissional
  conectado (outbound, ja existia) com a marcacao
  `octaclinConsultaId`.
- Uma alteracao de horario ou cancelamento feita direto na Google Agenda
  reflete na consulta correspondente no OctaClin em ate alguns segundos
  (via push), incluindo notificacao ao paciente quando aplicavel.
- Um evento pessoal sem relacao com consulta bloqueia o horario para novos
  agendamentos no OctaClin, sem aparecer como consulta.
- Teste negativo multi-tenant aprovado (webhook nunca atualiza dado de outro
  tenant).
- `pnpm --dir octaclin-backend typecheck`, testes relevantes e
  `pnpm --dir octaclin-backend build` passando.

## Proximos passos

Gerar o plano de implementacao detalhado (skill `writing-plans`) a partir
deste desenho antes de comecar a codificar.
