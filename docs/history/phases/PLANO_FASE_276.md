# Fase 276 — Expediente por profissional e tipos de atendimento (PB-18)

## 1. Objetivo

Segundo item da Onda 4 do audit de produto (estrutura). Fecha o gap "não existe modelo de
expediente" (`docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`, item 7 da lista de achados, seção
5.6): o agendamento público hoje oferece qualquer horário 24 horas por dia, 7 dias por semana,
por 30 dias, descontando só ocupações já existentes — nenhuma noção de dia da semana, faixa de
horário ou duração configurável existe em lugar nenhum do backend.

## 2. Risco (R2/R3 — duas tabelas novas, sem dado clínico)

Migration aditiva com duas tabelas novas (`tipos_atendimento`, `expedientes_profissionais`) e uma
coluna nova opcional em `agenda_links_publicos`. Nenhuma tabela existente perde coluna ou muda
tipo. Nenhum dado clínico envolvido — apenas configuração operacional de agenda. RLS habilitada e
forçada nas duas tabelas novas, seguindo exatamente o padrão de
`1720000001006-CriarBloqueiosManuaisAgenda` (referências a `tenants(id)`, índice composto por
tenant, política `isolamento_tenant_<tabela>` com `current_setting('app.tenant_id', true)`).

Rollback: `drop table ... cascade` nas duas tabelas novas e `drop column` na coluna nova de
`agenda_links_publicos` (down da migration). Sem backfill: tabelas novas nascem vazias, coluna
nova nasce nula.

## 3. Escopo confirmado pelo proprietário (2026-09-22)

Duas decisões tomadas via pergunta direta ao proprietário, registradas aqui para não depender de
memória de conversa:

1. **Tipo de atendimento com duração própria entra nesta fase** (opção não recomendada por mim,
   mas escolhida pelo proprietário) — ver seção 4 para o desenho concreto, escolhido para não
   forçar um redesenho da tela pública de agendamento.
2. **A restrição de expediente vale só para o agendamento público** (paciente/prospect sem
   login). A equipe interna continua podendo criar consulta manualmente em qualquer horário via
   `POST /agenda/consultas` — sem mudança de comportamento na tela mais usada do dia a dia do
   profissional.

## 4. Desenho técnico (lido no código antes de codar)

### 4.1 Algoritmo atual de horários livres

`ServicoAgendamentoPublico` (`servico-agendamento-publico.ts`): `JANELA_DISPONIBILIDADE_MS` fixa
30 dias; `calcularHorariosLivres` varre esse período em passos de `duracaoMinutos` e descarta só
os passos que colidem com `listarOcupacoes` (consultas + bloqueios externos do Google + bloqueios
manuais). Nenhum filtro de dia da semana ou faixa de horário existe. `resolverLinkAtivo` resolve
o token via a função SQL `resolver_agenda_link_publico($1)` — roda **antes** do contexto de
tenant existir (a rota é pública, sem JWT), então essa resolução continua fora do
`executorTenant`; tudo depois disso (`obterAgendaPublica`, `criarSolicitacaoPublica`) já roda
dentro de `executorTenant.executar(link.tenantId, ...)`, onde RLS normal se aplica.

### 4.2 `agenda_links_publicos` — um link ativo por profissional

`AgendaLinkPublicoOrm` tem índice único parcial `(tenant_id, profissional_id) where ativo = true`:
só existe **um** link público ativo por profissional. Hoje `duracaoMinutos` só é definido na
criação (`DURACAO_PADRAO_LINK_MINUTOS = 50`) ou herdado do link anterior em
`rotacionarLinkPublico` — **não existe hoje nenhuma rota que permita escolher a duração**
explicitamente; é sempre herança ou o default de 50 minutos. Isso confirma que introduzir
`tipos_atendimento` como fonte da duração não é redundante: resolve um gap real (duração
inconfigurável) e não exige nenhuma tela nova de seleção de tipo pelo paciente, porque continua
havendo um único link com uma única duração efetiva — só que agora nomeada e reutilizável.

### 4.3 Desenho das tabelas novas

**`tipos_atendimento`** (catálogo por tenant, no molde de `biblioteca_condutas` — reutilizando
padrão já resolvido, não inventando um novo):
- `id`, `tenant_id`, `nome` (varchar 120), `duracao_minutos` (int, 5–480), `ativo` (boolean,
  default true — mesmo padrão de `agenda_links_publicos.ativo`, não `arquivadoEm`, porque este
  módulo é `agenda`, não `pacientes`), `criado_em`, `atualizado_em`.
- RLS por tenant.

**`expedientes_profissionais`** (jornada semanal por profissional):
- `id`, `tenant_id`, `profissional_id`, `dia_semana` (int 0–6, 0 = domingo, mesma convenção de
  `Date.getDay()`), `hora_inicio` (`time`), `hora_fim` (`time`, `check (hora_fim > hora_inicio)`),
  `criado_em`, `atualizado_em`.
