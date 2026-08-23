# Fase 203 - Componentes compartilhados e fim dos sistemas paralelos

Status: quase concluida em 2026-08-03. Duas rodadas: a primeira entregou os
7 componentes novos, eliminou 2 dos 4 `window.confirm` e migrou os 13
badges ad hoc de `portal-paciente.tsx`. A segunda rodada eliminou os 2
`window.confirm` restantes, migrou os botoes ad hoc para uma fonte unica de
classes, adotou `Aviso`/`Metrica` nos pontos citados no diagnostico e
migrou os tooltips nativos para `Dica`. So falta quebrar as linhas de
1000+ caracteres de `painel-dashboard.tsx` (item cosmetico, sem criterio de
aceite funcional) e a adocao ampla de `CabecalhoSecao` nas ~30 telas do
diagnostico (fora do escopo critico da fase).

## Entregue (rodada 1, 2026-08-02)

- `ui/feedback.tsx`: `Aviso` (toast, `role="status" aria-live="polite"`) e
  `AvisoRegiao` (wrapper fixo, nao empurra layout).
- `ui/etiqueta.tsx`: `EtiquetaStatus<T>` generico (mapa `status -> {rotulo,
  variante}` fornecido pelo chamador).
- `ui/avatar.tsx`, `ui/dica.tsx`, `ui/menu.tsx`, `ui/cabecalho-secao.tsx`,
  `ui/metrica.tsx` (novos).
- `ui/tabela.tsx`: prop `densidade` (`padrao`/`compacta`).
- `painel-dashboard.tsx` e `painel-agenda.tsx`: 2 dos 4 `window.confirm`
  mecanicos migrados para `ModalConfirmacao`.
- `app/portal-shell.tsx`: menu de conta migrado de `<details>` para `Menu` +
  `Avatar`.
- `portal-paciente.tsx`: 13 badges ad hoc migrados para `Etiqueta`.

## Entregue (rodada 2, 2026-08-03)

- **Zero `window.confirm` no repo** (criterio de aceite cumprido). Os 2
  restantes eram guardas sincronas de navegacao:
  - `prontuario-paciente.tsx`: `confirmarSaidaComEvolucaoNaoSalva` removida;
    o `Link` "Voltar para pacientes" e a troca de aba so interceptam
    (`preventDefault`) quando ha evolucao nao salva, preservando o
    comportamento nativo do `Link` (clique do meio, nova aba) no caminho
    comum. `ModalConfirmacao` proprio ("Sair sem salvar").
  - `usar-workspace-questionarios.ts`: `confirmarTrocaComAlteracoesPendentes`
    virou estado `confirmacaoTrocaPendente` (acao adiada) exportado pelo
    hook; `editor-questionario.tsx` (unico consumidor) renderiza o
    `ModalConfirmacao`. `selecionarQuestionario`/`carregarPaginaQuestionarios`
    guardam via esse estado em vez de bloquear sincronamente.
  - Testes Playwright atualizados: `jornadas-criticas.spec.mjs`,
    `agendamento-publico.spec.mjs`, `console-regression.spec.mjs`,
    `questionarios-editor.spec.mjs` (dialog nativo -> clique no modal;
    seletor `summary[...]` do menu antigo -> `button[...]`).
- `ui/botao.tsx`: extraido `classesBotao({ variante, tamanho, className })`
  como fonte unica de verdade das classes do botao (usado pelo proprio
  `Botao` e por qualquer `<Link>`/`<a>` que precise do mesmo tratamento
  visual, ja que `Botao` renderiza `<button>` e nao pode virar link).
  Migrados: `LinkAcao` (`painel-dashboard.tsx`), `AtalhoShell`
  (`console-shell.tsx`) e os 8 links estilizados como botao de
  `portal-paciente.tsx` (alturas `h-9`/`min-h-11` divergentes unificadas).
- `Aviso`/`AvisoRegiao` adotados nos 3 blocos de sucesso inline citados no
  diagnostico (`painel-dashboard.tsx`, `painel-agenda.tsx`,
  `portal-paciente.tsx:599`) — viraram toast fixo em vez de empurrar layout.
- `Metrica` substituiu o `Indicador` local de `painel-dashboard.tsx` (5
  usos, com `numeros-tabulares` embutido).
- `Dica` substituiu os `title=` nativos interativos: botoes de navegacao de
  periodo e "Liberar horario" em `agenda-semanal.tsx`, `AtalhoShell` em
  `console-shell.tsx`. O chip decorativo do mes (nao interativo, sem
  `tabindex`) manteve `title=` nativo de proposito — nao faz sentido dar
  foco de teclado a um resumo visual sem acao.

## Nao feito (fora do escopo critico, sem risco de regressao conhecido)

- Quebrar as linhas de 1000+ caracteres de JSX em `painel-dashboard.tsx`:
  puramente cosmetico/legibilidade, sem criterio de aceite funcional
  associado. Fica para quando o arquivo for tocado por outro motivo.
- `CabecalhoSecao` nao foi adotado nas ~30 telas que o diagnostico lista
  (apenas criado); e um padrao repetido a mao, mas a adocao em massa e
  trabalho mecanico de alto volume melhor feito continuamente conforme cada
  tela for editada, nao de uma vez.
- `classeCampo` paralelo em `portal-paciente.tsx:93` (diverge de
  `ui/campo.tsx`) nao foi unificado.
- Overrides de foco locais em `campo.tsx`, `abas.tsx`, `modal.tsx`
  (pendencia ja registrada na Fase 202).

## Validacao local

- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.
- `pnpm --dir octaclin-web build`: aprovado.
- `pnpm --dir octaclin-web test:a11y`: 10/10 aprovados.
- `playwright test` em `jornadas-criticas`, `agendamento-publico`,
  `console-regression`, `questionarios-editor`, `portal-cliente`,
  `portal-paciente`: 88/88 aprovados.
