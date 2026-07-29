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

Esta fase nao foi aplicada ao banco de producao nem enviada a `main`.
Quando for aprovada e implantada, canais criados antes desta fase deixam de
aceitar notificacoes imediatamente e ficam marcados para renovacao no proximo
ciclo do cron. A renovacao preserva a conexao OAuth e cria o novo watch no
Google; valide pelo menos uma conta Google conectada apos o deploy.

## Validacoes

- 29 testes focados de controlador, sincronizacao, renovacao, desconexao e
  registro de migration.
- `pnpm --dir octaclin-backend typecheck`.

## Pendencia de deploy

Executar somente apos revisao/merge: migration, health check, conexao Google
de teste e verificacao de notificacao recebida para um canal renovado.