- Múltiplas faixas por dia são permitidas (cobre intervalo de almoço: duas faixas no mesmo dia).
- Sem coluna `ativo`: salvar a jornada substitui **todas** as faixas do profissional numa
  transação (delete + insert), então a ausência de linhas para um dia já significa "não atende
  nesse dia" — uma coluna `ativo` seria redundante.
- RLS por tenant. Índice composto `(tenant_id, profissional_id, dia_semana)`.

**`agenda_links_publicos`** ganha `tipo_atendimento_id` (uuid, nullable, `references
tipos_atendimento(id)`). Sem tipo selecionado, `duracao_minutos` continua editável/herdado como
hoje (compatibilidade total, nenhum profissional é forçado a usar o catálogo).

### 4.4 Onde a jornada entra na geração de horários

`calcularHorariosLivres` e `validarDisponibilidade` (chamada também por
`criarSolicitacaoPublica`) passam a receber a lista de faixas de expediente do profissional. Sem
nenhuma faixa cadastrada, o comportamento é **idêntico ao atual** (24/7, sem filtro) — mesmo
padrão "sem configuração, sem mudança de comportamento" já usado no PB-24. Com faixas cadastradas,
um horário só é oferecido/aceito se cair inteiramente dentro de alguma faixa do mesmo dia da
semana, calculado no timezone já resolvido por `normalizarIdentidadeAgendaPublica` (configuração
do tenant, não o timezone do servidor) — via `Intl.DateTimeFormat` com `weekday`/`hour`/`minute`,
mesmo mecanismo de fuso já usado no restante do agendamento público.

### 4.5 Endpoints novos (autenticados, sob `/agenda`, mesmo guard stack de `ControladorAgenda`)

- `GET /agenda/tipos-atendimento` — `agenda.consultas.ler`.
- `POST /agenda/tipos-atendimento` — `agenda.consultas.criar`.
- `DELETE /agenda/tipos-atendimento/:tipoId` (arquiva, `ativo = false`) — `agenda.consultas.criar`.
- `GET /agenda/expediente?profissionalId=` — `agenda.consultas.ler`.
- `PUT /agenda/expediente` (substitui a jornada inteira do profissional; `profissionalId` no
  corpo, resolvido por `resolverProfissionalIdDoUsuario` como em `bloqueios-manuais`) —
  `agenda.consultas.criar`.
- `POST /agenda/agendamento-publico/rotacionar` ganha um `tipoAtendimentoId` opcional no corpo;
  omitido, mantém o comportamento atual de herança/default.

## 5. Fora de escopo (gaps que continuam)

- PB-19 (recorrência de consulta) — próximo item da Onda 4, fase própria. Este desenho não impede
  a recorrência: uma consulta recorrente ainda vai precisar validar cada ocorrência contra o
  expediente, o que a função `filtrarPorExpediente` desta fase já deixa pronto para reutilizar.
- Seleção de tipo de atendimento pelo paciente na tela pública — não entra: o link continua tendo
  uma duração efetiva única (vinda do tipo escolhido pelo profissional ao rotacionar o link, ou
  manual como hoje).
- Exceção pontual (feriado, dia de folga dentro de um dia normalmente útil) — não precisa de
  mecanismo novo: `agenda_bloqueios_manuais` já cobre isso via `tipo: 'ferias'` (bloqueio datado,
  não recorrente), que continua funcionando exatamente como hoje sobre a jornada nova.
- Bloqueio/aviso na criação manual de consulta pela equipe interna fora do expediente — decisão
  explícita do proprietário de não incluir (ver seção 3, item 2).

## 6. Validações planejadas

- Specs da migration (padrão dos precedentes).
- Specs de serviço: `tipos_atendimento` CRUD; `expediente` substituição de jornada (rejeita
  sobreposição de faixas no mesmo dia); `calcularHorariosLivres`/`validarDisponibilidade` com e
  sem expediente configurado (regressão: sem expediente, comportamento idêntico ao atual);
  horário fora da faixa configurada rejeitado; horário dentro de faixa com almoço (duas faixas no
  mesmo dia) aceito só nos dois intervalos, não no meio.
- `pnpm --dir octaclin-backend typecheck` / `build`.
- `pnpm --dir octaclin-web typecheck` / `lint` / `build`.
- Playwright do agendamento público e do painel de agenda, cobrindo a tela nova de expediente e a
  restrição de horários, sem regredir os cenários existentes.
- `git diff --check`, `pnpm security:secrets`.

## 7. Entregue (2026-09-23)

Escopo do plano implementado sem desvio, incluindo as duas decisões do proprietário (seção 3):
tipo de atendimento com duração própria entrou na fase, e a restrição de expediente vale só para o
agendamento público (nenhuma mudança na criação manual de consulta pela equipe interna).

