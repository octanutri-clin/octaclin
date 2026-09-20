# Plano da Fase 267 - gatilhos reais das automacoes (PB-03)

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-20, depois do fechamento da Fase 266 (PB-02, PR `#272`,
merge `716e38e`) e da leitura de
`docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md` e
`CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.

A Onda 2 do audit exige a ordem `PB-01 -> PB-02 -> PB-03 -> PB-05`. Com o
executor de acoes concluido na Fase 266, a Fase 267 liga os gatilhos reais
(PB-03) antes do alerta de baixa adesao (PB-05). Dos tres gatilhos orfaos
identificados no audit (`checkin.atrasado`, `questionario.respondido`,
`paciente.risco_alto`), a ordem de implementacao e:

1. **267.1 - `questionario.respondido`**: menor superficie (evento sincrono e
   unico, sem job periodico), serve de fundacao duravel para os proximos dois.
2. **267.2 - `paciente.risco_alto`**: depende do score de risco da Fase 265
   (ja concluida) e do evento que o recalcula.
3. **267.3 - `checkin.atrasado`**: depende de uma rodada periodica que ainda
   nao existe (equivalente a um `@Cron` de varredura), por isso vem por
   ultimo.

O PR 55 continua pendente e adiado pelo proprietario. O PR 56 continua
condicionado a uma decisao explicita de distribuir o Mobile. Nenhum dos dois
e afetado por esta fase.

## 2. Problema observado

A tela de Automacoes oferece quatro gatilhos, mas somente `paciente.inativo`
(recall especializado) chegava a disparar algo de fato. Uma regra criada com
`checkin.atrasado`, `questionario.respondido` ou `paciente.risco_alto` ficava
"ativa" sem que nenhum evento do produto jamais a avaliasse: o unico caminho
para avalia-la era a chamada manual `POST /automacoes/avaliacoes`, usada hoje
apenas por simulacao. A automacao "ativa" nao fazia nada — exatamente a
vitrine descrita na secao 5.2 do audit.

Alem disso, o contrato de `gatilho` na regra era um `Record<string, unknown>`
livre: a criacao aceitava qualquer objeto com qualquer campo, sem fechamento
de vocabulario, ao contrario do contrato de `acoes` (fechado desde a Fase
266.1).

## 3. Sequencia aprovada

1. **267.1 - fundacao duravel + `questionario.respondido`** [CONCLUIDO]
   - fechar o contrato de `gatilho` numa uniao discriminada de dominio,
     preservando o contrato especializado de `paciente.inativo`;
   - criar a fundacao de disparo reutilizavel pelos incrementos seguintes:
     seleciona regras ativas do tenant e do profissional responsavel pelo
     paciente, cria a execucao e o evento de outbox na mesma transacao do
     fato de origem, com identidade deterministica para retry sem duplicar;
   - conectar `finalizarFormularioPaciente` a essa fundacao, com condicoes
     vazias (o proprio evento e o filtro) e contexto contendo somente IDs
     opacos, nunca resposta de formulario.
   - integrado nesta branch; ver secao 8 para evidencia local.
2. **267.2 - `paciente.risco_alto`** [PENDENTE]
   - liga o evento de recalculo de prioridade/risco (Fase 265) a fundacao de
     disparo da 267.1;
   - decisao de produto a confirmar antes de codigo: disparar a cada
     recalculo que cruzar o limiar de risco alto, ou somente na transicao de
     faixa (evitar re-disparo diario para quem permanece em risco alto).
3. **267.3 - `checkin.atrasado`** [PENDENTE]
   - exige uma rodada periodica (equivalente a um `@Cron`) que ainda nao
     existe para este sinal; depende de decisao de produto sobre a janela de
     atraso e o teto de disparo por paciente, no mesmo espirito do recall de
     inatividade.

### Observacao de revisao (267.1)

A revisao de isolamento por tenant/profissional da 267.1 nao encontrou
vazamento cross-tenant nem cross-profissional. Ela apontou um item fora do
escopo de tenancy: `dispararGatilhoAutomacao` nao exclui paciente arquivado
ou com ciclo de vida `ARCHIVED`/`RETENTION_HELD`/`DELETION_PENDING`/`DELETED`
da busca de regras. O mesmo vale hoje para os efeitos ja existentes da Fase
266 (`DespachanteAcoesAutomacao` tambem busca paciente sem esse filtro) — nao
e uma regressao desta fase, e uma lacuna de produto pre-existente sobre o que
"arquivar" um paciente deveria impedir. Fica registrado como decisao de
produto pendente para uma fase futura de hardening do motor de automacoes,
sem bloquear a 267.1.

## 4. Invariantes da fundacao (267.1, reutilizadas pela 267.2 e 267.3)

- O disparo so considera regras `ativa = true` do mesmo tenant do evento de
  origem e do profissional responsavel pelo paciente (`pacientes.profissional_responsavel_id`).
  Paciente sem profissional responsavel nao dispara nada.
- A execucao e o evento de outbox sao criados dentro da MESMA transacao do
  fato que originou o gatilho (`gerenciador` do chamador, nao uma transacao
  nova). Uma escrita de origem que sofre rollback nunca deixa um disparo
  orfao.
- `execucaoId`, `outboxId` e o `jobId` do BullMQ sao deterministicos a partir
  de `(regraId, tipo de origem, id de origem)`. O insert usa `orIgnore` sobre
  a chave primaria: reprocessar o mesmo evento de origem (replay de request,
  retry de outbox) nunca cria uma segunda execucao nem uma segunda acao.
- A publicacao na fila de automacoes e responsabilidade exclusiva do outbox
  (`ProcessadorOutboxGatilhosAutomacao`, tipo proprio
  `automacao.gatilho.disparar`). Nao ha caminho de publicacao imediata fora
  do outbox: uma falha de fila apos o commit e sempre retomada pela rodada
  seguinte do outbox, nunca perdida.
- O payload duravel (contexto gravado na execucao e no outbox) contem somente
  identificadores opacos e o tipo do evento. Resposta de formulario, dado
  clinico e qualquer outro conteudo sensivel nunca sao copiados para o
  contexto.
- `ProcessadorAutomacoes` (Fase 266) processa a execucao sem mudanca de
  contrato: condicoes vazias sempre avaliam como atendidas, e o restante do
  pipeline (validacao de acoes, retry, idempotencia por acao) e o mesmo dos
  incrementos anteriores.

## 5. Risco, rollout e rollback

Classificacao: **R4**, porque o gatilho passa a produzir efeito real
(notificacao, tarefa ou mensagem) a partir de um evento clinico-operacional
(resposta de formulario) sem intervencao humana no momento do disparo.

Nao ha migration: `outbox_eventos.tipo` e `execucoes_regra.status` ja aceitam
qualquer texto (sem `CHECK` constraint), e o novo tipo de outbox
(`automacao.gatilho.disparar`) e apenas mais um valor de coluna existente. O
rollback operacional e reimplantar a versao anterior; execucoes e eventos de
outbox ja criados sao registros operacionais legitimos e nao devem ser
apagados automaticamente.

Antes de ativar uma regra `questionario.respondido` em producao, a simulacao
continua obrigatoria (invariante preservada da Fase 266): a ativacao exige ao
menos uma simulacao persistida da mesma regra.

## 6. Gates do Incremento 267.1

- [x] Escopo e sequencia aprovados pelo proprietario.
- [x] Testes focados escritos antes da implementacao cobrindo contrato de
  gatilho fechado, criacao unica do evento duravel, replay idempotente,
  isolamento cross-tenant/cross-profissional e outbox retomavel.
- [x] Contrato de `gatilho` fechado numa uniao discriminada, com o
  especializado de `paciente.inativo` preservado.
- [x] Fundacao de disparo reutilizavel (`dispararGatilhoAutomacao`) coberta
  por testes unitarios isolados do fluxo de questionarios.
- [x] `ProcessadorOutboxGatilhosAutomacao` publica de forma retomavel, sem
  duplicar em concorrencia nem em falha de fila.
- [x] `finalizarFormularioPaciente` conectado a fundacao com condicoes vazias
  e contexto somente com IDs opacos.
- [x] Web esclarece que `questionario.respondido` dispara automaticamente,
  preservando rascunho, simulacao e ativacao.
- [x] Suite completa do backend e builds de backend/Web.
- [x] Gates de confiabilidade, secrets e `git diff --check`.
- [ ] Checks e revisao humana da PR contra `main`.

## 7. Fora do escopo da 267.1

- ligar `paciente.risco_alto` e `checkin.atrasado` (267.2 e 267.3);
- alerta de baixa adesao (PB-05);
- qualquer mudanca na formula do score de risco (Fase 265) ou no recall de
  inatividade (fluxo especializado, inalterado);
- migration, provider externo ou configuracao de producao.

## 8. Evidencia local do Incremento 267.1

- `PASS` - testes focados do contrato de gatilho: 11/11 (`gatilhos-automacao.spec.ts`).
- `PASS` - testes focados da fundacao de disparo: 8/8 (`disparar-gatilho-automacao.spec.ts`).
- `PASS` - testes focados do outbox de gatilhos: 4/4 (`processador-outbox-gatilhos-automacao.spec.ts`).
- `PASS` - suite do modulo de automacoes: 12 suites e 122/122 testes.
- `PASS` - suite do modulo de questionarios, incluindo os 4 novos cenarios de
  integracao com o gatilho (`servico-questionarios.spec.ts`): 38/38 testes.
- `PASS` - suite completa do backend: 199 suites executadas, 1.887/1.887
  testes; 3 suites (31 testes) permaneceram skipped, mesmo padrao ja
  documentado nas fases 265/266 (integracao dependente de ambiente).
- `PASS` - typecheck e build do backend.
- `PASS` - typecheck, lint e build da Web; lint sem erros e com 56 warnings
  preexistentes (mesma contagem da Fase 266.4).
- `PASS` - matriz de confiabilidade e scanner de secrets.
- `SKIPPED` - Playwright de Automacoes (`pnpm test:a11y -g automacoes`): o
  cache de browsers do sandbox desta sessao so tem a revisao 1194 do
  Chromium, e a versao de `@playwright/test` instalada nesta sessao exige a
  1243 (`browserType.launch: Executable doesn't exist ... chromium_headless_shell-1243`).
  Mudanca nesta fase e apenas textual (rotulo e texto de ajuda) e nao altera
  seletor, papel ARIA ou estrutura testada pelos cenarios existentes; o CI da
  PR roda com o cache de browsers correto e deve repetir o gate.
- `SKIPPED` - validacao local em Node 22: o host desta sessao usa Node 24 e
  emite o aviso de engine; o CI da PR deve repetir os gates no runtime Node
  22 exigido pelo repositorio.
- `NA` - migration, banco externo, staging, producao e providers: o
  incremento reutiliza colunas e tabelas existentes (`outbox_eventos`,
  `execucoes_regra`, `regras_automacao`) e nao aciona nenhum provider
  externo.
