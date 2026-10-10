# Execução — Fase 313

Implementação não iniciada. R4. Uma branch/PR, um escritor por vez.
Contrato: [PLANO_FASE_313.md](../docs/history/phases/PLANO_FASE_313.md).
Handoff: [plan.md](plan.md). Arquivos novos abaixo são **planejados**.

## Gates antes de código

- [x] Reconciliar merge 312/Git/CI e preservar seus gates residuais.
- [x] Inspecionar contratos backend, Web, portal, autorização e histórico.
- [x] Fechar perguntas de produto com o proprietário.
- [x] Preparar fonte, tabela, exemplos e ficha clínica para revisão.
- [ ] G01: obter confirmação detalhada da [ficha clínica](../docs/product/FICHA_VALIDACAO_CLINICA_FASE_313.md).
- [ ] G02: autorização para implementação (autorização atual é planejamento).

T01/T02 dependem de G01. Trabalhos independentes de schema/contrato podem ser
iniciados após G02, mantendo classificador e faixa bloqueados até G01.
Modelo recomendado para o conjunto: GPT-6.1 Sol médio. Não trocar automaticamente.

## Sequência de tarefas

Prefixos: B = `octaclin-backend/src/modulos/pacientes`, W = `octaclin-web`,
DB = `octaclin-backend/src/infraestrutura/banco-dados`.
Cada tarefa indica até cinco arquivos principais; separar subpassos quando
registro/integração/testes aumentarem esse número. Começar por teste falhando
para comportamento/contrato/schema; não marcar PASS sem executar.

### T01 — Referência clínica pura (depende G01/G02)

- [ ] Criar B/dominio/referencia-gestacional-ms.ts e .spec.ts; constantes
  offline versionadas, quatro grupos e 31 semanas.
- Aceite: transcrição igual à ficha aprovada; cortes inclusivos, sem dados de
  pacientes, código de calculadora externa ou faixas derivadas de resumo.
- Evidência: Jest focado; exemplos revisados independentemente da função.

### T02 — Cálculo e bloqueios adultos (depende T01)

- [ ] Criar B/dominio/antropometria-gestacional.ts e .spec.ts; alterar
  B/dominio/antropometria.ts e .spec.ts.
- Aceite: aplicabilidade e todos os motivos; condição não depende de sexo;
  negativos válidos; precisão decimal; adulto não gestante sem regressão;
  gestante preserva medidas e não recebe interpretações/composição adulta.
- Não arredondar IMC/ganho antes de decidir; fonte/dados efetivos no resultado.

### T03 — Migration aditiva e registro (depende G02)

- [ ] Criar DB/migracoes/1720000001068-AcompanhamentoGestacional.ts e .spec.ts;
  registrar em DB/opcoes-typeorm.ts e inventário operacional aplicável.
- Reconfirmar número livre. Três tabelas: episódios, referências imutáveis,
  consentimentos específicos; FKs compostas/RLS/índices e ligação nullable
  das avaliações. Proteger snapshots novos, não modificar registros antigos.
- Aceite: migration registrada; up/down vazio e down recusado com dados;
  runtime sem owner/DDL; nenhum backfill nem aplicação externa nesta etapa.

### T04 — ORM e providers (depende T03)

- [ ] Criar B/infraestrutura/gestacao-paciente.orm.ts,
  referencia-gestacao.orm.ts, consentimento-gestacao.orm.ts; alterar
  avaliacao-antropometrica.orm.ts e módulo de pacientes existente.
- Aceite: criptografia de campos clínicos, composição das chaves igual ao SQL,
  entidades registradas; nunca devolver entidade ORM bruta.

### T05 — Serviço de episódios e referências (depende T04)

- [ ] Criar B/aplicacao/servico-gestacoes-paciente.ts e .spec.ts;
  B/aplicacao/dtos-gestacoes.ts; extrair helper de escopo paciente apenas se
  necessário, com respectivo teste em subpasso próprio.
