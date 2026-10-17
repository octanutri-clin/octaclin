# FOOD02 — checklist

Base `95e9f33d`, PR424 integrada. [Plano/contratos](plan-pos-320-food02.md).
Branch `feat/pos320-food02-planejamento`, backend T01–T05 implementado; interface/BFF pendentes.

- [x] T00 — main/merge/CI conferidos; gaps e referências específicas examinados;
  D01–D03 confirmadas explicitamente pelo proprietário.
- [x] D01 — pessoal ou clínica, pessoal por padrão; criador edita/desativa.
- [x] D02 — por100g ou porção em gramas; ausente não vira zero.
- [x] D03 — preservar itens existentes, inclusive rascunhos.
- [x] Autorização: “Pode seguir, sol médio”; executar T01–T05 antes da troca.
- [x] T01 — normalização/DTOs em RED/GREEN:65 testes incluindo regressões de micros.
- [x] T02 — migration aditiva candidata1076, ORM, registro, RLS/FK/XOR.
- [x] T03 — serviço/controlador da biblioteca e pesquisa protegida.
- [x] T04 — aplicação/snapshots, medidas FOOD01 e todos os caminhos de save/cópia.
- [x] T05 — PostgreSQL real descartável, permissões, RLS, concorrência/revogação.
- [x] Checkpoint Sol: backendGREEN + handoff; pausar para troca manual a Luna alto.
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
- PASS backend:494 focados,3174 integrais (133 SKIPPED condicionais),
  34 PG/29 filtrados, typecheck/build/artefato; secrets/diff/matriz40 PASS.
- PENDING: T06–T08 e CI FOOD02 após troca manual de modelo.
- SKIPPED checkpoint: Web/BFF/Playwright, CI FOOD02, revisão independente e
  operações externas. Extensões Timescale/pgvector não entram no harness local.

FOOD01: merge não comprova aplicação externa da1075. Não reaplicar ou declarar
aplicada sem confirmação de ambiente/role/estado. FOOD02 não depende de TBCA,
Open Food Facts, câmera, nova rodada de IA nem dos classificadores314 bloqueados.

## Checkpoint backend

Evidências reais em [backend](../docs/governance/EVIDENCIAS_FOOD02_BACKEND_2026-10-17.md)
e [ledger](execucao-pos-320-food02.md). [Handoff Luna](handoff-pos-320-food02-luna.md)
contém os endpoints/DTOs e os campos editoriais implementados. Não replanejar
D01–D03, não iniciar FOOD03 e não reabrir pesquisa de todos os repositórios.
