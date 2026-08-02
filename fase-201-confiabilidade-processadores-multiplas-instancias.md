# Fase 201 - Confiabilidade dos processadores em multiplas instancias

Status: implementacao concluida localmente em 2026-08-02; rollout de producao
pendente da criacao do servico worker no Render.

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

- Backend: 76 suites e 425 testes aprovados.
- Typecheck do backend aprovado.
- Testes novos cobrem exclusao transacional e dois workers concorrentes vendo
  o mesmo evento de outbox, com uma unica publicacao.

## Limite conhecido

O contrato e de no maximo um efeito para concorrencia normal. Nenhum provedor
SMTP/Meta/Gmail oferece transacao atomica com o banco; uma falha de processo
depois de o provedor aceitar a mensagem e antes de persistir o retorno exige
revisao manual, em vez de retentativa automatica que possa duplicar envio.
