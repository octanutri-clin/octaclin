# Fase 260 - Desempenho, resiliência e diagnóstico operacional

Status: em andamento desde 2026-09-11 (Incremento 1 entregue).

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

## Incrementos restantes

- Incremento 2: correlação de erro visível ao usuário (`requestId` na UI) e
  aprofundamento dos runbooks de e-mail/WhatsApp/Calendar.
- Incremento 3: piloto do outbox transacional de auditoria para os pontos de
  leitura de PHI (prontuário, documentos clínicos, evoluções).
- Incremento 4: orçamento de performance no frontend (gate de contagem de
  requests em CI, a partir do teste de lazy-load já existente).

Este documento é atualizado a cada incremento entregue.
