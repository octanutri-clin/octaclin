# FOOD02 — checklist

Base `95e9f33d`, PR424 integrada. [Plano/contratos](plan-pos-320-food02.md).
Branch `feat/pos320-food02-planejamento`, T01–T08 implementados; revisão R4 feita
e achados corrigidos por TDD. Draft PR #425 aberta; CI/scanners aguardando, sem
merge/deploy.

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
- [x] Checkpoint backend: GREEN + handoff; troca manual a Luna alto efetuada.
- [x] T06 — BFF/UI, cadastro pessoal/clínica, busca, CRUD/CAS e aplicação explícita.
- [x] T07 — Web/Playwright: desktop/mobile, autosave, composição parcial e Axe;
  regressão PA07 desktop19/19 e testes FOOD02 finais desktop4/4 + mobile4/4.
- [x] Regressões direcionadas de planos, BFF, origem e autorização; ver evidências.
- [x] Avisar/pausar para retorno ao Sol médio.
- [x] T08 — gates locais/documentação concluídos e Draft PR #425 aberta.
- [ ] CI/scanners do HEAD #425: aguardando na última consulta. Sem merge/deploy.

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
- PASS local: T06–T07; BFF52/52, helper/unit67/67, origem9/9, rotas30/30,
  combinado4/4, cópia10/10, Playwright FOOD02 2/2 e regressões dirigidas14/14;
  typecheck PASS. Build Web de produção, ESLint focal0 erros/8 avisos existentes,
  `git diff --check`, `pnpm security:secrets` e `pnpm test:security` PASS. Ver
  evidências Web/R4 para avisos e limites.
- PASS: revisão R4 estática independente feita; três achados Important corrigidos
  e cobertos por RED/GREEN local. Sem segunda revisão independente do patch.
- PASS: `pnpm test:authz` completo (27 scripts sequenciais), ESLint focal,
  typecheck/build Web e testes R4 desktop/mobile.
- PENDING: CI/scanners e revisão humana da PR Draft; migration1076 continua sem
  confirmação/aplicação externa.
- SKIPPED: suíte visual integral neste checkpoint; extensões
  Timescale/pgvector não entram no harness local.

FOOD01: merge não comprova aplicação externa da1075. Não reaplicar ou declarar
aplicada sem confirmação de ambiente/role/estado. FOOD02 não depende de TBCA,
Open Food Facts, câmera, nova rodada de IA nem dos classificadores314 bloqueados.

## Checkpoint backend

Evidências reais em [backend](../docs/governance/EVIDENCIAS_FOOD02_BACKEND_2026-10-17.md)
e [ledger](execucao-pos-320-food02.md). [Handoff Luna](handoff-pos-320-food02-luna.md)
contém os endpoints/DTOs e os campos editoriais implementados. Não replanejar
D01–D03, não iniciar FOOD03 e não reabrir pesquisa de todos os repositórios.
