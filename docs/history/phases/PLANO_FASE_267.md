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
2. **267.2 - `paciente.risco_alto`** [CONCLUIDO]
   - liga o recalculo diario de prioridade de acompanhamento (Fase 265) a
     fundacao de disparo da 267.1;
   - regra de produto aprovada: dispara na ENTRADA em faixa alta (baixa/media
     -> alta), e o primeiro calculo de um paciente que ja nasce em alta conta
     como entrada; `alta -> alta` nao dispara de novo; override manual do
     profissional nunca dispara automacao neste incremento;
   - integrado nesta branch; ver secao 11 para evidencia local.
3. **267.3 - `checkin.atrasado`** [CONCLUIDO]
   - rodada periodica propria (`@Cron` diario, mesmo mecanismo de
     `executarPorTenantAtivo` ja usado pelo recall e pela prioridade), com
     contrato fechado de tres parametros e defaults de produto aprovados;
   - integrado nesta branch; ver secao 15 para evidencia local. Com este
     incremento, o PB-03 (gatilhos reais do motor de automacoes) esta
     concluido.

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

### Observacao de revisao (267.2)

A revisao de isolamento por tenant/profissional e de vazamento de dado
clinico (score/fatores/override) da 267.2 nao encontrou nenhum achado de
risco: o `tenantId` de `recalcularPaciente` nunca e reatribuido no loop de
`recalcularTenant`, `dispararGatilhoAutomacao` continua resolvendo regra e
profissional exclusivamente a partir do `tenantId`/paciente corretos, e o
contexto duravel enviado (`{ evento: 'paciente.risco_alto' }`) nao carrega
score, faixa, fatores nem justificativa de override. A revisao sugeriu, como
melhoria opcional e nao bloqueante, um teste de regressao explicito para
"regra de outro tenant nunca dispara" alem da cobertura estrutural ja
existente; o teste "respeita isolamento por tenant e profissional" em
`servico-recalculo-prioridade-acompanhamento.spec.ts` ja inclui uma regra de
`tenant-2` no mesmo cenario e confirma que ela nao produz execucao, o que
cobre o caso na pratica.

### Observacao de revisao (267.3)

A revisao de isolamento por tenant/profissional da 267.3 nao encontrou
nenhum achado de risco: `dispararGatilhoAutomacao` mantem o comportamento
pre-refactor, o novo `dispararParaRegra` so aceita `regra`/`tenantId` ja
resolvidos pelo chamador (nunca dado de requisicao), e a selecao de
candidatos filtra estritamente por `tenantId` e por
`profissionalResponsavelId: regra.profissionalId`. O teste "nao inclui
paciente arquivado, de outro profissional ou de outro tenant" em
`servico-checkin-atrasado.spec.ts` cobre exatamente esse cenario negativo.

## 4. Invariantes da fundacao (267.1, reutilizadas pela 267.2 e pela 267.3)

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
- (267.3) `dispararGatilhoAutomacao` ganhou um nucleo exportado,
  `dispararParaRegra`, que cria a execucao/outbox de UMA regra ja
  identificada, sem casar por tenant/profissional/tipo de gatilho de novo.
  Necessario porque `checkin.atrasado` tem parametros proprios por regra
  (`diasSemCheckin`/`intervaloMinimoDias`/`limitePorExecucao`): usar o
  casamento generico da 267.1/267.2 aplicaria o limiar de uma regra a
  candidatos selecionados para outra regra do mesmo profissional. A 267.1 e
  a 267.2 continuam usando `dispararGatilhoAutomacao` sem alteracao de
  comportamento.

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

## 9. Regra de disparo e gates do Incremento 267.2

Regra aprovada pelo proprietario: o gatilho `paciente.risco_alto` dispara
quando a prioridade calculada deterministicamente (Fase 265,
`calcularPrioridadeAcompanhamento`) ENTRA na faixa `alta`:

- baixa/media -> alta: dispara;
- primeiro calculo do paciente ja em alta (sem faixa anterior para comparar):
  dispara, conta como entrada;
