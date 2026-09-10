# Fase 258 - Central de comunicações confiável

Status: em andamento, iniciada em 2026-09-10.

## Objetivo (roadmap)

`CHECKLIST_FASES_FUTURAS_PRODUCAO.md`: unificar conversas por paciente,
canal, responsavel e pendencia; exibir envio, entrega, leitura, falha,
retentativa e origem da mensagem. Validar Gmail e WhatsApp com templates,
idempotencia, consentimento, opt-out e degradacao segura quando a
integracao estiver indisponivel.

## Auditoria do estado atual (antes de qualquer mudanca)

Modulo `comunicacoes` ja tem bastante infraestrutura solida:

- **Dados**: tabela unica `mensagens_notificacao` (envio/recebimento/nota),
  `canais_notificacao` (whatsapp/email/push — push so tem adaptador
  placeholder), `templates_mensagem` (aprovacao obrigatoria so para
  WhatsApp). Conteudo sensivel cifrado (`conteudoCriptografado`) com
  allowlist de campos em claro documentada em `dominio/conteudo-mensagem.ts`.
- **Envio**: `ServicoComunicacoes.dispararMensagem` cria a mensagem +
  evento outbox na mesma transacao; `ProcessadorNotificacoes` (BullMQ) ou
  `ProcessadorOutboxComunicacoes` (cron 30s, fallback sincrono se a fila
  cair) processam o envio via `AdaptadorEmailSmtp`
  (SMTP ou Gmail API real, selecionavel por `EMAIL_PROVEDOR`) ou
  `AdaptadorWhatsAppMeta` (Graph API). Falha marca `status='falhou'` +
  notifica in-app; retry automatico (3x fila, 5x outbox).
- **Webhook WhatsApp**: bem endurecido — verificacao de assinatura,
  fail-closed sem app secret, dedupe atomico de reentrega, limite de
  tamanho, logs redigidos (nunca phoneNumberId/assinatura/erro do
  provider). Confirmado por `controlador-webhook-whatsapp.spec.ts`.
- **Preferencias/opt-out**: `dominio/preferencias-comunicacao.ts` existe
  (canal permitido, janela de horario) mas so e checado pelos fluxos de
  automacao (`servico-lembretes-agenda.ts`,
  `servico-recall-inatividade.ts`) — nunca no disparo manual
  (`ServicoComunicacoes.dispararMensagem`/`ControladorComunicacoes`).

### Gaps identificados frente aos dois objetivos da fase

1. **Sem chave de idempotencia no disparo manual**: um duplo clique ou
   retry de HTTP em `dispararMensagem` cria uma nova
   `MensagemNotificacaoOrm` e um novo evento outbox — envio duplicado
   possivel em email e WhatsApp.
2. **Opt-out nao aplicado no disparo manual**: um profissional pode
   mandar mensagem manual para um paciente que optou por nao receber
   naquele canal; so as automacoes respeitam isso hoje. Gap direto de
   "consentimento e opt-out" do roadmap — mas o comportamento correto
   (bloquear sempre? avisar e permitir override para comunicacao
   assistencial pontual?) e decisao de produto, nao so tecnica.
3. **Sem visao unificada cruzando canal**: `painel-comunicacoes.tsx`
   agrupa conversas so para WhatsApp; e-mail fica em lista plana
   separada, sem status de entrega/leitura. Nao ha filtro por
   "responsavel" (profissional).
4. **Status de entrega do WhatsApp preso em JSON aninhado**
   (`payload.ultimoStatusMeta`), nao e coluna de primeira classe.
5. **Sem taxonomia de "origem da mensagem"** (manual vs. automatico vs.
   iniciado pelo paciente) alem de campos livres (`payload.evento`).
6. E-mail nao tem gate de aprovacao de template equivalente ao do
   WhatsApp.

## Plano de incrementos verticais

1. **Idempotencia no disparo manual/sistema de mensagens.** Chave
   opcional `chaveIdempotencia` em `DispararMensagemDto`; coluna +
   indice unico parcial `(tenant_id, chave_idempotencia)`; replay
   retorna a mensagem existente em vez de duplicar envio. Sem decisao de
   produto pendente — puramente tecnico.
