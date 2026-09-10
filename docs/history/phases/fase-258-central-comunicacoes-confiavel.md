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
   concluido, ver secao abaixo.
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

## Incremento 2 - opt-out no disparo manual, com confirmacao explicita

Concluido em 2026-09-10.

### Decisao de produto (confirmada com o dono do produto)

Quando um profissional tenta enviar mensagem manual para um paciente que
optou por nao receber naquele canal: **avisar e permitir override** — o
profissional ve um aviso explicito e pode confirmar o envio mesmo assim
(ex.: retorno pontual a uma duvida do paciente). Nao e bloqueio
incondicional (automacoes continuam bloqueando silenciosamente, sem
override) nem ausencia de checagem (comportamento anterior).

### Implementacao

- **Backend**: `ServicoComunicacoes.criarMensagemNoEscopo` passa a checar
  `canalAutorizado(preferencias, canal.tipo)` (funcao ja existente em
  `dominio/preferencias-comunicacao.ts`, ate entao so usada pelas
  automacoes) quando `usuario` esta presente (disparo manual,
  `dispararMensagem`) e o canal e `email`/`whatsapp`. Se o paciente optou
  por nao receber, lanca `ConflictException` (409) com mensagem segura,
  a menos que `DispararMensagemDto.ignorarOptOut` seja `true`. Chamadas
  de sistema (`dispararMensagemSistema`, usadas por
  `servico-lembretes-agenda`/`servico-recall-inatividade`) tem
  `usuario` ausente e continuam com sua propria logica de "ignorado" —
  a checagem nova nao duplica nem conflita com ela. Auditoria
  (`controlador-comunicacoes.ts`) registra `ignorouOptOut: boolean`.
- **Frontend**: `ErroApiComunicacoes` passou a ser exportada e a extrair
  a mensagem do corpo JSON do erro (mesmo padrao ja usado em
  `portal-api.ts`, em vez de mostrar o texto cru da resposta). Em
  `painel-comunicacoes.tsx`, um 409 no disparo abre `ModalConfirmacao`
  ("Paciente optou por não receber neste canal") com a mensagem do
  backend; confirmar reenvia com `ignorarOptOut: true`; cancelar so
  fecha o dialogo, sem chamar a API de novo.
- Nova rota nenhuma; campo novo em DTO existente; nenhuma migration
  (a tabela de preferencias/consentimento ja existe desde a Fase 111).

### Validacoes

- TDD: backend — 4 testes novos em `servico-comunicacoes.spec.ts`
  (recusa quando opt-out; permite com `ignorarOptOut`; permite quando o
  canal foi autorizado; disparo de sistema ignora a checagem) confirmados
  RED (neutralizando so o `throw` interno, preservando o contexto de
  narrowing do TypeScript — a primeira tentativa de RED com `if (false)`
  direto quebrou o narrowing do compilador e gerou erros de tipo
  espurios, corrigido usando `&& false` dentro da condicao interna em vez
  de substituir o `if` externo). Controller — 1 teste novo garantindo
  `ignorouOptOut: true` na auditoria quando confirmado.
  Frontend — 3 testes Playwright novos
  (`tests/visual/comunicacoes-disparo-manual.spec.mjs`): exige
  confirmacao e permite confirmar; cancelar nao envia; paciente que
  autorizou o canal nunca aciona o dialogo. Confirmado RED (desabilitando
  o tratamento do 409 no componente) antes de restaurar GREEN.
- `pnpm --dir octaclin-backend typecheck` e `build` — PASS
- `pnpm --dir octaclin-web typecheck`, `lint` (0 erros) e `build` — PASS
- 297 testes backend (`comunicacoes`+`automacoes`+migrations) — PASS
  (1 suite de integracao SKIPPED, mesma limitacao de ambiente)
- 6/6 Playwright novos (desktop+mobile) + regressao de
  `console-regression.spec.mjs`/`fase-196-comunicacoes-equipe.spec.mjs`
  sem quebra
- Gate de linguagem, `pnpm security:secrets`, `git diff --check` — PASS

### CI vermelho apos o push do Incremento 2, ja corrigido

