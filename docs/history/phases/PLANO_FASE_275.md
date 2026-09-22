# Fase 275 — Vínculo `consulta_id` nas entidades clínicas (PB-24)

## 1. Objetivo

Primeiro item da Onda 4 do audit de produto (estrutura). Fecha o gap já registrado três vezes nas
Fases 271/273/274 ("desde o último encontro" aproximado por data civil, sem vínculo formal de
consulta) e responde à pergunta que o audit cita como impossível hoje: "o que foi decidido na
consulta de 12/03" (`docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`, seção 6.B, linha 357).

## 2. Risco (R4 — migration)

Migration em quatro tabelas com dado clínico. Aditiva e reversível (coluna nullable, sem backfill,
sem alterar coluna existente). Segue o mesmo padrão já usado em `documentos_emitidos.consulta_id`
(única entidade do produto com esse vínculo hoje): `uuid references agenda_consultas(id)`, sem
`not null`, sem FK composta por tenant — a validação de "mesmo tenant, mesmo paciente" fica no
backend (aplicação), não no banco, pelo mesmo motivo do precedente. A migration entra nesta PR,
mas a aplicação fora de banda em staging/produção com role owner fica com o proprietário, conforme
decisão registrada em `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` e `STATUS_ATUAL_PROJETO.md`.

Rollback: `alter table ... drop column consulta_id` nas quatro tabelas (down da migration). Coluna
nova e nullable, então nenhum dado existente é afetado pelo `up` nem precisa de reparo depois de um
`down`.

## 3. Escopo confirmado pelo proprietário (2026-09-22)

Vínculo opcional, sem introduzir o conceito de "consulta em andamento" (que exigiria redesenhar o
fluxo de atendimento — fora de escopo, mesma decisão já tomada nas Fases 271/274 para não abrir essa
frente). Cada uma das quatro telas de criação ganha um seletor **opcional** "Vincular a consulta",
listando as consultas recentes do paciente. Sem seleção, o registro fica sem vínculo, como hoje.

## 4. Entidades e ponto de inserção real (lido no código antes de codar)

| Entidade (audit) | Tabela | Coluna nova | Onde a consulta_id é aceita hoje |
| --- | --- | --- | --- |
| Evolução | `evolucoes_clinicas` | `consulta_id` | `ServicoPacientes.criarEvolucaoClinica` |
| Avaliação | `avaliacoes_antropometricas` | `consulta_id` | `ServicoPacientes.registrarAvaliacaoAntropometrica` |
| Conduta | `condutas_terapeuticas_versoes` | `consulta_id` | `ServicoCondutasTerapeuticas.criarVersao` (chamado por `criar` e `criarNovaVersao`) |
| Exame | `coletas_exames_laboratoriais` | `consulta_id` | `ServicoExamesLaboratoriais.criar` |

Gap real encontrado na leitura: `condutas_terapeuticas_versoes` não tem `paciente_id` próprio (só
via `conduta_terapeutica_id` → `condutas_terapeuticas.paciente_id`). A validação de "consulta
pertence ao mesmo paciente" para conduta precisa buscar o paciente da conduta pai, não da versão.

Nenhuma das quatro tabelas tem hoje uma forma de listar "consultas recentes do paciente" exposta ao
frontend — `obterProntuario` já busca até 30 consultas do paciente
(`AgendaConsultaOrm`, `servico-pacientes.ts:944-948`) para a linha do tempo, mas não expõe essa lista
crua. Esta fase adiciona uma rota nova e focada,
`GET /pacientes/:id/consultas-recentes`, em vez de estender `/agenda/consultas` (que hoje não
filtra por paciente e serve a visão de calendário do profissional, escopo diferente).

## 5. Validação de integridade (aplicação, não banco)

Ao aceitar `consultaId` em qualquer uma das quatro rotas de criação: buscar a consulta por
`tenantId` (implícito pelo `executorTenant`) e `id`; se não existir ou o `pacienteId` da consulta
não bater com o paciente do registro sendo criado, rejeitar com o mesmo padrão 404 (não 403) já
usado em `/planos-alimentares/modelos` e `/evolucoes/modelos` — não confirmar a um profissional sem
escopo que a consulta existe.

## 6. Fora de escopo (gaps que continuam)

- "Consulta em andamento" como conceito de UX — decisão de produto própria, não é consequência
  natural do PB-24.
- Backfill de `consulta_id` em registros já existentes — sem correlação confiável retroativa; a
  fase entrega só o vínculo daqui para frente.
- PB-17 (catálogo de marcadores), PB-18/PB-19 (agenda) e PB-10 (busca protegida) — próximos itens da
  Onda 4, cada um com sua própria fase.

## 7. Validações planejadas

- Specs da migration (padrão dos precedentes: captura do SQL via `QueryRunner.query` mockado).
- Specs de serviço: aceitar `consultaId` válido (mesmo paciente/tenant); rejeitar consulta de outro
  paciente ou inexistente (404); e criação sem `consultaId` continua idêntica a hoje (regressão).
