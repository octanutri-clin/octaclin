# Fase 155 - RLS dos canais de watch Google Calendar

## Objetivo

Aplicar isolamento por tenant tambem a `google_canais_watch`, sem voltar a
consultar globalmente a tabela quando o Google chamar o webhook.

## Entrega

- O identificador de cada novo canal passou a carregar um `tenantId` UUID no
  formato `octaclin-gcal:<tenantId>:<uuid>`.
- O controlador extrai o tenant apenas desse formato, abre o contexto com
  `ExecutorTenant` e so entao busca o canal e valida o token em tempo
  constante.
- A fila leva tambem o `tenantId`; o worker repete a leitura dentro do mesmo
  escopo RLS antes de reconciliar a agenda.
- Criacao, renovacao e desconexao persistem ou removem o canal somente por
  gerenciadores que receberam o contexto do tenant.
- A migration `1720000001005` habilita e forca RLS em
  `google_canais_watch`, cria a policy padrao do projeto e expira canais
  legados para que o cron os renove no novo formato.

## Transicao operacional

Publicada na `main` e no backend de producao em 2026-07-29. A base operacional
estava com as migrations do Google Calendar pendentes; as cinco migrations da
cadeia `1720000000800` a `1720000001005` foram executadas pelo proprietario do
Neon no banco usado pelo backend. O papel de aplicacao confirmou
`row_security = on`, sem leitura de canais sem contexto de tenant.

Canais criados antes desta fase deixam de aceitar notificacoes imediatamente e
ficam marcados para renovacao no proximo ciclo do cron. A renovacao preserva a
conexao OAuth e cria o novo watch no Google; valide pelo menos uma conta Google
conectada apos o deploy.

## Validacoes

- 29 testes focados de controlador, sincronizacao, renovacao, desconexao e
  registro de migration.
- `pnpm --dir octaclin-backend typecheck` e `build`.
- Deploy Render do commit `077c380`, health `200` e login invalido `401`.
- Banco operacional: cinco migrations registradas, RLS e `FORCE RLS` ativos,
  uma policy de tenant em `google_canais_watch`.

## Pendencia funcional

Validar uma conexao Google Calendar real apos a renovacao do primeiro canal no
novo formato.