- alta -> alta: nao dispara de novo;
- override manual do profissional (`solicitarOverridePrioridadeAcompanhamento`
  em `servico-pacientes.ts`) nunca dispara automacao neste incremento — o
  gatilho so e alcancavel a partir do calculo deterministico
  (`ServicoRecalculoPrioridadeAcompanhamento.recalcularPaciente`), nunca do
  caminho de override, que grava um `tipoEvento` diferente
  (`override_criado`/`override_alterado`/...) no mesmo historico e nunca
  chama o disparo.

Implementacao:

- `entrouEmAltaPrioridade(faixaAnterior, faixaAtual)`
  (`modulos/pacientes/dominio/prioridade-acompanhamento.ts`) e a funcao pura
  que decide a transicao, testada exaustivamente de forma isolada.
- `ServicoRecalculoPrioridadeAcompanhamento.atualizarEstadoAtual` passou a
  devolver a faixa calculada anterior (lida antes de sobrescrever o cache),
  nunca a `overrideFaixa`.
- `recalcularPaciente` chama `dispararGatilhoAutomacao` (fundacao da 267.1)
  somente quando `registrarHistoricoSeNovo` acabou de gravar um evento
  `calculo` novo E `entrouEmAltaPrioridade` for verdadeiro -- dentro da MESMA
  transacao/`gerenciador` do recalculo e do historico, exatamente como as
  demais escritas desse metodo.
- A chave de origem do disparo (`origemId`) e
  `${pacienteId}:${versaoFormula}:${diaUtc}`: a mesma janela (paciente,
  versao da formula, dia UTC) que ja impede um segundo evento `calculo` no
  mesmo dia impede tambem um segundo disparo, sem precisar de coluna nova.
- O contexto duravel enviado a fundacao contem somente
  `{ evento: 'paciente.risco_alto' }` -- nenhum score, fator ou justificativa
  de override.

Gates:

- [x] Escopo e regra de disparo aprovados pelo proprietario antes do codigo.
- [x] Testes focados escritos antes da implementacao cobrindo os 8 cenarios
  pedidos (transicao para alta, primeiro calculo em alta, alta -> alta,
  baixa/media sem transicao, override sem disparo, retry no mesmo dia,
  isolamento tenant/profissional, outbox retomavel apos falha de fila).
- [x] Nenhuma mudanca na fundacao da 267.1
  (`dispararGatilhoAutomacao`/`ProcessadorOutboxGatilhosAutomacao`): o
  gatilho `paciente.risco_alto` a reutiliza sem alterar seu contrato.
- [x] `ServicoRecalculoPrioridadeAcompanhamento` continua sem efeito externo
  proprio alem do disparo -- a formula, o cache e o historico da Fase 265
  nao mudam de comportamento.
- [x] Web descreve "a prioridade calculada entrar em alta", nao "enquanto
  estiver em alta".
- [x] Suite completa do backend e builds de backend/Web.
- [x] Gates de confiabilidade, secrets e `git diff --check`.
- [ ] Checks e revisao humana da PR contra `main`.

## 10. Fora do escopo da 267.2

- ligar `checkin.atrasado` (267.3);
- alerta de baixa adesao (PB-05);
- qualquer mudanca na formula do score de risco, nas faixas ou no fluxo de
  override da Fase 265;
- endpoint de recalculo sob demanda (hoje so existe a rodada diaria via
  `ProcessadorRecalculoPrioridadeAcompanhamento`);
- migration, provider externo ou configuracao de producao.

## 11. Evidencia local do Incremento 267.2

- `PASS` - testes focados do dominio: 12/12
  (`prioridade-acompanhamento.spec.ts`, incluindo 6 novos casos de
  `entrouEmAltaPrioridade`).
- `PASS` - testes focados do servico de recalculo: 19/19
  (`servico-recalculo-prioridade-acompanhamento.spec.ts`, 11 preexistentes +
  8 novos cobrindo os cenarios pedidos, incluindo o evento de outbox
  processado pelo `ProcessadorOutboxGatilhosAutomacao` real sob falha de
  fila).
- `PASS` - suite completa do backend: 199 suites executadas, 1.900/1.900
  testes; 3 suites (31 testes) permaneceram skipped, mesmo padrao ja
  documentado nas fases 265/266/267.1 (integracao dependente de ambiente).
- `PASS` - typecheck e build do backend.
- `PASS` - typecheck, lint e build da Web; lint sem erros e com 56 warnings
  preexistentes (mesma contagem da 267.1).
