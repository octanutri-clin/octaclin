# FOOD02 — checklist

Base `95e9f33d`, PR424 integrada. [Plano/contratos](plan-pos-320-food02.md).
Branch `feat/pos320-food02-planejamento`, apenas planejamento nesta etapa.

- [x] T00 — main/merge/CI conferidos; gaps e referências específicas examinados;
  D01–D03 confirmadas explicitamente pelo proprietário.
- [x] D01 — pessoal ou clínica, pessoal por padrão; criador edita/desativa.
- [x] D02 — por100g ou porção em gramas; ausente não vira zero.
- [x] D03 — preservar itens existentes, inclusive rascunhos.
- [ ] Autorização de implementação FOOD02 após consolidação.
- [ ] T01 — normalização/DTOs/contratos em RED/GREEN.
- [ ] T02 — migration aditiva candidata1076, ORM, registro, RLS/FK/XOR.
- [ ] T03 — serviço/controlador da biblioteca e pesquisa protegida.
- [ ] T04 — aplicação/snapshots, medidas FOOD01 e todos os caminhos de save/cópia.
- [ ] T05 — PostgreSQL real descartável, permissões, RLS, concorrência/revogação.
- [ ] Checkpoint Sol: backendGREEN + contratos/handoff; avisar/pausar para Luna alto.
- [ ] T06 — BFF/UI, cadastro e seleção explícitos, busca e CRUD.
- [ ] T07 — Web/Playwright/regressões, desktop/mobile e acessibilidade.
- [ ] Avisar/pausar para retorno ao Sol médio.
- [ ] T08 — revisão R4, documentação e PR única/CI final.

## Gates observados

- PASS baseline: PR424 MERGED `95e9f33d`; CI39029460553 do HEAD `faeb603b`
  SUCCESS, Demo/PR Gate incluídos; scanners SUCCESS.
- PASS análise: persistência custom ausente; catálogo global e DML revogado;
  snapshots, medidas, DTOs editoriais, copies e helpers HMAC examinados.
- PASS referências: somente os cinco IDs mapeados à FOOD02 triados; R047/R064
  lidos/pinados; nenhum pacote instalado ou código terceiro incorporado.
- PASS produto: D01–D03 respondidas com as três recomendações.
- PASS documental: cinco destinos locais dos links existentes (fragmentos não
  validados automaticamente), presença T00–T08, `git diff --check` e
  `pnpm security:secrets` sem achados. Não são testes de implementação.
- PENDING: autorização para iniciar implementação, checkpoint backend e gates FOOD02.
- SKIPPED: testes/builds/PG/CI FOOD02, revisão independente e operações externas;
  não fazem parte deste planejamento. CI anterior não os aprova.

FOOD01: merge não comprova aplicação externa da1075. Não reaplicar ou declarar
aplicada sem confirmação de ambiente/role/estado. FOOD02 não depende de TBCA,
Open Food Facts, câmera, nova rodada de IA nem dos classificadores314 bloqueados.
