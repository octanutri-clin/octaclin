# Fase 201 - Confiabilidade dos processadores em multiplas instancias

Status: implementacao concluida em 2026-08-02 e completada em 2026-08-19, apos
auditoria que achou um furo aberto depois daquela data. Rollout de producao
segue pendente da criacao do servico worker no Render, que e a unica etapa
restante.

## Entregue

- A aplicacao possui um unico bootstrap BullMQ/Schedule, em vez de configurar
  Redis por modulo.
- `OCTACLIN_PROCESSO` define o papel do processo:
  - `web`: HTTP, BFF e webhooks; nao registra consumidores BullMQ nem cron.
  - `worker`: consumidores BullMQ e cron; nao abre porta HTTP.
  - `all`: compatibilidade para desenvolvimento local e para o deploy atual
    ate o rollout controlado.
- Em producao, qualquer processo que execute consumidores exige Redis
  configurado; uma configuracao incompleta falha no startup.
- Comunicacoes criadas por agenda, lembretes, inbox e reprocessamento sao
  enfileiradas. A resposta registra `pendente` ate o provedor confirmar o
  envio, sem declarar envio antes do efeito externo.
- A mensagem e reivindicada por update condicional persistente antes do
  adaptador SMTP/Gmail/Meta. Duas instancias que recebem o mesmo job produzem
  no maximo uma chamada externa.
- O outbox e execucoes de automacao tambem usam reivindicacao condicional
  persistente antes de publicar/processar.
- Sincronizacao e renovacao do Google Calendar usam trava transacional por
  profissional, evitando reconcilacao e renovacao concorrentes entre workers.

## Auditoria de 2026-08-19 e a trava de rodada

Antes de executar o rollout, auditei os processadores criados **depois** de
2026-08-02, quando o codigo desta fase ficou pronto. Dois nasceram depois:
`processador-webhooks.ts` (2026-08-08, Fase 218) e
`processador-recall-inatividade.ts` (2026-08-03, Fase 205).

O de webhooks respeita o padrao: reivindica a entrega por update condicional de
`pendente` para `processando`, com verificacao de `affected`, antes do POST.

O de recall **nao**, e o furo era real. Ele le os candidatos, envia e so entao
registra a execucao. O teto de frequencia por paciente sai de uma leitura que
nao e atomica com a escrita, entao duas instancias no mesmo `@Cron('0 9 * * *')`
seriam ambas autorizadas a enviar. Cada mensagem viraria uma linha propria de
comunicacao, legitimamente reivindicada uma vez pelo outbox — ou seja, a
protecao existente nao pegaria: o paciente receberia o recall duas vezes. O
rollout do worker, como documentado abaixo, entregaria essa duplicacao.

A correcao vive no `executarPorTenantAtivo`, por onde passam os seis
processadores agendados, e nao em cada um: uma trava por `(rotulo, tenant)`
antes de entrar no tenant, liberada no `finally`. Advisory lock do Postgres, e
nao tabela nova, porque a garantia e de rodada e nao de dado, e nao justifica
uma migration com DDL em producao; a trava vive na sessao de um QueryRunner
dedicado e cai sozinha se o processo morrer no meio da rodada.

Commit: `6f7f5b2`. Testes cobrem tenant pulado quando outra instancia segura a
trava, liberacao mesmo com falha da operacao, e chaves distintas por rodada.

## Rollout Render obrigatorio

1. No servico atual `octaclin-backend-producao`, adicionar
   `OCTACLIN_PROCESSO=web` e fazer deploy. Nao aumentar o numero de instancias
   antes desta etapa.
2. Criar um novo `Background Worker` no mesmo projeto Render, a partir do
   mesmo repositorio e branch `main`.
3. Configurar no worker o mesmo `Root Directory`, build e ambiente do backend,
   com inicio `pnpm --dir octaclin-backend start` e
   `OCTACLIN_PROCESSO=worker`.
4. Copiar apenas as variaveis de backend necessarias ao worker: banco runtime,
   Redis, criptografia, Gmail/SMTP, Meta, Google Calendar e URLs publicas.
   Nao criar uma segunda URL publica nem configurar CORS no worker.
5. Fazer deploy do worker e confirmar nos logs que consumidores e cron foram
   iniciados sem erro de Redis. O worker nao deve expor endpoint HTTP.
6. Com dados sinteticos, disparar uma notificacao e verificar uma unica
   entrega, uma transicao de outbox para `processado` e ausencia de envio
   duplicado. Repetir com webhook Google ou renovacao agendada.
7. Somente apos essa evidencia, marcar a Fase 201 como concluida e liberar
   escala horizontal do servico `web`.

## Validacao local

Em 2026-08-02, quando o codigo original ficou pronto:

- Backend: 76 suites e 425 testes aprovados.
- Typecheck do backend aprovado.
- Testes novos cobrem exclusao transacional e dois workers concorrentes vendo
  o mesmo evento de outbox, com uma unica publicacao.

Em 2026-08-19, com a trava de rodada:

- Backend: 139 suites e **964 de 965 testes**, sendo a unica falha o
  `catalogo-taco.spec.ts`, conhecida de checkout Windows por CRLF e verde no CI.
- Typecheck e build do backend aprovados.

## Limite conhecido

O contrato e de no maximo um efeito para concorrencia normal. Nenhum provedor
SMTP/Meta/Gmail oferece transacao atomica com o banco; uma falha de processo
depois de o provedor aceitar a mensagem e antes de persistir o retorno exige
revisao manual, em vez de retentativa automatica que possa duplicar envio.
