# Fase 136 - Sincronizacao em tempo real com a Google Agenda pessoal do profissional

Status: concluida em 2026-07-25, com uma segunda onda de correcao fechada em
2026-07-26 (implementada via `superpowers:subagent-driven-development`, planos
em `docs/superpowers/plans/2026-07-25-fase-136-google-calendar-sync.md` e
`docs/superpowers/plans/2026-07-26-fase-136-fix-wave-revisao-final.md`).

## Entregue

- Migration `1720000000800-CriarSincronizacaoGoogleAgenda` (3 tabelas:
  `profissionais_google_conexao` e `agenda_bloqueios_externos` com RLS,
  `google_canais_watch` sem RLS de proposito - ver "Refinamento de design"
  abaixo) e as entidades TypeORM correspondentes.
- `ServicoGoogleCalendar` estendido: credenciais por profissional,
  `extendedProperties.private.octaclinConsultaId`, leitura de eventos
  alterados (`listarEventosAlterados`), canal de watch
  (`criarCanalWatch`/`pararCanalWatch`).
- `ServicoConexaoGoogleCalendar`: fluxo OAuth completo (URL de autorizacao,
  `state` assinado com HMAC e validado com `timingSafeEqual`, troca de
  codigo por refresh token criptografado, desconexao).
- `ServicoAgenda` refatorado: `remarcarConsulta`/`cancelarConsulta` divididos
  em entrada HTTP + nucleo privado, com novas entradas
  `remarcarConsultaComoSistema`/`cancelarConsultaComoSistema` para o
  processador de sincronizacao; `criarConsulta`/remarcar/cancelar agora
  resolvem e usam a credencial do profissional conectado (corrigido durante
  a revisao de seguranca, ver abaixo); checagem de conflito de horario
  estendida para `agenda_bloqueios_externos`.
- `ServicoSincronizacaoGoogleCalendar` + fila BullMQ + processador: aplica
  eventos alterados do Google como atualizacao/cancelamento de consulta
  (quando marcados com `octaclinConsultaId`) ou como bloqueio de horario
  (quando nao relacionados a nenhuma consulta).
- `ControladorGoogleAgenda`: endpoints `conectar`/`callback`/`desconectar`/
  `status` (autenticados, restritos a `Professional`) e `notificacoes`
  (webhook publico do Google, sem guard, so enfileira o processamento).
- `ProcessadorRenovacaoGoogleCalendar`: job `@Cron` diario que renova canais
  perto de expirar e roda reconciliacao de seguranca por profissional
  conectado.
- Frontend: rotas BFF (`status`/`desconectar`/`conectar`), funcoes em
  `lib/agenda-api.ts` e botao "Conectar/Desconectar Google Agenda" no painel
  de agenda.

## Refinamento de design (durante o planejamento)

O design aprovado previa 2 tabelas novas. Ao planejar o webhook, ficou claro
que o backend precisa descobrir qual tenant e dono de um canal *antes* de
poder rodar qualquer query com RLS (que exige `app.tenant_id` ja definido).
Solucao: uma terceira tabela `google_canais_watch`, sem RLS, guardando so o
mapeamento `canal_watch_id -> tenant_id/profissional_id` (nenhum dado
sensivel) - mesmo principio ja usado por `tenants` (tabela global, sem RLS,
usada pra descobrir o tenant antes de escopar o resto).

## Achados da revisao de seguranca multi-tenant (`tenant-security-reviewer`)

A revisao final encontrou e corrigiu (commit `7762537`, antes do fechamento
da fase):

- **CRITICAL**: o caminho de escrita (`criarConsulta`/remarcar/cancelar)
  nunca resolvia a credencial do profissional conectado, entao toda consulta
  continuava sendo sincronizada com a agenda compartilhada via variavel de
  ambiente, nunca com a agenda pessoal do profissional. Corrigido.
- **IMPORTANT**: o cron de renovacao acessava `profissionais_google_conexao`
  (tabela com RLS) direto via `DataSource`, fora de `ExecutorTenant.executar`
  - em Postgres real isso retornaria zero linhas sempre, silenciosamente.
  Corrigido para seguir o mesmo padrao de `processador-lembretes-agenda.ts`
  (buscar tenants primeiro, depois escopar por tenant).
- Teste negativo cross-tenant/cross-profissional adicionado para
  `remarcarConsultaComoSistema`/`cancelarConsultaComoSistema`.
- Ambos os fixes foram re-verificados por uma segunda rodada do
  `tenant-security-reviewer` contra o diff da correcao, com resultado limpo.

Pendencias menores registradas nesta rodada (a do 401 no `conectar` e a do
`state` OAuth foram corrigidas na segunda onda, ver secao abaixo):
`desconectar()` nao limpa a linha correspondente em `google_canais_watch` nem
chama `pararCanalWatch` (nao e vazamento, so sobra de dado) - segue como
follow-up nao bloqueante.

## Segunda onda de correcao - revisao final do branch inteiro (2026-07-26)

