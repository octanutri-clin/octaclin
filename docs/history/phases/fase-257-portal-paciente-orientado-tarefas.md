# Fase 257 - Portal do paciente orientado por tarefas

Status: concluida em 2026-09-10.

## Conclusao

Os quatro incrementos planejados na auditoria inicial foram entregues no
mesmo dia, todos na mesma branch/PR: (1) confirmacao explicita ao
desmarcar consulta, (2) ranking cruzado de "proxima acao" entre
formularios e tarefas, (3) conclusao de tarefas/metas pelo paciente com
notificacao ao profissional, (4) remocao de codigo morto. Unica migration
da fase: `1720000001039` (amplia CHECK de tipos de notificacao, aditiva).
Nenhuma mudanca de contrato de leitura do portal. Evidencias completas de
cada incremento abaixo. Proxima fase oficial do roadmap: Fase 258 (Central
de comunicacoes confiavel).

## Objetivo (roadmap)

`CHECKLIST_FASES_FUTURAS_PRODUCAO.md`: priorizar proxima consulta e proxima
acao; organizar plano, check-ins, tarefas, materiais, formularios, mensagens,
perfil e privacidade; usar linguagem simples, confirmacoes explicitas e nunca
expor risco clinico ou detalhes internos ao paciente.

## Auditoria do estado atual (antes de qualquer mudanca)

- Um unico componente (`components/portal/portal-paciente.tsx`, ~1520 linhas)
  atende todas as rotas `/portal/*` via a prop `secao`; todas as secoes ficam
  montadas e alternam com `hidden`. O contexto `PortalPacienteProvider`
  (`components/portal/portal-contexto.tsx`) e o unico dono do
  `GET /api/portal/paciente`.
- A priorizacao "proxima acao / proxima consulta / plano em andamento" ja
  existe desde a Fase 162 (tres cartoes na secao `inicio`,
  `portal-paciente.tsx:642-708`). A navegacao por tarefas (Inicio, Agenda,
  Registro de habitos, Plano, Formularios, Mensagens, Perfil, Privacidade) e
  da Fase 181.
- Bloco morto: `<Cartao id="acoes" className="hidden">` (linhas 710-752) —
  nunca renderizado, sobra da reestruturacao da Fase 162.
- Nao existe hoje um ranking cruzado de "proxima acao": o cartao considera
  apenas `formulariosPendentes[0]`, ignorando tarefas vencidas ou mensagens
  pendentes.
- `AcompanhamentoTarefaOrm` (backend, modulo `pacientes`) e prescrito pelo
  profissional e listado no portal, mas o paciente so le — nao ha rota para
  marcar tarefa/meta como concluida nem no backend
  (`controlador-portal-paciente.ts`) nem no BFF (`lib/portal-api.ts`).
- Acoes imediatas e sem confirmacao: "Desmarcar" consulta
  (`portal-paciente.tsx:1314-1323`, dispara `desmarcarConsultaPaciente` direto
  no clique) e a abertura de solicitacao LGPD de exclusao (dispara
  `enviarSolicitacaoLgpd` no submit do formulario, sem etapa intermediaria).
  Isso conflita com a exigencia de "confirmacoes explicitas".
- Testes que ja protegem o portal hoje:
  `tests/visual/portal-paciente.spec.mjs` (5 testes: prioridades da home sem
  score clinico, curva de peso sem IMC/classificacao, jornada de navegacao
  com carregamento unico, privacidade/LGPD, estado de erro recuperavel) e
  `tests/visual/pwa-portal.spec.mjs` (offline check-in e formulario). Qualquer
  incremento desta fase precisa manter esses testes verdes.

## Plano de incrementos verticais

1. **Confirmacao explicita para desmarcar consulta.** Reusar o componente
   compartilhado `ModalConfirmacao` (`components/ui/modal.tsx`, ja usado em
   19 outros componentes, ex. `agenda/painel-agenda.tsx:1457-1470`) para
   exigir confirmacao antes de cancelar uma consulta agendada pelo paciente.
   Sem mudanca de backend/BFF.
