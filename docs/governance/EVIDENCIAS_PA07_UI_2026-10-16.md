# Evidências PA07 — T04 interface

Data: 2026-10-16. Worktree `pos320-pa07-planejamento`, base local do checkpoint
T02/T03 `7a9a00e1`. Dados de teste inteiramente sintéticos. Nenhuma API de
produção, banco externo, migration ou funcionalidade de portal foi usada.

## Implementado

- Aviso acessível para consulta em outra aba, espera de transferência, falha de
  reconferência e coordenação indisponível. A interface não anuncia posse até
  o hook confirmar o estado.
- Ação “Editar nesta aba” com proteção contra clique repetido e sem habilitação
  otimista. A outra aba só fica editável após confirmação e leitura autorizada
  da versão salva.
- Reconferência exige “Recarregar rascunho”; valores locais permanecem até a
  confirmação explícita de descarte/releitura. Não há save automático no fluxo.
- Autosave mostra “pausado nesta aba” sem posse. ON/OFF, expansão/recolhimento,
  seleção/cálculo e navegação permanecem separados da posse editorial.
- Ações editoriais (save, revisão/publicação, arquivo, nova versão, adicionar,
  remover, duplicar, mover/arrastar, modelos/cópia/receitas) ficam bloqueadas
  quando a aba está em consulta. Drag and drop também fica desativado; expandir
  e recolher permanece disponível.

## RED/GREEN e verificações

- RED observado antes da interface: o novo cenário não encontrou a mensagem de
  consulta na segunda aba; o primeiro seletor por `role=status` era ambíguo por
  causa de três regiões preexistentes. O teste foi corrigido para localizar a
  mensagem específica, mantendo a condição funcional que faltava.
- GREEN: `E2E_WEB_URL=http://localhost:3317 E2E_REUSE_EXISTING_SERVER=true
  node node_modules/@playwright/test/cli.js test
  tests/visual/pa07-coordenacao-abas.spec.mjs --reporter=line --timeout=90000`
  — **6/6 PASS**, desktop Chromium e mobile Chromium: consulta sem autosave,
  conteúdo local preservado, ação por teclado, posse só após reconferência,
  leitura do texto salvo na aba retomada e falha sintética bloqueando edição.
- Axe: scan WCAG 2.1 AA escopado a `[data-pa07-aviso]`, sem violações, executado
  nos cenários de retomada e de falha.
- `node node_modules/typescript/bin/tsc --noEmit` — PASS (exit 0).
- `node node_modules/eslint/bin/eslint.js components/pacientes/aviso-edicao-abas-plano.tsx components/pacientes/refeicao-ordenavel.tsx components/pacientes/plano-alimentar-profissional.tsx`
  — PASS (exit 0, 0 errors, 8 warnings existentes no editor central; a nova
  UI não acrescentou avisos).
- `node scripts/test-nutricao-plano.mjs` — 59/59 PASS.
- `git diff --check` — PASS.

O servidor local foi iniciado nesta worktree com Next webpack por causa do
symlink de `node_modules`; foi encerrado depois dos testes. O runner inicial
com Turbopack falhou ao rejeitar o symlink fora da raiz; isso é limitação do
ambiente local, contornada pelo comando webpack acima. `next-env.d.ts` gerado
foi restaurado e não integra o diff.

## Limites e itens abertos

- Não foram executados T05–T07: transferência com envio em voo, suite ampla
  PA02–PA06, authz/BFF integral, PostgreSQL/RLS/CAS descartável, builds completos,
  CI do HEAD e revisão independente.
- A inspeção identificou um ponto para Sol/T05: o diálogo explícito de recarga
  encerra `coordenadorEdicaoRef` e relê o plano, enquanto o hook depende de
  paciente/plano/habilitação para criar o coordenador. T05 precisa reproduzir e
  corrigir/validar a reinicialização e retomada após `reconferir`; não considerar
  recuperado até esse caminho passar.
- Teste UI cobre falha de reconferência e bloqueio seguro; o teste completo de
  recuperação pós recarga permanece pendente. A interface não contém lógica de
  concorrência nem faz de mensagens locais uma autoridade de escrita.
- Sem PR neste checkpoint. A PA07 permanece não liberada para disponibilização.