- `PASS` - matriz de confiabilidade e scanner de secrets.
- `SKIPPED` - Playwright de Automacoes: mesma limitacao de ambiente da 267.1
  (cache de Chromium do sandbox na revisao 1194, `@playwright/test` desta
  sessao exige 1243); mudanca nesta fase e apenas textual, o CI da PR roda
  com o cache correto.
- `SKIPPED` - validacao local em Node 22: o host desta sessao usa Node 24.
- `NA` - migration, banco externo, staging, producao e providers: o
  incremento nao adiciona coluna, tabela nem efeito externo novo.

## 12. Contrato e regra de disparo do Incremento 267.3

Contrato fechado aprovado pelo proprietario:

```
{
  tipo: "checkin.atrasado",
  diasSemCheckin: inteiro de 1 a 365,      // default de produto: 7
  intervaloMinimoDias: inteiro de 1 a 365, // default de produto: 7
  limitePorExecucao: inteiro de 1 a 200    // default de produto: 100
}
```

Regras de selecao:

- referencia de atraso e `paciente.ultimoCheckinEm`; quando nunca houve
  check-in, usa `paciente.criadoEm`;
- so entram pacientes ativos (nao arquivados) do profissional dono da regra,
  no tenant da rodada;
- paciente cujo ultimo disparo desta MESMA regra foi mais recente que
  `intervaloMinimoDias` fica de fora (motivo `disparo_recente`) — assim uma
  rodada diaria nao repete o lembrete todo dia enquanto o paciente segue
  atrasado;
- excedente alem de `limitePorExecucao` fica de fora (motivo
  `limite_por_execucao`), priorizando quem esta atrasado ha mais tempo —
  ordenacao deterministica, mesmo criterio do recall de inatividade;
- simulacao nominal (candidatos + motivos fechados de exclusao) obrigatoria
  antes de ativar, no mesmo espirito do recall; nunca despacha nenhuma acao.

Implementacao:

- `dominio/checkin-atrasado.ts`: `selecionarCandidatosCheckinAtrasado` (pura,
  motivos fechados `dentro_do_prazo`/`disparo_recente`/`limite_por_execucao`)
  e `normalizarConfiguracaoCheckinAtrasado` (defensiva na leitura, mesmo
  padrao do recall).
- `dominio/gatilhos-automacao.ts`: `checkin.atrasado` ganhou validacao HARD
  na escrita (rejeita fora da faixa 1-365/1-365/1-200 e campo desconhecido),
  ao contrario do soft-clamp historico do recall — o contrato nasce fechado
  nesta fase, entao a escrita pode recusar de imediato.
- `aplicacao/servico-checkin-atrasado.ts`: `simular` (nominal, nunca
  despacha) e `processarRodada` (real, chama `dispararParaRegra` por
  candidato, cada um na sua propria transacao, regra e paciente isolados
  entre si).
- `aplicacao/processador-checkin-atrasado.ts`: `@Cron` diario (mesma
  cadencia do recall e da prioridade), usando `executarPorTenantAtivo` —
  mesmo mecanismo ja usado pelos demais processadores periodicos, garantindo
  que a falha de um tenant nao interrompe os demais.
- `POST /automacoes/checkin-atrasado/simulacoes` (novo endpoint,
  autenticado e autorizado pelos mesmos guards da rota de recall) e a Web
  substituiu o campo livre "Campo/Operador/Valor" (que nunca fazia sentido
  para este gatilho) pelos tres parametros reais, com botao dedicado
  "Simular checkin atrasado".

## 13. Gates do Incremento 267.3

- [x] Escopo, contrato fechado e defaults de produto aprovados pelo
  proprietario antes do codigo.
- [x] Testes focados escritos antes da implementacao cobrindo os 9 cenarios
  pedidos (vencido entra, dentro do prazo nao entra, sem historico usa
  `criadoEm`, arquivado/outro profissional/outro tenant nao entra, intervalo
  minimo impede repeticao, limite deterministico, retry sem duplicar,
  simulacao nunca despacha, uma regra com erro nao interrompe as demais).
- [x] `dispararParaRegra` extraido da fundacao sem alterar o comportamento
  de `dispararGatilhoAutomacao` usado pela 267.1/267.2 (suites das duas
  fases continuam verdes sem alteracao).