O job "Governanca de repositorio" reprovou em `pnpm test:redacao-auditoria`:
a chave nova `ignorouOptOut` (gravada na auditoria de
`ControladorComunicacoes.dispararMensagem`) nao estava coberta pelo redator
nem declarada em `CHAVES_SEGURAS`. Corrigido adicionando a chave a
`CHAVES_SEGURAS` em `scripts/validar-redacao-auditoria.mjs`, com
justificativa escrita: e um booleano de desfecho de decisao humana (o
profissional confirmou o override do aviso de opt-out), nao carrega a
preferencia do paciente. `pnpm test:redacao-auditoria` local — 24/24 PASS
apos a correcao.

## Incremento 3 - status de entrega do WhatsApp como coluna de primeira classe

Concluido em 2026-09-10.

### Implementacao

- **Migration** `1720000001041-AdicionarStatusEntregaWhatsapp`: aditiva,
  adiciona `status_entrega_whatsapp varchar(20)` e
  `status_entrega_atualizado_em timestamptz` a `mensagens_notificacao`,
  ambas nulaveis. `down` remove as duas. `@aplicacao fora-de-banda` como
  as demais.
- **Backend**: `MensagemNotificacaoOrm` ganha os dois campos.
  `ServicoWebhookWhatsapp.registrarStatusNoTenant` passa a gravar
  `statusEntregaWhatsapp` (sent/delivered/read/failed, vocabulario da
  Meta) e `statusEntregaAtualizadoEm` (do `timestamp` do webhook, ou o
  instante do processamento quando a Meta nao informa) direto nas
  colunas, alem de continuar gravando `payload.ultimoStatusMeta` (que
  guarda tambem `recipientId` e `errors`, uteis como detalhe mas nao
  como filtro). O JSON deixa de ser a unica fonte da consulta mais comum
  (qual o status de entrega desta mensagem), que agora e uma coluna SQL
  comum — habilita filtro/relatorio futuro sem parse de JSON.
- **Frontend**: `MensagemNotificacaoApi` ganha `statusEntregaWhatsapp` e
  `statusEntregaAtualizadoEm`. `painel-comunicacoes.tsx` le a coluna
  nova como fonte primaria dos dois badges de status Meta ("Entrega:" na
  conversa, "Meta:" na lista de mensagens recentes), com fallback para o
  JSON legado (`payload.ultimoStatusMeta.status`) so em mensagens
  gravadas antes desta migration — nao ha backfill, e mensagens antigas
  continuam exibindo o status correto pelo caminho antigo.
- Sem mudanca de contrato de leitura para chamadores existentes: os
  dois campos novos sao opcionais: consumidor antigo que ignora o campo
  continua funcionando; mensagem antiga sem o campo cai no fallback.

### Validacoes

- TDD: migration (`1720000001041...spec.ts`, RED confirmado por ausencia
  do arquivo de implementacao, depois GREEN); backend — 2 testes novos
  em `servico-webhook-whatsapp.spec.ts` (grava as colunas a partir do
  timestamp da Meta; usa o instante do processamento quando a Meta nao
  informa timestamp), RED confirmado antes da implementacao (assercoes
  novas falhando com o valor `undefined` esperado, sem alterar o
  servico).
- `pnpm --dir octaclin-backend typecheck` e `build` — PASS
- `pnpm --dir octaclin-web typecheck`, `lint` (0 erros, mesmos avisos
  preexistentes de outros arquivos) e `build` — PASS
- 253 testes de `comunicacoes` + migrations (241 passaram, 12 skipped —
  mesma suite de integracao com banco real das fases anteriores) — PASS
- 10/10 Playwright (`comunicacoes-disparo-manual.spec.mjs` +
  `fase-196-comunicacoes-equipe.spec.mjs`, desktop+mobile) sem
  regressao — os badges de status continuam corretos com o novo caminho
  de leitura
- Gate de linguagem, `pnpm test:redacao-auditoria` (nenhuma chave nova
  de auditoria nesta rodada), `pnpm security:secrets`, `git diff --check`
  — PASS
