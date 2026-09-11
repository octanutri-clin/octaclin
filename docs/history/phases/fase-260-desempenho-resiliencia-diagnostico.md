# Fase 260 - Desempenho, resiliência e diagnóstico operacional

Status: em andamento desde 2026-09-11 (Incrementos 1, 2 e 3 entregues).

## Objetivo (roadmap)

`CHECKLIST_FASES_FUTURAS_PRODUCAO.md` definiu quatro sub-metas: (1) orçamentos
de carregamento e eliminação de cascatas de requests no frontend; (2)
correlação de erro entre interface/BFF/backend sem PHI e runbooks de falha
para banco, Redis, storage, e-mail, WhatsApp e Google Calendar; (3) reduzir o
contrato inicial do prontuário a agregados e referências, carregando detalhes
decifrados (evoluções, mensagens, tarefas) só quando a área correspondente é
aberta; (4) tornar a gravação da trilha de auditoria resiliente a falhas
transitórias.

## Auditoria do estado atual (antes de qualquer mudança)

Uma auditoria somente-leitura (agente Explore) cobriu as quatro sub-metas
antes de qualquer código. Principais achados:

- **Sub-meta 1**: lazy-load já existe para materiais/anexos/profissionais no
  prontuário (Fase 239/254). Não existe orçamento de performance nem gate de
  CI (Lighthouse/bundle/contagem de requests). Sem camada de cache no
  cliente (`fetch(..., { cache: 'no-store' })` em todo BFF).
- **Sub-meta 2**: o `x-request-id` já é gerado no middleware, propagado pelo
  BFF ao backend e gravado em log estruturado e em
  `user_action_logs.metadados.requestId` — mas nunca é exibido ao usuário
  final em uma falha de UI. `RUNBOOK_PRODUCAO.md` já cobre os 6 dependentes
  citados no roadmap; e-mail/WhatsApp/Calendar têm profundidade menor que a
  seção de incidente de auditoria.
- **Sub-meta 3**: o endpoint `GET :id/prontuario` (`ServicoPacientes.
  obterProntuario`) decifrava e embutia evoluções clínicas e tarefas de
  acompanhamento inteiras na `linhaDoTempo`, mesmo com endpoints dedicados já
  existentes (`GET :id/evolucoes`, `GET :id/tarefas-acompanhamento`) prontos
  para uso lazy. Além disso, mensagens entravam na `linhaDoTempo` (com texto
  decifrado) independentemente da permissão `comunicacoes.mensagens.ler` —
  usada em todo o resto do sistema (`ControladorComunicacoes` inteiro está
  atrás dela) mas ignorada aqui, exceto para o campo `falhaComunicacao`. A
  mesma lacuna existia no endpoint paginado `GET :id/prontuario/timeline`
  (que já não decifra conteúdo, mas incluía a referência da mensagem sem
  checar a permissão, ao contrário do que já era feito para
  `planos_alimentares.ler` e `agenda.financeiro.ler` na mesma query).
  Verificado à parte: `visibilidade` em evoluções clínicas é hoje um tipo de
  união com um único valor (`'privada'`) — não existe recurso de
  visibilidade por papel/autor implementado, e o endpoint dedicado
  `listarEvolucoesClinicas` tampouco filtra por autor. Não é uma regressão
  introduzida por este endpoint; é o mesmo comportamento em todo o sistema.
- **Sub-meta 4**: `ServicoAuditoria.registrar()` (~101 pontos de chamada,
  incluindo leituras de PHI como prontuário e documentos clínicos) abre
  transação própria e engole falhas silenciosamente (loga e incrementa um
  contador por processo). `registrarAuditoriaNaTransacao()` (4 pontos em
  `planos-alimentares`) já é transacional de verdade. Existe alerta
  (`/operacoes`) desde a primeira falha, mas ele é por processo — não
  detecta falha isolada em uma réplica específica de uma frota. Não há
  retentativa em nenhum caminho. `OutboxEventoOrm` (já usado por
  `ProcessadorOutboxComunicacoes`) tem exatamente o formato necessário para
  um outbox de auditoria.