- [x] Web substitui o campo livre `checkinsPerdidos` pelos tres parametros
  reais do contrato fechado.
- [x] `pnpm --dir octaclin-backend typecheck` / `build` / `test --runInBand`.
- [x] `pnpm --dir octaclin-web typecheck` / `lint`.
- [x] `pnpm test:guardas-controladores`.
- [x] `pnpm test:redacao-auditoria` (nova chave `diasSemCheckin` registrada
  em `CHAVES_SEGURAS` de `scripts/validar-redacao-auditoria.mjs`, mesmo
  tratamento ja dado a `diasSemConsulta` do recall).
- [x] `pnpm test:confiabilidade` e `pnpm security:secrets`.
- [x] `git diff --check`.
- [ ] Checks e revisao humana da PR contra `main`.

Com os gates acima verdes, o **PB-03 (gatilhos reais do motor de
automacoes) esta concluido**. O proximo item obrigatorio da Onda 2 do audit
e o **PB-05 (alerta de check-in com adesao baixa)**.

## 14. Fora do escopo da 267.3

- PB-05 (alerta de check-in com adesao baixa);
- qualquer mudanca no recall de inatividade (fluxo especializado,
  inalterado) ou nos gatilhos `questionario.respondido`/`paciente.risco_alto`
  alem da extracao de `dispararParaRegra`, que preserva o comportamento
  deles;
- endpoint de disparo manual/sob demanda para `checkin.atrasado` (hoje so
  existe a rodada diaria via `ProcessadorCheckinAtrasado`);
- migration, provider externo ou configuracao de producao.

## 15. Evidencia local do Incremento 267.3

- `PASS` - testes focados do dominio: 10/10 (`checkin-atrasado.spec.ts`).
- `PASS` - testes focados do contrato fechado: 5 novos casos em
  `gatilhos-automacao.spec.ts` (defaults, valores explicitos, faixa
  invalida, campo fora do contrato).
- `PASS` - testes focados do servico: 12/12
  (`servico-checkin-atrasado.spec.ts`), cobrindo simulacao nominal, rodada
  real, intervalo minimo, limite deterministico, retry sem duplicar e
  isolamento de erro entre regras da mesma rodada.
- `PASS` - `pnpm --dir octaclin-backend typecheck`.
- `PASS` - `pnpm --dir octaclin-backend build`.
- `PASS` - `pnpm --dir octaclin-backend test --runInBand`: 201 suites
  executadas (3 puladas, mesmo padrao ja documentado nas fases
  265/266/267.1/267.2 de integracao dependente de ambiente), 1.931/1.931
  testes.
- `PASS` - `pnpm --dir octaclin-web typecheck`.
- `PASS` - `pnpm --dir octaclin-web lint`: 0 erros, 56 warnings preexistentes
  (mesma contagem das fases anteriores).
- `PASS` - `pnpm --dir octaclin-web build`.
- `PASS` - `pnpm test:guardas-controladores`: 11/11.
- `PASS` - `pnpm test:redacao-auditoria`: 24/24 apos registrar
  `diassemcheckin` em `CHAVES_SEGURAS`.
- `PASS` - `pnpm test:confiabilidade`: 40 referencias criticas.
- `PASS` - `pnpm security:secrets`: nenhum segredo real identificado.
- `PASS` - `git diff --check`.
- `SKIPPED` - `pnpm validate:docs`: exige PowerShell, indisponivel neste
  sandbox Linux (mesma limitacao de ambiente ja registrada nas fases
  anteriores). O modo `-DocsOnly` do script so roda `git status --short`
  alem dos passos condicionados a `-not $DocsOnly`; verificado manualmente
  com `git status --short` e `git diff --check` neste ciclo.
- `SKIPPED` - Playwright de Automacoes: mesma limitacao de ambiente das
  fases 267.1/267.2 (cache de Chromium do sandbox na revisao 1194,
  `@playwright/test` desta sessao exige 1243).
- `NA` - migration, banco externo, staging, producao e providers: o
  incremento reutiliza tabelas e colunas existentes e nao aciona provider
  externo.

## 16. Correcao pos-267.3: condicao morta no formulario Web