Depois do fechamento acima, uma revisao final de todo o branch (modelo mais
capaz, template `requesting-code-review`) encontrou **2 Critical + 7
Important** que as revisoes por tarefa/seguranca anteriores nao pegaram.
Corrigidas de uma vez via plano formal
(`docs/superpowers/plans/2026-07-26-fase-136-fix-wave-revisao-final.md`,
6 tarefas, `superpowers:subagent-driven-development`):

- **CRITICAL**: `GET /agenda/google/conectar` sempre retornava 401 em
  producao - o BFF redirecionava o navegador direto pro backend, sem passar
  pelo `requisitarBackendAutenticado` que os outros BFFs usam pra injetar o
  header `Authorization` do lado do servidor. Corrigido: o backend agora
  devolve a URL de autorizacao como JSON, e o BFF busca essa URL de forma
  autenticada antes de redirecionar o navegador pro Google.
- **CRITICAL**: resposta `410` do Google (syncToken expirado, ocorrencia
  rotineira) nao era tratada, quebrando a sincronizacao inbound daquele
  profissional silenciosa e permanentemente. Corrigido: `410` agora limpa o
  syncToken salvo e refaz a sincronizacao completa.
- **IMPORTANT**: paginacao (`nextPageToken`) nunca era seguida, perdendo
  eventos alem da primeira pagina e nunca capturando o `nextSyncToken` (que o
  Google so retorna na ultima pagina). Corrigido.
- **IMPORTANT**: o syncToken avancava mesmo quando algum evento do lote falhava
  ao ser aplicado, perdendo aquele evento pra sempre. Corrigido: token so
  avanca quando o lote inteiro tem sucesso; em falha continua, uma
  retentativa limitada (5 tentativas consecutivas) evita bloqueio permanente.
- **IMPORTANT**: token revogado pelo profissional no Google (`invalid_grant`)
  nunca marcava `desconectado_em`. Corrigido no fluxo de reconciliacao.
- **IMPORTANT**: `ServicoOperacoes.executarSincronizacaoGoogle` (reprocessamento
  operacional) era um segundo chamador do Google Calendar que nunca resolvia
  a credencial do profissional - mesma classe de bug do CRITICAL ja corrigido
  em `ServicoAgenda`. Corrigido.
- **IMPORTANT**: checagem de conflito contra `agenda_bloqueios_externos`
  carregava ate 500 linhas em memoria sem filtro de tempo. Corrigido: query
  agora expressa a sobreposicao de horario direto no SQL (`LessThan`/
  `MoreThan`), sem limite artificial.
- **IMPORTANT**: webhook `POST /agenda/google/notificacoes` aceitava qualquer
  POST com o header de canal, sem verificar se veio do Google, sem dedupe e
  sem limite de retencao de jobs. Corrigido: token anti-forjadura por canal
  (verificado com `timingSafeEqual`), `jobId` baseado no numero da mensagem
  do Google para dedupe, e `removeOnComplete`/`removeOnFail` na fila.
- **IMPORTANT**: `state` OAuth nao expirava e o nonce nunca era checado,
  permitindo replay indefinido (CSRF/account-linking). Corrigido: `state`
  agora expira em 10 minutos e o nonce e consumido uma unica vez via Redis
  (`SET ... NX`), mesmo padrao ja usado pelo rate limiting de login.

A revisao final do branch (apos essas 6 tarefas) encontrou mais 3 Important
de segunda ordem, tambem corrigidos na mesma onda antes de fechar:

- Um evento com falha permanente travava o syncToken pra sempre (retentativa
  sem limite) - corrigido com o contador de 5 falhas consecutivas acima.
- Canais de watch criados antes do token anti-forjadura ficavam com
  `token = null` e tinham as notificacoes silenciosamente descartadas ate o
  cron diario recriar o canal (ate ~1 semana) - corrigido com log de aviso
  imediato e uma migration que forca a renovacao no proximo ciclo do cron.
- `ServicoOperacoes.reprocessarGoogleCalendar` mantinha uma transacao aberta
  durante a chamada HTTP ao Google - corrigido dividindo em leitura, chamada
  ao Google fora de transacao, e escrita, igual ao padrao ja usado em
  `ServicoAgenda`.

Pendencias menores registradas nesta segunda onda (nao bloqueiam, ficam pra
follow-up): token revogado no fluxo outbound ainda so aparece como falha
generica (autocura via cron diario em ate 24h); resync apos `410` reimporta
o historico completo como bloqueios externos (idempotente); sem teste de
controller para a logica anti-forjadura do webhook (este projeto nao testa
controllers/route handlers, so a camada de servico).

## Validacoes rodadas ao fechar

```powershell
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend test --runInBand   # 46 suites / 234 testes (apos a segunda onda)
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
npm run security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Passo manual pendente (fora do repositorio)

Antes desta sincronizacao funcionar de ponta a ponta em producao, e preciso
adicionar a URL de callback (`<url-do-backend>/agenda/google/callback`) na
lista de redirect URIs autorizados do OAuth client no Google Cloud Console -
isso nao pode ser feito via commit.

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