2. **Ranking cruzado de "proxima acao".** Expandir a logica do cartao inicial
   para considerar tambem tarefas vencidas/proximas do vencimento, nao so o
   primeiro formulario pendente.
3. **Conclusao de tarefas/metas pelo paciente.** Nova rota backend
   (`PATCH /portal/paciente/tarefas/:id`) + BFF + UI para o paciente marcar
   uma tarefa prescrita como concluida — maior escopo, decisao de contrato
   a confirmar antes de implementar.
4. **Limpeza.** Remover o bloco morto `id="acoes"`.

Este documento e atualizado a cada incremento com o que foi entregue,
arquivos tocados e validacoes.

## Incremento 1 - confirmacao explicita para desmarcar consulta

Concluido em 2026-09-10.

- TDD: teste Playwright adicionado primeiro
  (`tests/visual/portal-paciente.spec.mjs`, "exige confirmacao explicita
  antes de desmarcar uma consulta") e confirmado RED (dialogo inexistente)
  antes da implementacao.
- Implementacao: `components/portal/portal-paciente.tsx` passou a abrir
  `ModalConfirmacao` (componente compartilhado, ja usado em 19 outros
  lugares do app, ex. `agenda/painel-agenda.tsx`) ao clicar em "Desmarcar";
  a chamada real a `desmarcarConsultaPaciente` so acontece apos confirmar no
  dialogo. Nenhuma mudanca de backend, BFF ou contrato de API.
- Validacoes:
  - `pnpm --dir octaclin-web typecheck` — PASS
  - `pnpm --dir octaclin-web lint` — PASS (0 erros; warnings pre-existentes
    nao relacionados nesta mudanca)
  - `pnpm --dir octaclin-web exec playwright test tests/visual/portal-paciente.spec.mjs tests/visual/pwa-portal.spec.mjs --project=desktop-chromium --project=mobile-chromium` —
    18/18 PASS
  - Gate de linguagem e microcopy (`pnpm test:linguagem:fix` + revisao
    manual do acento em "ficará") — PASS
  - `tests/visual/acessibilidade.spec.mjs` (suite completa) —
    **SKIPPED intencionalmente**: o contrato de acessibilidade de
    `ModalConfirmacao` (foco, `role="dialog"`, `aria-modal`, Escape, trap de
    Tab) ja e coberto na origem pelo gate compartilhado de componentes
    (`acessibilidade.spec.mjs`, secao "Modal / ModalConfirmacao ->
    area-onboarding.tsx"); este incremento reutiliza o componente sem
    alterá-lo, sem introduzir padrao ARIA novo.
  - `pnpm security:secrets` e `git diff --check` — PASS
- CI (Demo Local Smoke) do PR `#227` pegou uma regressao real que a suite
  local nao cobria: `tests/visual/jornadas-criticas.spec.mjs` ja tinha uma
  jornada critica que desmarcava a consulta com um unico clique, sem passar
  pelo novo dialogo. Corrigido no mesmo PR clicando em "Desmarcar consulta"
  no `ModalConfirmacao` antes de aguardar o efeito; revalidado localmente
  (30/30 Playwright desktop+mobile em `jornadas-criticas.spec.mjs`,
  `portal-paciente.spec.mjs` e `pwa-portal.spec.mjs`) e reenviado.

## Incremento 2 - ranking cruzado de "proxima acao"

Concluido em 2026-09-10.

- TDD: teste Playwright adicionado primeiro
  (`tests/visual/portal-paciente.spec.mjs`, "prioriza tarefa com vencimento
  mais proximo do que o formulario pendente") e confirmado RED (o cartao
  continuava mostrando o formulario) antes da implementacao.
- Implementacao: nova funcao pura `selecionarProximaAcao(portal)` em
  `components/portal/portal-paciente.tsx` que reune os formularios
  pendentes e as tarefas de acompanhamento ainda nao concluidas
  (`status !== 'concluida'`) como candidatos, ordena os que tem prazo
  (`expiraEm`/`vencimentoEm`) pelo mais proximo primeiro e so cai para a
  ordem original (formulario antes de tarefa) quando nenhum candidato tem
  prazo definido. O cartao "Proxima acao" da home passou a renderizar o
  vencedor (formulario ou tarefa) e o botao correspondente
  ("Responder agora" ou "Ver no plano"). Nenhuma mudanca de backend, BFF ou
  contrato de API — usa dados que o portal ja recebia.
- Decisao deliberada: a selecao usa apenas a data de prazo, sem comparar
  contra o relogio do sistema (`Date.now()`), para manter o ranking
  deterministico e testavel; nao ha rotulo "atrasada" nesta fase, apenas a
  data de vencimento/expiracao. Marcar tarefas como concluidas pelo
  paciente e visualizar atraso continuam no Incremento 3.
- Validacoes:
  - `pnpm --dir octaclin-web typecheck` — PASS
  - `pnpm --dir octaclin-web lint` — PASS (0 erros; mesmos 52 warnings
    pre-existentes e nao relacionados)
  - `pnpm --dir octaclin-web build` — PASS
  - `pnpm --dir octaclin-web exec playwright test tests/visual/portal-paciente.spec.mjs tests/visual/pwa-portal.spec.mjs tests/visual/jornadas-criticas.spec.mjs --project=desktop-chromium --project=mobile-chromium` —
    32/32 PASS
  - Gate de linguagem e microcopy — PASS
  - `pnpm security:secrets` e `git diff --check` — PASS

## Incremento 4 - remocao do bloco morto `id="acoes"`

Concluido em 2026-09-10 (adiantado; e independente da decisao de contrato
pendente para o Incremento 3).

- `components/portal/portal-paciente.tsx`: removido o
  `<Cartao id="acoes" className="hidden">` (43 linhas) identificado na
  auditoria inicial desta fase — sobra da reestruturacao da Fase 162,
  nunca renderizado (`className` fixo em `"hidden"`, nao ligado a `secao`
  como os demais cartoes). Confirmado por busca que nenhum teste
  referenciava seu conteudo ("Próximas ações", distinto do cartao "Proxima
  ação" da home) antes de remover.
- Sem TDD dedicado: remocao pura de codigo morto, sem comportamento novo;
  validado revalidando a suite Playwright existente sem alteracao.
- Validacoes:
  - `pnpm --dir octaclin-web typecheck` — PASS
  - `pnpm --dir octaclin-web lint` — PASS (0 erros)
  - `pnpm --dir octaclin-web build` — PASS
  - 32/32 Playwright (desktop+mobile) em `portal-paciente.spec.mjs`,
    `pwa-portal.spec.mjs` e `jornadas-criticas.spec.mjs` — sem regressao
  - Gate de linguagem, `pnpm security:secrets`, `git diff --check` — PASS

## Incremento 3 - conclusao de tarefas/metas pelo paciente

Concluido em 2026-09-10.

### Decisao de produto (confirmada com o dono do produto)

1. Categorias completaveis pelo paciente: **so `meta` e `tarefa`**.
   `checkin` ja tem fluxo proprio de registro; `orientacao` e informativa,
   nao uma acao discreta.
2. Conclusao **notifica o profissional responsavel** pela tarefa.
3. A conclusao e **definitiva pelo lado do paciente** — reabrir exige o
   profissional pelo prontuario.

### Implementacao

- **Migration** `1720000001039-AdicionarTarefaConcluidaNotificacoes`:
  amplia o CHECK `notificacoes_tipo_check` para aceitar o novo tipo
  `tarefa_concluida`, registrada em `opcoes-typeorm.ts`. Aditiva, com
  `down` que restaura o conjunto anterior. `@aplicacao fora-de-banda`
  como as demais migrations do projeto.
- **Backend**: `TipoNotificacao` ganhou `'tarefa_concluida'` (fora da
  lista `TIPOS_OPERACIONAIS_COLABORADOR`, mesmo tratamento de
  `formulario_respondido` — so SuperAdmin e o profissional dono do
  evento recebem, nunca Collaborator ou o proprio paciente).
  `ServicoPortalPaciente.concluirTarefa(tenantId, usuarioId, tarefaId)`
  (novo metodo): resolve o paciente pelo `usuarioId`, carrega a tarefa
  escopada a tenant+paciente (`ForbiddenException` se pertencer a outro
  paciente), rejeita categoria fora de `['meta','tarefa']` e status
  `concluida`/`cancelada` (`BadRequestException`/`ConflictException`),
  marca `status='concluida'` + `concluidoEm`, e chama
  `registrarNotificacao` com `profissionalId` explicito da propria
  tarefa (mais preciso que o `profissionalResponsavelId` generico do
  paciente). Nova rota `PATCH /portal/paciente/tarefas/:id/concluir` em
  `controlador-portal-paciente.ts`, com auditoria que guarda so a
  categoria (enum fechado) — nunca titulo/descricao da tarefa, que sao
  conteudo de prontuario escrito pelo profissional.
- **Frontend**: BFF `PATCH /api/portal/paciente/tarefas/[tarefaId]/concluir`
  (proxy fino); `concluirTarefaPaciente` em `lib/portal-api.ts`. Na secao
  "Plano" do portal, tarefas com categoria `meta`/`tarefa` ganham o botao
  "Marcar como concluída", que abre `ModalConfirmacao` ("Depois de
  concluída, só o profissional pode reabrir esta tarefa pelo
  prontuário...") antes de chamar a API; ao confirmar, a tarefa e
  removida da lista local (sem refetch completo) e uma mensagem de
  sucesso e exibida. Categorias `checkin`/`orientacao` nunca mostram o
  botao.
- Nenhuma mudanca de contrato para leitura (`GET /portal/paciente`
  continua retornando o mesmo formato de tarefa).

### Validacoes

- TDD: RED confirmado tanto no backend (guard de categoria comentado,
  teste falhou; restaurado) quanto no frontend (restricao de categoria
  ampliada para incluir `orientacao`, teste Playwright falhou por
  contagem de botao; restaurada). Um teste de vazamento de PHI na
  trilha (`nao deve deixar titulo da tarefa chegar a trilha`) tambem foi
  confirmado capaz de pegar a regressao antes de ser corrigido.
- Backend: `servico-portal-paciente.spec.ts` (+9 testes: sucesso meta,
  sucesso tarefa em_andamento, rejeita checkin/orientacao, rejeita
  concluida, rejeita cancelada, rejeita tarefa de outro paciente, rejeita
  usuario sem paciente), `controlador-portal-paciente.spec.ts` (+2,
  incluindo o teste negativo de vazamento de titulo na trilha),
  `destinatarios-notificacao.spec.ts` (+1), migration spec (+2, up/down).
  405/405 testes dos modulos `pacientes`+`notificacoes`+migrations
  PASS (1 suite de integracao com banco real SKIPPED, mesma limitacao
  de ambiente das fases anteriores).
  `pnpm --dir octaclin-backend typecheck` e `build` — PASS.
- Frontend: 34/34 Playwright (desktop+mobile) em `portal-paciente.spec.mjs`,
  `pwa-portal.spec.mjs` e `jornadas-criticas.spec.mjs` — PASS.
  `pnpm --dir octaclin-web typecheck`, `lint` (0 erros) e `build` — PASS.
  `pnpm test:authz` — PASS (executado apos criar a rota BFF).
- Gate de linguagem, `pnpm security:secrets`, `git diff --check` — PASS.
- `powershell ... -DocsOnly` — SKIPPED (PowerShell indisponivel neste
  ambiente Linux, mesma limitacao das PRs anteriores).
- Migration nao aplicada em nenhum banco de producao/staging por esta
  sessao. Segue o runbook padrao: aplicacao fora de banda por role
  owner, fora do boot do runtime (`@aplicacao fora-de-banda`).
