# Checklist executável — Fase 315

Fonte: [PLANO_FASE_315.md](../docs/history/phases/PLANO_FASE_315.md).
Alvo de tarefas desta rodada; planos antigos preservados. Cada tarefa começa
pela releitura do diff e dos caminhos do inventário. Sem implementação nesta rodada.

- [x] T00 — Base, inventário e gaps documentados.
- [x] D01 — PATCH legado validado sem gravar; retirar das respostas/CSV e preservar coluna, confirmado pelo proprietário.
- [ ] Autorização de implementação da Fase 315 recebida.

## T01 — Contrato HTTP e escrita legado (3–4 arquivos)

Dependências: D01 + autorização. Arquivos: DTOs, `servico-pacientes.ts`, seu
spec e `pipe-validacao-http.spec.ts`. Antes do código, escrever testes.

Aceite: comportamento D01 com pipe real; inválidos/tenantId arbitrário
rejeitados sem mutação; PATCH misto preserva valor legado não-zero e atualiza
campos permitidos; no-op não contorna tenant/carteira. Manter validação global.
Verificação: `pnpm --dir octaclin-backend test --runInBand servico-pacientes.spec.ts pipe-validacao-http.spec.ts`.

## T02 — Projeções e CSV (mesmos arquivos centrais; sequencial)

Dependência: T01. Seguir D01 aprovada. Aceite: ausência real
do campo em todas as respostas e no CSV; cabeçalho/linhas alinhados, filtros,
paginação e CSV seguro preservados. Objetos aninhados de prontuário testados.
Verificação: suite de pacientes; acrescentar asserções completas de CSV.

Checkpoint C01: contrato HTTP, serviço e CSV coerentes, sem tocar prioridade,
ORM/schema ou autorização. Não iniciar limpeza de fixtures com contrato indefinido.

## T03 — Web e clientes locais (3 arquivos)

Dependência: T02. `lib/cadastros-api.ts`, `scripts/smoke-e2e-bff.mjs`,
`scripts/e2e-staging-mutavel.mjs`. Aceite: tipos refletem saída D01; clientes
atuais não enviam legado; nenhuma dependência UI nova. Não executar script
de staging contra banco externo. Verificação: Web typecheck + smoke local.

## T04 — Paridade do demo (2–3 arquivos)

Dependências: T01–T03. `octaclin-backend/scripts/api-demo-local.mjs` e
testes locais proporcionais. Aceite: entrada validada conforme contrato;
projeções não vazam por objeto cru/spread; listagem/detalhe/PATCH/criação e
exportação, se atendida pelo demo, concordam com backend. Verificação:
`pnpm --dir octaclin-web smoke:e2e:bff` com servidores demo locais; teste
de regressão do payload misto e legado não-zero exclusivamente sintético.

## T05 — Fixtures e domínio (subtarefas de no máximo 5 arquivos)

Dependência: T02–T04. Dividir pelos grupos do inventário: visual cadastro,
visual console, visual portal/jornadas, seeds e smoke, domínio isolado.
Aceite: fixtures de resposta seguem D01; histórico ORM não-zero mantido;
asserções negativas preservadas. Reconfirmar consumidores antes de remover
propriedade do domínio. Seeds não reescrevem histórico ou recebem DDL.
Verificação: `rg` com revisão humana por categoria; typechecks e Playwright
dos cenários alterados, desktop/mobile, incluindo reflow e acessibilidade.

Checkpoint C02: smoke local PASS; distinção fixture ORM versus resposta
conferida; busca residual só encontra itens justificados.

## T06 — História, autorização e prioridade (subtarefas por superfície)

Dependência: T01–T05. Specs de pacientes, dashboard, integrações/portal,
prioridade e PostgreSQL descartável. Aceite: valores históricos intactos em
PATCH normal/legado e operações concorrentes; tenant/carteira/revogação
negativos; PG com role runtime adequada prova isolamento e persistência.
Nenhum mock substitui prova de armazenamento. RLS existente preservado.
Não criar lock/idempotência novos para um simples PATCH sem requisito.

Prioridade calculada, override, filtros e automação não dependem de valor
legado; público sem legado/prioridade; portal sem legado. Antropometria
gestacional/pediátrica/adulta e snapshots sem recálculo.
Verificação: suites focadas existentes + `pnpm --dir octaclin-backend test:rls:testcontainers`,
somente PG descartável, `pnpm --dir octaclin-web test:authz`. Ampliar teste
integrado só se a cobertura atual não provar a propriedade relevante.

## T07 — Regressão final e governança

Dependência: T06. Aceite: backend/Web typecheck/build, lint disponível,
unitários relevantes e Playwright das fixtures alteradas PASS; Demo local smoke
reproduzível; diff sem runtime/DDL fora do escopo. Testes de antropometria,
prioridade/dashboard/painel, portal, `/v1`, importação e arquivamento preservados.
Verificação: scripts reais dos manifests; Node 22/pnpm 11.25.0 declarados;
`git diff --check` e `pnpm security:secrets`; não inventar script lint ausente.

Checkpoint C03: registrar PASS/FAIL/SKIPPED/NA com resultados reais; separar
checks de base, de implementação e operacionais. Revisão R4 independente
quando viável, com identificação; autor não se declara independente.

## T08 — Handoff e PR única de implementação

Dependência: T07. Atualizar plano/checklist/status com contrato D01 efetivo,
compatibilidade, rollback e limites. Abrir uma PR da entrega após autorização,
acompanhar/corrigir CI do HEAD. Preferir integrar planejamento na mesma PR.
Sem merge, deploy, migrations externas ou ativação automática. Sem DROP da
coluna. Produção exige resolver monitor de saúde e autorização operacional.

## Etapa futura fora desta entrega

- [ ] Comprovar consumidores externos/versões suportadas e encerrar PATCH legado.
- [ ] Decidir retenção e eventual remoção física com nova migration/rollback,
  ensaio descartável e autorização; não editar migration inicial.
- [ ] Resolver gates científicos/jurídicos da 314 em trilha própria.