## Decisão de escopo

Dado o tamanho desigual das quatro frentes, o trabalho foi dividido em
incrementos independentes. Para a extensão do outbox transacional da
auditoria (sub-meta 4, ~101 call sites), a opção escolhida foi um piloto nos
pontos de leitura de PHI (prontuário, documentos clínicos, evoluções) em vez
da extensão completa ou do adiamento total — é o recorte de maior risco
concreto (perda de trilha em acesso a dado sensível) com menor superfície de
mudança.

## Incremento 1 - Contrato do prontuário: referências, não conteúdo, e correção de autorização de mensagens

Duas mudanças no mesmo endpoint, tratadas juntas porque tocam a mesma
query/mapeamento:

1. **Correção de autorização (comunicacoes.mensagens.ler)**: `mensagens` só
   entra na `linhaDoTempo` de `GET :id/prontuario` quando o usuário tem
   `comunicacoes.mensagens.ler` — antes entrava sempre, e só o campo-resumo
   `falhaComunicacao` era protegido. O mesmo endpoint paginado
   (`GET :id/prontuario/timeline`) ganhou o parâmetro booleano equivalente na
   query SQL, seguindo o padrão já usado para `planos_alimentares.ler` e
   `agenda.financeiro.ler` na mesma `WITH timeline AS (...)`.
2. **Redução do payload (evoluções e tarefas)**: os mapeadores usados
   exclusivamente pela `linhaDoTempo` do `obterProntuario`
   (`mapearEventoEvolucao`, `mapearEventoTarefa`) pararam de descriptografar
   e devolver o conteúdo clínico — agora só título, status e metadados de
   referência. O frontend (`ProntuarioPaciente`) passou a buscar o conteúdo
   completo sob demanda quando a aba "Evoluções" ou "Acompanhamento" é
   aberta, via os endpoints dedicados que já existiam
   (`GET :id/evolucoes`, `GET :id/tarefas-acompanhamento`), seguindo o mesmo
   padrão de lazy-load por aba já usado para materiais e anexos
   (`*Solicitados`/`*Carregados`/`carregando*`). Ao registrar uma nova
   evolução ou tarefa, o formulário atualiza a lista da própria aba e também
   recarrega o resumo eager (`carregar()`), para manter os contadores do
   resumo (`resumo.evolucoes`, `resumo.tarefasPendentes`) em sincronia sem
   reintroduzir o carregamento decifrado por padrão.

Mensagens não foram movidas para lazy-load nesta rodada: não existe hoje um
endpoint dedicado de "mensagens por paciente" reaproveitável (o controlador
de comunicações lista canais/templates, não histórico por paciente), e criar
um está fora do escopo mínimo deste incremento. Fica registrado como
candidato para uma rodada futura da sub-meta 3.

### Arquivos principais

- `octaclin-backend/.../pacientes/aplicacao/servico-pacientes.ts`: gate de
  `comunicacoes.mensagens.ler` em `obterProntuario` e na query SQL de
  `listarLinhaDoTempoPaginada`; `mapearEventoEvolucao`/`mapearEventoTarefa`
  sem descriptografia.
- `octaclin-backend/.../pacientes/aplicacao/servico-pacientes.spec.ts`: testes
  atualizados para o novo contrato (sem `descricao` em evolução/tarefa na
  timeline) + teste novo cobrindo a exclusão de mensagens sem permissão +
  parâmetros SQL atualizados.
- `octaclin-web/lib/prontuario-api.ts`: `listarEvolucoesClinicas`,
  `listarTarefasAcompanhamento` (GET, endpoints BFF já existiam).
- `octaclin-web/components/pacientes/prontuario-paciente.tsx`: estado e
  efeitos de lazy-load por aba para evoluções/tarefas, mapeadores locais
  `EvolucaoClinicaApi`/`TarefaAcompanhamentoApi` → `EventoProntuarioPacienteApi`.