2. **Opt-out no disparo manual** — bloqueado aguardando decisao de
   produto sobre a politica exata (ver pergunta feita ao dono do
   produto).
3. **Status de entrega WhatsApp como coluna de primeira classe** —
   candidato, ainda nao iniciado.
4. **Visao unificada cruzando canal + responsavel** — candidato, maior
   escopo (redesenho de `painel-comunicacoes.tsx`), ainda nao iniciado.

Este documento e atualizado a cada incremento com o que foi entregue,
arquivos tocados e validacoes.

## Incremento 1 - idempotencia no disparo de mensagens

Concluido em 2026-09-10 (escopo backend).

- TDD: 5 testes adicionados primeiro em `servico-comunicacoes.spec.ts`
  (grava a chave na mensagem; replay retorna a mensagem existente sem
  criar nova; chamadas sem chave continuam criando mensagens distintas;
  absorve conflito de indice unico sob concorrencia devolvendo a mensagem
  vencedora; propaga erros de gravacao que nao sao conflito de
  idempotencia). Confirmado RED (revertendo o wrapper de idempotencia
  para o `dispararMensagemNoEscopo` antigo) antes de restaurar GREEN.
- **Migration** `1720000001040-AdicionarIdempotenciaMensagensNotificacao`:
  aditiva, adiciona `chave_idempotencia varchar(200)` a
  `mensagens_notificacao` e um indice unico parcial
  `(tenant_id, chave_idempotencia) WHERE chave_idempotencia IS NOT NULL`.
  `down` remove ambos. `@aplicacao fora-de-banda` como as demais.
- **Backend**: `DispararMensagemDto.chaveIdempotencia` (opcional, ate 200
  chars). `ServicoComunicacoes.dispararMensagemNoEscopo` faz uma checagem
  previa (retorna a mensagem existente se a chave ja foi usada) e, sob
  concorrencia, absorve o erro 23505 do indice unico e devolve a mensagem
  que venceu a corrida — mesmo padrao ja usado em
  `ServicoAgenda.criarConsulta`/`ServicoPacientes.criar` para referencia
  externa (`ehConflitoReferenciaExterna`). Chamadores que nao informam a
  chave mantem o comportamento antigo (sempre criam), preservando
  retrocompatibilidade total.
- **Decisao deliberada de escopo — o que NAO foi feito nesta rodada**:
  nenhum chamador (console de disparo manual, `servico-lembretes-agenda`,
  `servico-recall-inatividade`) foi alterado para de fato enviar
  `chaveIdempotencia` ainda. Motivos:
  - No console manual, o botao de envio ja fica desabilitado durante o
    disparo (`disabled={salvando}`), cobrindo o duplo-clique comum. O
    fluxo de "tentar novamente" apos falha
    (`prepararRespostaWhatsapp` com `mensagemFalha`) precisa gerar uma
    chave **nova** a cada tentativa explicita — reutilizar a mesma chave
    faria o retry devolver a mensagem falha antiga sem reenviar, quebrando
    a UX de retry que ja existe. Fazer essa distincao direito (nova
    tentativa vs. duplo-envio acidental do mesmo clique) e decisao de UX
    que merece seu proprio incremento, nao um ajuste apressado.
  - Nas automacoes, `lembreteJaProcessado()` ja guarda um flag por
    consulta que evita reprocessar o mesmo lembrete; uma chave de
    idempotencia adicionaria defesa so na janela estreita de corrida
    entre execucoes concorrentes do cron, beneficio real mas menor que o
    gap de opt-out (Incremento 2).
  - A capacidade no backend fica pronta e testada para qualquer chamador
    futuro adotar.
- Validacoes:
  - `pnpm --dir octaclin-backend typecheck` — PASS
  - `pnpm --dir octaclin-backend build` — PASS
  - Testes: 245 testes de `modulos/comunicacoes` +
    `infraestrutura/banco-dados` (migrations) — PASS (49/50 suites; 1
    suite de integracao com banco real SKIPPED, mesma limitacao de
    ambiente das fases anteriores)
  - `pnpm security:secrets` e `git diff --check` — PASS
