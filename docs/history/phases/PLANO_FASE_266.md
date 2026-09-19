# Plano da Fase 266 - execucao real das automacoes

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-19 com autorizacao explicita do proprietario, depois
do fechamento da Fase 265 e da leitura de
`docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`.

A Onda 2 do audit exige a ordem PB-01 -> PB-02 -> PB-03 -> PB-05. O motor de
regras do PB-01 ja existe; portanto, a Fase 266 implementa o PB-02 antes de
conectar gatilhos reais ou criar o alerta de baixa adesao.

O PR 55 continua pendente e adiado pelo proprietario para evitar custo externo.
Isso nao transforma o pentest em `PASS` nem concede GO de seguranca. O PR 56
continua condicionado a uma decisao explicita de distribuir o Mobile.

## 2. Problema observado

O processador generico avaliava as condicoes, copiava `regra.acoes` para
`acoesPlanejadas` e marcava a execucao como `executado` sem realizar nenhum
efeito. Alem do falso sucesso, a reivindicacao aceitava somente `pendente`: uma
queda depois de gravar `processando` fazia o retry do BullMQ retornar sem
retomar o trabalho.

O contrato aceitava qualquer objeto JSON. A interface oferecia
`notificar_profissional`, `criar_tarefa` e `enviar_template`, mas nao havia
validacao fechada, estado por acao, chave de idempotencia nem executor.

## 3. Sequencia aprovada

1. **266.1 - contrato e executor confiavel** [EM IMPLEMENTACAO]
   - fechar o vocabulario dos tres tipos de acao;
   - rejeitar objetos e campos desconhecidos antes de persistir;
   - persistir estado e numero de tentativas por acao no JSON existente;
   - atribuir a chave deterministica
     `automacao:<execucaoId>:acao:<indice>`;
   - separar checkpoints transacionais do efeito, permitindo retomada;
   - nunca converter acao ausente ou falha em `executado`;
   - manter `acoesPlanejadas` por compatibilidade e adicionar resultado
     estruturado para backend e Web;
   - nenhuma migration e nenhum efeito real neste incremento.
2. **266.2 - `notificar_profissional`** [PENDENTE]
   - novo tipo `automacao_executada` no centro de notificacoes;
   - migration aditiva para ampliar a constraint de tipos;
   - fan-out transacional, link autorizado e idempotencia por execucao/acao.
3. **266.3 - `criar_tarefa`** [PENDENTE]
   - contrato de titulo, prioridade e prazo;
   - conteudo cifrado, escopo de tenant/profissional e deduplicacao.
4. **266.4 - `enviar_template`** [PENDENTE]
   - template e canal explicitos;
   - opt-out e janela de comunicacao obrigatorios, sem bypass automatico;
   - limite de frequencia, outbox e chave de idempotencia.

Depois da Fase 266, a sequencia de produto e PB-03 (gatilhos reais) e PB-05
(alerta de baixa adesao), nessa ordem.

## 4. Invariantes da fundacao

- O tenant vem exclusivamente do job criado pelo backend e cada leitura ou
  gravacao continua dentro de `ExecutorTenant`.
- Uma acao `executada` ou `ignorada` nao volta a ser despachada em retry.
- Uma acao interrompida em `executando` pode ser retomada apenas por tentativa
  posterior do mesmo job e conserva a chave de idempotencia.
- Falha transitoria volta a execucao para `pendente` enquanto houver tentativa;
  falha definitiva termina em `falhou`.
- Mensagens de erro persistidas sao fechadas e nao copiam resposta de provider,
  URL, payload, PII ou PHI.
- A simulacao nunca chama o despachante; ela registra o efeito que seria
  executado com status `simulada`.
- O recall de inatividade existente continua em seu fluxo especializado; esta
  fundacao cobre o processador generico.

## 5. Risco, rollout e rollback

Classificacao: **R4**, porque a fundacao atravessa tenancy e prepara efeitos
sobre comunicacao e dados de acompanhamento, embora a 266.1 nao habilite esses
efeitos.

Nao ha DDL, migration, segredo, configuracao externa ou escrita em staging e
producao. O rollback da 266.1 e reimplantar a versao anterior. Os campos novos
ficam somente no JSON `resultado`; consumidores antigos ja toleram campos
adicionais.

Durante a transicao, qualquer avaliacao generica que alcance uma acao ainda sem
executor termina explicitamente em `falhou` com `acao_nao_disponivel`. As
regras de PB-03 ainda nao possuem gatilhos automaticos conectados, logo essa
condicao so aparece por avaliacao solicitada. Simulacao e gerenciamento de
rascunhos permanecem disponiveis.

## 6. Gates do Incremento 266.1

- [x] Escopo e sequencia aprovados pelo proprietario.
- [x] Testes escritos antes da implementacao reproduziram contrato aberto,
  falso sucesso e ausencia de resultado por acao.
- [x] Testes focados cobrem condicao nao atendida, sucesso, falha transitoria,
  retry, acao indisponivel, recuperacao de `processando` e execucao finalizada.
- [x] Backend e Web compartilham vocabulario e estado fechado das acoes.
- [x] Suite completa do backend e build de backend/Web.
- [x] Gates de confiabilidade, secrets e `git diff --check`.
- [ ] Checks e revisao humana da PR contra `main`.

## 7. Fora do escopo da 266.1

- disparar notificacao, mensagem ou criar tarefa;
- adicionar parametros especificos desses efeitos;
- conectar `checkin.atrasado`, `questionario.respondido` ou
  `paciente.risco_alto`;
- migration ou alteracao de constraint;
- deploy, configuracao de provider ou qualquer acao em producao.

## 8. Evidencia local do Incremento 266.1

- `PASS` - TDD focado: 3 suites e 28/28 testes;
- `PASS` - suite completa do backend: 193 suites e 1.810 testes; 4 suites e
  37 testes preexistentes permaneceram skipped;
- `PASS` - typecheck e build do backend;
- `PASS` - typecheck e build da Web;
- `PASS` - lint da Web sem erros e com 56 warnings preexistentes;
- `PASS` - 8/8 cenarios Playwright de acessibilidade de Automacoes, incluindo
  o resultado estruturado por acao;
- `PASS` - matriz de confiabilidade com 38 referencias criticas, gate de
  redacao de auditoria com 24/24 testes, scanner de secrets, documentacao
  canonica e `git diff --check`;
- `SKIPPED` - validacao local em Node 22: o host desta sessao usa Node 24.19.0
  e emite o aviso de engine; o CI da PR deve repetir os gates no runtime Node 22
  exigido pelo repositorio;
- `NA` - migration, banco externo, staging, producao e providers: a 266.1 nao
  possui DDL nem efeitos externos.