Desenho final coincide com o previsto na seção 4: `tipos_atendimento` como catálogo por tenant
(molde de `biblioteca_condutas`), `expedientes_profissionais` como jornada semanal sem coluna
`ativo` (salvar substitui todas as faixas do profissional numa transação), e
`agenda_links_publicos.tipo_atendimento_id` opcional — sem tipo escolhido, a duração continua
editável/herdada como antes desta fase. `validarDisponibilidade` ganhou um parâmetro opcional
`contextoExpediente`, usado só pelo fluxo público (`criarSolicitacaoPublica`); o fluxo interno de
aprovação de solicitação (`aprovarSolicitacao`) não passa esse parâmetro, preservando o
comportamento atual, conforme a decisão registrada na seção 3.

No frontend, o componente novo `ConfiguracaoExpediente` resolve sozinho se o usuário logado é
`Professional` (jornada própria, sem seletor de profissional) ou um papel tenant-wide
(`SuperAdmin`/`Collaborator`, que escolhe o profissional numa lista) — mesma lógica de
`resolverProfissionalIdDoUsuario` já usada no backend (`bloqueios-manuais`), replicada no cliente
via `obterSessao().papel` para decidir quando mostrar o seletor.

Arquivos principais:

- Backend: `1720000001052-CriarExpedientesETiposAtendimento.ts` (+ `.spec.ts`), 2 ORMs novos
  (`tipo-atendimento.orm.ts`, `expediente-profissional.orm.ts`), coluna nova em
  `agenda-link-publico.orm.ts`, `dtos.ts` (4 DTOs novos), `servico-tipos-atendimento.ts` (+
  `.spec.ts`, novo), `servico-expedientes.ts` (+ `.spec.ts`, novo),
  `servico-agendamento-publico.ts` (+ `.spec.ts`), `controlador-agenda.ts` (+ `.spec.ts`, 5 rotas
  novas), `modulo-agenda.ts`, `opcoes-typeorm.ts`.
- Frontend: `configuracao-expediente.tsx` (novo), `app/api/agenda/expediente/route.ts` (novo BFF),
  `app/api/agenda/tipos-atendimento/route.ts` e `[tipoId]/route.ts` (novos BFF),
  `agendamento-publico-api.ts`, `agenda-api.ts`, `agendamento-publico-bff.ts` (server), as duas
  rotas BFF existentes de `agendamento-publico` (passam `tipoAtendimentoId`), `painel-agenda.tsx`.
- Docs: `MAPA_ROTAS_PERMISSOES.md` (rotas novas), `TESTES_E_VALIDACOES.md` (specs recentes),
  `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `STATUS_ATUAL_PROJETO.md`.

Validações executadas (evidência do mesmo ciclo, 2026-09-23):

- `pnpm --dir octaclin-backend test src/modulos/agenda` — PASS (16 suítes, 189 testes).
- `pnpm --dir octaclin-backend test:migracoes-fora-de-banda` — PASS (13/13, via script na raiz do
  repositório).
- `pnpm --dir octaclin-backend typecheck` — PASS.
- `pnpm --dir octaclin-backend build` — PASS (`dist/main.js` validado).
- `pnpm --dir octaclin-web typecheck` — PASS.
- `pnpm --dir octaclin-web lint` — PASS (0 erros; warnings pré-existentes do mesmo padrão do
  projeto — `set-state-in-effect` — presentes também no componente novo, não bloqueiam).
- `pnpm --dir octaclin-web build` — PASS, rotas `/api/agenda/expediente`,
  `/api/agenda/tipos-atendimento` e `/api/agenda/tipos-atendimento/[tipoId]` presentes no build.
- `pnpm --dir octaclin-web test:authz` — PASS (15 scripts encadeados, exit 0), incluindo
  `test-agendamento-publico-bff.mjs`, que cobre a rota de rotação de link alterada nesta fase.
- Playwright (desktop-chromium): `race-condition-agenda.spec.mjs` (1/1),
  `console-regression.spec.mjs -g "agenda"` (5/5, sem novo erro de console apesar dos fetches novos
  do componente `ConfiguracaoExpediente` não mockados nesses cenários — falham silenciosamente com
  aviso na tela, sem exceção não tratada), `agendamento-publico.spec.mjs` (3/3, incluindo o cenário
  de rotação de link).
- `git diff --check` — PASS.
- `pnpm security:secrets` — PASS (nenhum secret identificado).

Gap conhecido e não coberto nesta fase: não existe suíte Playwright dedicada à tela nova de
configuração de expediente/tipos de atendimento em si (só a regressão dos fluxos existentes que a
tela nova não quebra) — validado por typecheck/lint/build e pelas specs de serviço
(`servico-expedientes.spec.ts`, `servico-tipos-atendimento.spec.ts`), não por E2E dedicado.

Aplicação fora de banda da migration em staging/produção **não executada** nesta fase — fica com o
proprietário, conforme a política registrada na seção 2 e no `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
PR ainda não aberta.