- `octaclin-web/tests/visual/console-regression.spec.mjs`: mocks de
  `GET /evolucoes` e `GET /tarefas-acompanhamento` passam a devolver
  conteúdo real (antes devolviam sempre `[]`); teste de lazy-load estendido
  com contadores de leitura para as duas novas abas.

### Validações executadas

- `pnpm --dir octaclin-backend typecheck` — PASS.
- `pnpm --dir octaclin-backend exec jest src/modulos/pacientes src/infraestrutura/performance/benchmark-prontuario.spec.ts` — PASS (240 testes).
- `pnpm --dir octaclin-web typecheck` — PASS.
- `pnpm --dir octaclin-web exec eslint .` — 0 erros (warnings pré-existentes, não relacionados).
- `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs` (desktop + mobile) — PASS (88 testes).
- `pnpm --dir octaclin-web exec playwright test tests/visual/acessibilidade.spec.mjs -g "prontuario|paciente"` — PASS (23 testes; a suíte cobre deliberadamente só a aba inicial do prontuário).
- `pnpm security:secrets` — nenhum secret identificado.

### Pendências desta sub-meta

- Mover "Mensagens" e "Formulários" do prontuário para lazy-load exigiria um
  endpoint dedicado de listagem de mensagens por paciente, que não existe
  hoje — candidato para uma rodada futura.
- O achado sobre `visibilidade` em evoluções clínicas (tipo de união com um
  único valor, sem filtro por autor em nenhum dos dois endpoints) não é um
  regressão desta fase; fica registrado aqui como observação para uma
  eventual decisão de produto sobre visibilidade granular de evoluções.

## Incremento 2 - Correlação de erro visível ao usuário

**Correção de rota em relação à auditoria inicial**: ao investigar a
"profundidade menor" apontada para e-mail/WhatsApp/Calendar em
`RUNBOOK_PRODUCAO.md`, a comparação original media a seção errada. A ceremônia
completa (detecção → contenção → preservação de evidência → encerramento) que
existe para o incidente de auditoria é proporcional a um risco R4/R5 (trilha
de auditoria); não é o padrão esperado para uma falha de integração
operacional. `RUNBOOK_PRODUCAO.md` já declara explicitamente, na abertura de
`## Incidentes`, que as seções de e-mail/WhatsApp/Calendar ali são "resumo de
resposta rápida" e apontam para `RUNBOOK_SUPORTE.md` para o procedimento
completo — que já tem, para os três canais, sintomas, checklist, evidência
mínima, gatilho de escalonamento e severidade (`SLA_SUPORTE.md`, P0-P3) com
estrutura equivalente entre si. **Não havia, portanto, o gap de runbook
descrito na auditoria inicial**; era uma comparação entre documentos com
propósitos e níveis de risco diferentes. Isso é registrado aqui em vez de
escondido, por transparência sobre o replanejamento.

O que sobrou como gap real e verificado: `requestId` já percorria
UI → BFF → backend → log estruturado → `user_action_logs.metadados.requestId`,
mas nunca chegava a ser mostrado ao usuário final numa falha — e
`RUNBOOK_SUPORTE.md` já pedia esse valor como evidência para WhatsApp e Agenda
("`requestId`, se aparecer em resposta técnica ou logs"), pressupondo uma
fonte que a UI nunca entregava. Este incremento fecha esse loop:

1. **`octaclin-web/lib/erro-api.ts`** (novo): `ErroApi`/`lancarErroApi`
   compartilhados — capturam `status`, mensagem e o `requestId` do cabeçalho
   `x-request-id` da resposta do BFF, substituindo a classe de erro duplicada
   em `prontuario-api.ts` (13 pontos) e `agenda-api.ts` (1 ponto). Não migrado
   ainda: `comunicacoes-api.ts`, que tem uma classe de erro pública
   (`ErroApiComunicacoes`, checada por `instanceof` em
   `painel-comunicacoes.tsx`) e nenhum `<EstadoFalha>`/`<Aviso>` óbvio para
   plugar o código — candidato a uma rodada futura, e não um gap escondido.