Durante o fechamento da fase, foi identificado (e reportado ao proprietario)
que o formulario de criacao de regras em `painel-automacoes.tsx` ainda
anexava uma condicao generica (`campo`/`operador`/`valor`) aos gatilhos
`questionario.respondido` e `paciente.risco_alto`. O contexto real de
disparo desses gatilhos (via `dispararGatilhoAutomacao`/`dispararParaRegra`)
e opaco (`{ evento: "..." }`), sem nenhum campo generico do tipo
`frustracaoScore`/`checkinsPerdidos`. Uma regra criada com essa condicao
pelo formulario nunca dispararia de fato, mesmo apos ativada, sem qualquer
erro visivel ao usuario.

O proprietario pediu a correcao. Como o seletor de gatilho da Web so
oferece 4 tipos (inatividade, checkin atrasado, questionario respondido,
risco alto) e os dois primeiros ja usam `condicoes: []` (elegibilidade
resolvida dentro do proprio gatilho), o ramo generico de campo/operador/
valor so era alcancado - e sempre incorretamente - pelos dois gatilhos
automaticos. Correcao: `condicoes: []` para todos os gatilhos disponiveis no
formulario e remocao dos campos mortos (`FormularioRegra.campo/operador/
valor`, `valorCondicao`, os inputs correspondentes), preservando o seletor
de acao (`blocoAcao`) para questionario/risco alto. `avaliarCondicoes` trata
array vazio como vacuamente satisfeito (mesmo mecanismo ja usado por
`paciente.inativo` e `checkin.atrasado`), entao o comportamento de disparo
dos dois gatilhos automaticos nao muda.

Evidencia:
- `PASS` - `pnpm --dir octaclin-web typecheck`.
- `PASS` - `pnpm --dir octaclin-web lint`: 0 erros, 56 warnings preexistentes
  (mesma contagem da 267.3; nenhum novo warning introduzido no arquivo).
- `PASS` - `pnpm security:secrets`.
- `PASS` - `git diff --check`.
- `NA` - backend: nenhum arquivo de backend foi alterado por esta correcao.

Commit: `d879366`.

## 17. Correcao do gate "Demo local smoke" da PR #273

A PR `#273` falhou no job "Demo local smoke" (step "Smoke visual Playwright"):
o teste `tests/visual/acessibilidade.spec.mjs:2638` ("nova regra - alterna
gatilho e troca campos condicionais de forma acessivel") ainda esperava os
campos genericos `Campo`/`Operador`/`Valor` para `checkin.atrasado` (default
do formulario) e, apos alternar, novamente para o mesmo gatilho - campos
removidos pela correcao da secao 16 (commit `d879366`). Esse teste ja estava
desatualizado desde o commit `be3424c` (267.3), que substituiu esses campos
pelos tres parametros reais do checkin.atrasado; a lacuna so nao apareceu
antes porque o Playwright local desta sessao esta `SKIPPED` (revisao de
Chromium do sandbox incompativel com a exigida pelo `@playwright/test`
instalado).

Corrigido atualizando o teste para o comportamento correto e atual: com
`checkin.atrasado` selecionado (default), os tres campos do contrato fechado
e o seletor de Acao ficam visiveis e nenhum de `Campo`/`Operador`/`Valor`
existe; com "Paciente sem consulta ha muito tempo", so os campos de
inatividade ficam visiveis (sem Acao); com "Paciente em risco alto", so o
seletor de Acao fica visivel; voltando a `checkin.atrasado`, os tres campos
do contrato fechado e a Acao voltam.

Evidencia:
- `PASS` - verificado localmente com um workaround so de ambiente (symlinks
  em `/opt/pw-browsers` apontando a revisao 1194 instalada para a revisao
  1243 exigida pelo `@playwright/test` desta sessao; nada commitado no
  repositorio): 20/20 testes de `automacoes` em `acessibilidade.spec.mjs`
  passam em `desktop-chromium` e `mobile-chromium`, incluindo o teste
  corrigido.
- `PASS` - o teste relacionado de `fase-197-modulos-avancados.spec.mjs`
  ("simula regra rascunho antes de permitir ativacao", que usa fixture de
  regra ja persistida e nao passa pelo formulario de criacao) continua
  verde nos dois projetos.
- `PASS` - `pnpm --dir octaclin-web typecheck` e `lint` sem novos erros.

Commit: `e9a54b5`.
