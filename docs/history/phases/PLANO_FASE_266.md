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

1. **266.1 - contrato e executor confiavel** [CONCLUIDO]
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
   - integrado no PR `#269`, merge `143353f`, com todos os checks verdes.
2. **266.2 - `notificar_profissional`** [EM IMPLEMENTACAO]
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

Classificacao: **R4**, porque a fundacao atravessa tenancy e a 266.2 habilita
um efeito persistente visivel no centro de notificacoes.

Na 266.1 nao houve DDL, migration, segredo, configuracao externa ou escrita em
staging e producao. Seu rollback e reimplantar a versao anterior. Os campos
novos ficam somente no JSON `resultado`; consumidores antigos ja toleram campos
adicionais.

A 266.2 inclui a migration aditiva `1048`, aplicada fora de banda e ainda nao
executada em ambiente externo. O rollback operacional preferencial e
reimplantar a aplicacao anterior mantendo a ampliacao compativel da constraint.
O `down` apaga apenas notificacoes `automacao_executada` antes de restaurar a
constraint antiga e, por isso, exige janela, backup e aceite humano explicito;
nao deve ser executado automaticamente.

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
- [x] Checks e revisao humana da PR contra `main`; merge `143353f`.

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

## 9. Implementacao e gates do Incremento 266.2

- [x] Novo tipo fechado `automacao_executada` no backend e na Web.
- [x] Fan-out reutiliza `registrarNotificacao` dentro de `ExecutorTenant`.
- [x] `recurso_id` recebe UUID v8 deterministico derivado da chave
  `automacao:<execucaoId>:acao:<indice>`, preservando a deduplicacao do indice
  unico existente sem expor a chave interna.
- [x] Contexto da regra e dados clinicos nao sao copiados para a notificacao.
- [x] Destinatarios ficam limitados a SuperAdmin e profissional responsavel;
  colaborador, paciente, cliente e profissional alheio nao recebem o evento.
- [x] Regras criadas por SuperAdmin validam que o profissional existe, esta
  ativo e pertence ao tenant antes de persistir.
- [x] A Web apresenta o rotulo `Automação executada` com link autorizado para
  `/automacoes`.
- [x] Migration `1048` amplia apenas `notificacoes_tipo_check`, preserva os
  tipos existentes e esta registrada como aplicacao fora de banda.
- [x] Testes focados reproduziram as ausencias antes da implementacao e passam
  depois dela.
- [x] Suite completa, builds, gates de governanca e Playwright afetado.
- [ ] Checks e revisao humana da PR contra `main`.
- [ ] Migration aplicada e verificada primeiro em staging e depois em
  producao, somente apos merge e na sequencia do runbook.

Nenhum provider externo e acionado neste incremento. As acoes `criar_tarefa` e
`enviar_template` continuam indisponiveis ate 266.3 e 266.4, respectivamente.

## 10. Evidencia local do Incremento 266.2

- `PASS` - testes focados: 7 suites e 62/62 testes;
- `PASS` - suite completa do backend: 195 suites e 1.819 testes; 4 suites e
  37 testes preexistentes permaneceram skipped;
- `PASS` - typecheck e build do backend;
- `PASS` - typecheck, lint e build da Web; lint sem erros e com 56 warnings
  preexistentes;
- `PASS` - dashboard Playwright em desktop e mobile, incluindo rotulo e link
  autorizado da notificacao;
- `PASS` - matriz de confiabilidade com 40 referencias criticas;
- `SKIPPED` - validacao local em Node 22: o host desta sessao usa Node 24.19.0
  e emite o aviso de engine; o CI da PR deve repetir os gates no runtime Node 22
  exigido pelo repositorio;
- `NA` - migration, banco externo, staging, producao e providers: a migration
  `1048` foi apenas criada e registrada, sem aplicacao externa nesta PR.