- Aceite: abrir/encerrar/reabrir, versão esperada/409, referência nova imutável,
  autorização tenant/carteira, replay UUID idêntico e diferente; encerrado não
  aceita registros/referência e não retira liberação; auditoria sem conteúdo.

### T06 — API profissional (depende T05)

- [ ] Criar B/apresentacao/controlador-gestacoes-paciente.ts e .spec.ts;
  integrar módulo; teste negativo de guardas/permissões.
- Aceite: ler/gerenciar por método, parâmetros UUID/paginação limitados,
  tenant servidor, serviço revalida escopo; status/errors mínimos e seguros.

### T07 — Snapshot por avaliação (depende T02/T05)

- [ ] Alterar B/aplicacao/dtos.ts, servico-pacientes.ts e .spec.ts;
  B/infraestrutura/avaliacao-antropometrica.orm.ts somente se integração exigir.
- Aceite: condição explícita/legado, confirmação da divergência, data civil,
  idade servidor, contexto cifrado, chave replay, referência esperada/409,
  lock do episódio e vínculo. Sem episódio salva factual sem faixa; com
  episódio encerrado nega. Nenhuma recalculação retroativa.

### T08 — Leitura por episódio e séries (depende T07)

- [ ] Criar B/dominio/acompanhamento-gestacional.ts e .spec.ts;
  integrar servico-gestacoes-paciente.ts e .spec.ts, DTO de projeção.
- Aceite: cursor estável, exclusão/JSON ilegível, fonte histórica; versões
  separadas, todas as páginas recuperáveis; faixas só do backend; não alterar
  deltas genéricos nem usar janela global de 100 avaliações como cobertura.

### T09 — Compartilhamento e consentimento (depende T05/T08)

- [ ] Criar B/aplicacao/servico-portal-gestacoes.ts e .spec.ts;
  integrar método de liberação no serviço de episódios e seus testes.
- Aceite: liberação atual+futura confirmada, aceite desligado, retirada gera
  invalidade de aceite antigo; nova liberação exige novo aceite; revogação
  paciente só própria; binding de usuário atual e termo/geração conferidos.
- Invites genéricos antes do aceite, sem medidas. Não publicar contexto no
  resumo atual do portal por efeito colateral.

### T10 — API portal e projeção (depende T09)

- [ ] Criar B/apresentacao/controlador-portal-gestacoes.ts e .spec.ts;
  integrar módulo e contrato de resumo apenas se convite genérico precisar.
- Aceite: identidade do portal existente, paciente derivado tenant+usuário,
  nenhuma seleção arbitrária; allowlist sem notas; revalidar vínculo/dupla
  autorização em toda página/detalhe; outro paciente/tenant nunca exposto.

### T11 — BFF profissional e cliente (depende T06/T07/T08)

- [ ] Criar W/lib/gestacoes-paciente-api.ts e família
  W/app/api/pacientes/[id]/gestacoes; separar subpassos de até cinco rotas.
- [ ] Integrar W/lib/prontuario-api.ts e BFF de avaliações já existente.
- Aceite: wrappers existentes, permissão por método, origem validada,
  `private, no-store` inclusive erros; corpo/UUID/cursor limitados; sem token
  no browser. Harness planejado W/scripts/test-fase-313-bff.mjs em test:authz.

### T12 — UI profissional (depende T11)

- [ ] Criar W/components/pacientes/gestacoes-paciente.tsx,
  formulario-gestacao.tsx e formulario-contexto-gestacional.tsx; integrar
  aba-antropometria.tsx e tipos.
- Aceite: abrir/encerrar/reabrir/referência, condição/divergência, confirmação
  de base nova e liberação atual/futura; estados sem faixa, raw measures,
  limpar paciente/episódio e ignorar requests anteriores; sem algoritmo
  clínico duplicado. Guardar UUID ao recuperar falha de entrega incerta.

### T13 — Gráfico/tabela compartilhado (depende T08/T12)