2. **`FalhaInterface`** (`lib/erros-interface.ts`) ganhou `requestId?: string`,
   extraído do erro por duck typing (mesmo padrão de `status`), preservado em
   qualquer classificação de falha.
3. **`EstadoFalha`/`Aviso`** (`components/ui/feedback.tsx`) ganharam a prop
   opcional `codigoReferencia`, renderizada como "Código para suporte: <id>" —
   nunca PHI, é o UUID opaco do middleware.
4. Prontuário (6 pontos de `EstadoFalha`) e Agenda (`EstadoFalha` de carga
   inicial + `Aviso` de erro de ação, que é onde a falha de sincronização com
   o Google Calendar realmente aparece) passaram a exibir o código.
5. `RUNBOOK_SUPORTE.md`: evidência mínima de e-mail ganhou `requestId` (só
   WhatsApp e Agenda listavam antes — inconsistência real, agora corrigida) e
   a "Triagem inicial" passou a dizer que prontuário/agenda já mostram o
   código na tela, em vez de exigir busca em log técnico.

### Arquivos principais

- `octaclin-web/lib/erro-api.ts` (novo).
- `octaclin-web/lib/erros-interface.ts`, `lib/prontuario-api.ts`,
  `lib/agenda-api.ts`.
- `octaclin-web/components/ui/feedback.tsx`,
  `components/pacientes/prontuario-paciente.tsx`,
  `components/agenda/painel-agenda.tsx`.
- `octaclin-web/tests/visual/console-regression.spec.mjs`: dois testes novos
  (`falhaEvolucoes` no prontuário, falha de carga na agenda), ambos com mock
  de `x-request-id` na resposta e asserção do código na tela.
- `RUNBOOK_SUPORTE.md`.

### Validações executadas

- `pnpm --dir octaclin-web typecheck` — PASS.
- `pnpm --dir octaclin-web exec eslint .` — 0 erros (warnings pré-existentes).
- `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs` (desktop + mobile) — PASS (92 testes).
- `pnpm --dir octaclin-web exec playwright test tests/visual/acessibilidade.spec.mjs -g "prontuario|paciente|agenda"` — PASS (27 testes).
- `pnpm security:secrets` — nenhum secret identificado.

### Pendências desta sub-meta

- `comunicacoes-api.ts` (WhatsApp/e-mail via central de comunicações) ainda
  não expõe `requestId` na UI — sem endpoint/estado de falha óbvio para
  plugar hoje.
- Demais bibliotecas de API (materiais, mobile/anexos, questionários etc.)
  seguem com a classe de erro antiga, sem `requestId`. `lib/erro-api.ts` está
  pronto para qualquer uma delas adotar com uma mudança de poucas linhas.

## Incremento 3 - Piloto do outbox transacional de auditoria

Escopo decidido antecipadamente pelo dono do produto: piloto restrito aos
pontos de leitura de PHI de maior risco (prontuário, documentos clínicos,
evoluções), não extensão dos ~101 call sites de `ServicoAuditoria.registrar`.

**Desenho.** `registrar()` ganhou um campo opcional na entrada,
`garantirRetentativa?: boolean` — deliberadamente um campo, e não um método
novo: todo call site continua casando literalmente com
`[Aa]uditoria\.registrar\(`, a âncora que
`scripts/validar-redacao-auditoria.mjs` usa para achar call sites e cobrir as
chaves de `metadados`. Um método novo (`registrarResiliente`, por exemplo)
escaparia dessa âncora e do gate de cobertura em silêncio.