- `pnpm --dir octaclin-backend typecheck` / `build`.
- `pnpm --dir octaclin-web typecheck` / `lint` / `build`.
- Playwright do prontuário (`console-regression.spec.mjs -g "prontuario do paciente"`) cobrindo o
  seletor novo, sem regredir os cenários existentes.
- `git diff --check`, `pnpm security:secrets`.

## 8. Entregue (2026-09-22)

Escopo do plano implementado sem desvio. Dois pontos de leitura antes de codar que não estavam
explícitos acima, encontrados no código real:

- `ServicoCondutasTerapeuticas.criarNovaVersao` (revisão de uma conduta já publicada) também aceita
  `consultaId` opcional, além de `criar` (primeira versão) — o plano já previa isso na tabela da
  seção 4, mas o controller não tinha corpo de requisição nesse endpoint; foi adicionado
  `NovaVersaoCondutaTerapeuticaDto` (só `consultaId?`) para cobrir esse caso sem tocar
  `AtualizarRascunhoCondutaTerapeuticaDto`, que segue sem o campo (edição de rascunho não é criação).
- O seletor "Vincular a consulta" no formulário de conduta terapêutica só aparece na criação de uma
  conduta nova, não na edição de rascunho (`!editando`) — a ação "Nova versão" é um botão de uma
  etapa só, sem formulário próprio, então não ganhou o seletor nesta fase (ficaria fora do escopo
  mínimo de "quatro telas de criação" que o proprietário confirmou).

Arquivos principais:

- Backend: `1720000001051-AdicionarConsultaIdEntidadesClinicas.ts` (+ `.spec.ts`), 4 ORMs
  (`evolucao-clinica`, `avaliacao-antropometrica`, `conduta-terapeutica-versao`,
  `coleta-exame-laboratorial`), `vinculo-consulta.ts` (+ `.spec.ts`), `dtos.ts`,
  `servico-pacientes.ts`, `servico-condutas-terapeuticas.ts`, `servico-exames-laboratoriais.ts`,
  `controlador-pacientes.ts`, `controlador-condutas-terapeuticas.ts`.
- Frontend: `seletor-consulta-recente.tsx` (novo, reutilizado nas 4 telas),
  `app/api/pacientes/[id]/consultas-recentes/route.ts` (novo BFF), `lib/prontuario-api.ts`,
  `lib/condutas-terapeuticas-api.ts`, `lib/exames-laboratoriais-api.ts`,
  `aba-antropometria.tsx`, `aba-condutas-terapeuticas.tsx`, `aba-exames-laboratoriais.tsx`,
  `prontuario-paciente.tsx`.
- Docs: `MAPA_ROTAS_PERMISSOES.md` (rota nova), `TESTES_E_VALIDACOES.md` (specs recentes),
  `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `STATUS_ATUAL_PROJETO.md`.

Validações executadas (evidência do mesmo ciclo, 2026-09-22):

- `pnpm --dir octaclin-backend test --runInBand vinculo-consulta.spec.ts servico-pacientes.spec.ts servico-condutas-terapeuticas.spec.ts servico-exames-laboratoriais.spec.ts 1720000001051-AdicionarConsultaIdEntidadesClinicas.spec.ts` — PASS (10 + 83 + 8 + 8 + 10 testes).
- `pnpm --dir octaclin-backend test --runInBand src/modulos/pacientes` — PASS (386/386, suíte completa do módulo).
- `pnpm --dir octaclin-backend typecheck` — PASS.
- `pnpm --dir octaclin-web typecheck` — PASS.
- `pnpm --dir octaclin-web lint` — PASS (0 erros; warnings pré-existentes de outro padrão do
  projeto, incluídos os do componente novo, não bloqueiam).
- `pnpm --dir octaclin-web build` — PASS, rota `/api/pacientes/[id]/consultas-recentes` presente no
  build.
- `pnpm --dir octaclin-web test:authz` — PASS (15 scripts encadeados, exit 0).
- Playwright `console-regression.spec.mjs -g "prontuario do paciente"` (desktop-chromium) — PASS
  (37/37), incluindo o orçamento de endpoints da aba Resumo (o fetch novo é lazy, só ocorre quando
  um formulário com o seletor é aberto) e os cenários de evolução/antropometria/conduta já
  existentes, sem regressão.
- `git diff --check` — PASS (sem problema de espaço em branco).
- `pnpm security:secrets` — PASS (nenhum secret identificado).

Gap conhecido e não coberto nesta fase (pré-existente, não introduzido por ela): a aba de exames
laboratoriais não tem suíte Playwright própria no repositório — o seletor ali foi validado por
typecheck/build/lint e pela spec de serviço (`servico-exames-laboratoriais.spec.ts`), não por E2E.

Aplicação fora de banda da migration em staging/produção **não executada** nesta fase — fica com o
proprietário, conforme a política registrada nas seções 2 e no `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
PR ainda não aberta.
