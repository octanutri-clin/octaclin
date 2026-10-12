# Checklist executável — Fase 315

Fonte: [PLANO_FASE_315.md](../docs/history/phases/PLANO_FASE_315.md).
Alvo de tarefas desta rodada; planos antigos preservados. Execução iniciada
após autorização do proprietário (“Pode seguir”).

- [x] T00 — Base, inventário e gaps documentados.
- [x] D01 — PATCH legado validado sem gravar; retirar das respostas/CSV e preservar coluna, confirmado pelo proprietário.
- [x] Autorização de implementação da Fase 315 recebida.

## T01 — Contrato HTTP e escrita legado (3–4 arquivos) — CONCLUÍDO

Dependências: D01 + autorização. Arquivos: DTOs, `servico-pacientes.ts`, seu
spec e `pipe-validacao-http.spec.ts`. Antes do código, escrever testes.

Aceite: comportamento D01 com pipe real; inválidos rejeitados; PATCH misto
preserva valor legado não-zero; no-op não chama `save` nem altera `atualizadoEm`
e executa no escopo do tenant/permissão existente. Manter validação global.
Verificação: suíte focada PASS, 98/98 testes após incluir PATCH misto.

## T02 — Projeções e CSV (mesmos arquivos centrais; sequencial) — CONCLUÍDO

Dependência: T01. Seguir D01 aprovada. Aceite: ausência real
do campo em todas as respostas e no CSV; cabeçalho/linhas alinhados, filtros,
paginação e CSV seguro preservados. Objetos aninhados de prontuário testados.
Verificação: suíte de pacientes PASS; cabeçalho CSV exato, sem campo legado e
linha com a mesma quantidade de colunas.

Checkpoint C01: contrato HTTP, serviço e CSV coerentes, sem tocar prioridade,
ORM/schema ou autorização. Não iniciar limpeza de fixtures com contrato indefinido.

## T03 — Web e clientes locais (3 arquivos) — CONCLUÍDO

Dependência: T02. `lib/cadastros-api.ts`, `scripts/smoke-e2e-bff.mjs`,
`scripts/e2e-staging-mutavel.mjs`. Aceite: tipos refletem saída D01; clientes
atuais não enviam legado; nenhuma dependência UI nova. Não executar script
de staging contra banco externo. Verificação: Web typecheck + smoke local.

## T04 — Paridade do demo (2–3 arquivos) — CONCLUÍDO

Dependências: T01–T03. `octaclin-backend/scripts/api-demo-local.mjs` e
testes locais proporcionais. Aceite: valor legado no PATCH validado no mesmo intervalo do contrato;
projeções não vazam por objeto cru/spread; listagem/detalhe/PATCH/criação e
exportação, se atendida pelo demo, concordam com backend. Verificação:
`pnpm --dir octaclin-web smoke:e2e:bff` com servidores demo locais; teste
de regressão do payload misto e legado não-zero exclusivamente sintético.

## T05 — Fixtures e domínio (subtarefas de no máximo 5 arquivos) — CONCLUÍDO

Dependência: T02–T04. Dividir pelos grupos do inventário: visual cadastro,
visual console, visual portal/jornadas, seeds e smoke, domínio isolado.
Aceite: fixtures de resposta seguem D01; histórico ORM não-zero mantido;
asserções negativas preservadas. Reconfirmar consumidores antes de remover
propriedade do domínio. Seeds não reescrevem histórico ou recebem DDL.
Verificação: `rg` com revisão humana por categoria; typechecks e Playwright
dos cenários alterados, desktop/mobile, incluindo reflow e acessibilidade.

Checkpoint C02: smoke local PASS; distinção fixture ORM versus resposta
conferida; busca residual só encontra itens justificados.

## T06 — História, autorização e prioridade (subtarefas por superfície) — PARCIAL

Dependência: T01–T05. Specs de pacientes, dashboard, integrações/portal,
prioridade e PostgreSQL descartável. Aceite: valores históricos intactos em
PATCH normal/legado e operações concorrentes; tenant/carteira/revogação
negativos; PG com role runtime adequada prova isolamento e persistência.
Nenhum mock substitui prova de armazenamento. RLS existente preservado.
Não criar lock/idempotência novos para um simples PATCH sem requisito.

Prioridade calculada, override, filtros e automação não dependem de valor
legado; público sem legado/prioridade; portal sem legado. Antropometria
gestacional/pediátrica/adulta e snapshots sem recálculo.
Verificação: RLS/PostgreSQL descartável PASS (31/31); suíte Web `test:authz`
PARCIAL/CANCELADA após longa execução, com grupos relevantes executados
antes da interrupção. Smoke BFF sintético PASS. Não afirmar autorização integral.

## T07 — Regressão final e governança — PARCIAL

Dependência: T06. Backend/Web typecheck e build, lint disponível, unitários
relevantes e Playwright das fixtures alteradas PASS; Demo local smoke
reproduzível PASS; diff sem DDL fora do escopo. Testes de antropometria,
prioridade/dashboard/painel, portal, `/v1`, importação e arquivamento preservados.
Verificação: Node local 24.19.0/pnpm 11.19.0 (manifestos declaram Node 22 e
pnpm 11.25.0); typecheck/build/lint/unitários/Playwright e `git diff --check`
PASS. Reexecutar `pnpm security:secrets` antes da PR. Lint terminou sem erros,
com 65 avisos preexistentes do repositório. Um teste Playwright expirou em
execução concorrida/compilação local e passou isoladamente ao ser repetido.

Checkpoint C03: registrar PASS/FAIL/SKIPPED/NA com resultados reais; separar
checks de base, de implementação e operacionais. Revisão R4 independente
quando viável, com identificação; autor não se declara independente.

## T08 — Handoff e PR única de implementação — EM ANDAMENTO

Dependência: T07. Atualizar plano/checklist/status com contrato D01 efetivo,
compatibilidade, rollback e limites; abrir uma única PR Draft após as
verificações locais finais e acompanhar CI. Sem merge, deploy, migrations
externas ou ativação automática. Sem DROP da coluna. Produção exige resolver
monitor de saúde e autorização operacional.

## Registro de execução

- Backend focado: PASS, 2 suítes/98 testes; a execução completa anterior
  passou com 2652 testes e 54 ignorados, três suítes ignoradas. O teste novo
  foi executado na suíte focada após essa execução completa.
- Web typecheck/build: PASS; lint: PASS com avisos preexistentes.
- RLS em PostgreSQL descartável: PASS, 31/31.
- Demo BFF local: PASS no build local, com configuração BFF explícita; smoke
  cobre criação, PATCH misto, leitura, PATCH apenas legado sem timestamp alterado
  e rejeição de valor inválido. Dados sintéticos.
- Playwright: cenários alterados e foco de regressão passaram; os dois casos
  que expiraram em execução ampla passaram quando repetidos isoladamente.
- `octaclin-web test:authz`: PARCIAL/CANCELADO manualmente por execução
  prolongada; não contar como aprovação da suíte integral.
- CI remota da PR: pendente; revisão R4 independente: SKIPPED.
- Uma tentativa usando `next dev` expirou depois nos endpoints de revisão de IA;
  repetição integral em `next start` com variáveis BFF locais passou. Nenhuma
  migration, consulta a bancos externos, merge ou deploy foi realizada.

## Etapa futura fora desta entrega

- [ ] Comprovar consumidores externos/versões suportadas e encerrar PATCH legado.
- [ ] Decidir retenção e eventual remoção física com nova migration/rollback,
  ensaio descartável e autorização; não editar migration inicial.
- [ ] Resolver gates científicos/jurídicos da 314 em trilha própria.