Quando a escrita direta em `user_action_logs` falha **e** `garantirRetentativa`
foi pedido: em vez de só contar a falha e descartar, o serviço grava o evento
(com `metadados` já redigido — a mesma redação, não uma segunda passada) numa
transação própria em `outbox_eventos` (tipo `auditoria.pendente`, tabela e RLS
que já existiam, reaproveitada de `ProcessadorOutboxComunicacoes`). Se esse
segundo write também falhar, cai no caminho de sempre — a trilha não fica
pior do que estava antes deste incremento. Um novo processador,
`ProcessadorOutboxAuditoria` (cron a cada minuto — mais espaçado que os 30s
dos outbox de comunicação, porque este só recebe evento quando a escrita
direta já falhou), drena a fila por tenant ativo com o mesmo mecanismo de
trava distribuída de `executarPorTenantAtivo`; reivindica cada evento por
`update` condicional (evita processamento duplo entre réplicas), tenta até 5
vezes, e só ao esgotar as tentativas marca `falhou` **e conta como perda
definitiva** em `totalFalhasProcesso` — reaproveitando o alerta já existente
em `/operacoes` em vez de criar um segundo canal de alarme.

Efeito prático: para os call sites pilotados, uma falha transitória de escrita
(pool esgotado, timeout pontual) agora tem uma segunda chance antes de virar
perda definitiva; o alerta existente continua sendo o sinal de "perdido de
verdade", só que pode chegar minutos depois em vez de no mesmo instante — a
troca está documentada em `RUNBOOK_PRODUCAO.md`.

### Arquivos principais

- `octaclin-backend/.../infraestrutura/auditoria/servico-auditoria.ts`: campo
  `garantirRetentativa`, `salvarLinhaTrilha`/`enfileirarOutbox`/
  `processarOutboxPendente`/`processarEventoOutbox`, contador
  `totalEnfileiradosOutboxProcesso`.
- `octaclin-backend/.../infraestrutura/auditoria/processador-outbox-auditoria.ts`
  (novo): cron por tenant ativo.
- `octaclin-backend/.../pacientes/apresentacao/controlador-pacientes.ts`:
  `garantirRetentativa: true` em `obterProntuario`,
  `listarLinhaDoTempoPaginada` e `listarEvolucoes`.
- `octaclin-backend/.../pacientes/apresentacao/controlador-documentos-clinicos.ts`:
  `garantirRetentativa: true` nas duas ações de leitura (`listar`, `obter`) —
  as três mutações (`emitir`, `cancelar`, `enviar`) ficam de fora do piloto de
  proposito.
- `octaclin-backend/.../pacientes/modulo-pacientes.ts`: registra
  `ProcessadorOutboxAuditoria`.
- Specs novos/atualizados: `servico-auditoria.spec.ts` (outbox e
  `processarOutboxPendente`), `processador-outbox-auditoria.spec.ts` (novo).
- `RUNBOOK_PRODUCAO.md`: nota na seção do alerta de falha de gravação sobre o
  atraso de detecção nos call sites pilotados e como checar backlog do outbox.

Nenhuma migration: `outbox_eventos` já existia com o formato e a RLS
necessários, criada na fundação do projeto para uso por comunicações.

### Validações executadas

- `pnpm --dir octaclin-backend typecheck` — PASS.
- `pnpm --dir octaclin-backend exec jest` (suíte completa) — PASS (1644 testes, 3 suítes puladas — integração com Testcontainers, pré-existente).
- `pnpm test:redacao-auditoria` — PASS (24 testes do gate).
- `node scripts/validar-redacao-auditoria.mjs` (execução real contra o repositório) — PASS, "Cobertura da redação de auditoria verificada", sem terceiro caminho de escrita detectado.
- `pnpm security:secrets` — nenhum secret identificado.

### Pendências desta sub-meta

- Extensão aos ~101 call sites restantes de `registrar` fica fora desta fase,
  por decisão de escopo — candidato a uma fase futura dedicada, se a
  experiência do piloto (volume real de eventos no outbox em produção)
  justificar.
- O contador `totalEnfileiradosOutboxProcesso` é exposto
  (`obterTotalEnfileiradosOutbox()`) mas ainda não tem card próprio em
  `/operacoes` — hoje só é visível em log (`auditoria.enfileirada_outbox`) e
  por consulta direta à tabela. Candidato a incremento futuro de
  observabilidade, não bloqueador do piloto.

## Incrementos restantes

- Incremento 4: orçamento de performance no frontend (gate de contagem de
  requests em CI, a partir do teste de lazy-load já existente).

Este documento é atualizado a cada incremento entregue.