- [ ] Criar W/components/pacientes/grafico-gestacional.tsx e integrá-lo à UI;
  teste visual em W/tests/visual/fase-313-gestacoes.spec.mjs.
- Aceite: eixo gestacional, seleção por versão/episódio, pontos iguais
  preservados, tabela acessível, texto além de cor, idade original e semana
  aplicada, “carregar mais”/cobertura parcial. Não ligar séries diferentes.

### T14 — BFF/cliente portal (depende T10)

- [ ] Criar família W/app/api/portal/gestacoes em subpassos de até cinco
  arquivos; integrar W/lib/portal-api.ts e harness BFF da 313.
- Ajustar prefixo às rotas de portal reais. Aceite: mesmas proteções cache/
  origem, role paciente, vínculo/consentimento no backend; erros seguros.

### T15 — Portal consentimento e acompanhamento (depende T13/T14)

- [ ] Criar W/components/portal/acompanhamento-gestacional-portal.tsx e
  integrá-lo a portal-paciente.tsx; visual específico no spec da fase.
- Aceite: convite genérico, aceite específico/revogação, gráfico autorizado,
  limpar conteúdo ao revogar/recuperar foco/perder acesso, sem notas; desktop/
  mobile e axe. Nenhum Cache Storage/localStorage clínico ou canal externo.

### T16 — Provas PostgreSQL reais (depende T03–T10)

- [ ] Criar B/aplicacao/gestacoes-paciente.integracao.spec.ts;
  integrar DB/rls-isolamento-tenant.integracao.spec.ts e harness Testcontainers.
- Aceite: runtime não owner, FORCE RLS, tenant/carteira/binding, FK cross-patient,
  referência/snapshot imutáveis, rollback vazio/recusa, replay concorrente no
  serviço, referência editada contra gravação, encerrar contra gravação,
  transferência de responsável e liberação/revogação contra leitura.
- Provar serialização em transações reais; mocks não encerram esses gates.

### T17 — Demo, regressão e governança (depende T11–T16)

- [ ] Atualizar octaclin-backend/scripts/api-demo-local.mjs com fixtures
  sintéticas e endpoints reais; W/tests/visual/console-regression.spec.mjs
  somente mocks impactados; harness/authz, matriz acessibilidade e confiabilidade.
- Aceite: Demo local smoke, Backend NestJS e Governança passam na mesma PR;
  testes da 313 executados pelo CI, não apenas arquivos criados sem registro.

### T18 — Revisão, evidências e rollout (depende T17)

- [ ] Atualizar status/checklist/roadmap/handoff com PASS/FAIL/NA/SKIPPED.
- [ ] Revisão R4 independente quando viável; registrar limite se ausente.
- [ ] PR única de implementação; acompanhar CI e corrigir falhas antes do merge.
- [ ] Planejar rollout fora de banda, com alvo/role/owner explícitos. Migration
  externa e saúde de produção só com autorização/evidência própria.

## Comandos de evidência futura (não executados no planejamento)

Na raiz, Node 22/pnpm 11.25.0. Não usar produção para testes mutáveis.

```sh
pnpm --dir octaclin-backend test --runInBand antropometria
pnpm --dir octaclin-backend test --runInBand gestacoes
pnpm --dir octaclin-backend test:rls:testcontainers
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/fase-313-gestacoes.spec.mjs --reporter=list
pnpm --dir octaclin-web smoke:e2e:bff
pnpm test:confiabilidade
pnpm test:a11y:matriz
pnpm test:migracoes-fora-de-banda
pnpm test:guardas-controladores
pnpm security:secrets
git diff --check
```

Confirmar execução explícita do spec de integração novo no harness PostgreSQL;
comando “gestacoes” pode não selecionar todos os nomes no singular. Nome de
arquivo/teste criado não é PASS. Registrar contagem/skips e ambiente de cada
prova; não inferir deploy, validação clínica ou saúde de produção de CI.
