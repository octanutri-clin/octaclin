# Fase 203 - Componentes compartilhados e fim dos sistemas paralelos

Status: parcialmente concluida em 2026-08-02. Os 7 componentes novos, a
eliminacao dos `window.confirm` mecanicos e a migracao dos 13 badges ad hoc
de `portal-paciente.tsx` estao prontos e validados. Migracao dos botoes
reimplementados a mao, adocao de `Aviso`/`CabecalhoSecao`/`Metrica` nas
demais telas e quebra das linhas de 1000+ caracteres do
`painel-dashboard.tsx` ficam para uma proxima rodada.

## Entregue

- `ui/feedback.tsx`: `Aviso` (toast, `role="status" aria-live="polite"`) e
  `AvisoRegiao` (wrapper fixo, nao empurra layout).
- `ui/etiqueta.tsx`: `EtiquetaStatus<T>` generico (mapa `status -> {rotulo,
  variante}` fornecido pelo chamador).
- `ui/avatar.tsx` (novo): iniciais sobre cor derivada de hash do id, sobre a
  paleta de tokens existente.
- `ui/dica.tsx` (novo): tooltip acessivel (hover + foco, sem atraso,
  `Escape` fecha, `role="tooltip"` + `aria-describedby`).
- `ui/menu.tsx` (novo): `Menu`/`ItemMenu` — dropdown com `role="menu"`,
  fecha ao clicar fora e no `Escape`.
- `ui/cabecalho-secao.tsx` (novo): padrao titulo+descricao+acoes.
- `ui/metrica.tsx` (novo): promove o padrao `Indicador` do
  `painel-dashboard.tsx`, com `numeros-tabulares` e delta opcional.
- `ui/tabela.tsx`: prop `densidade` (`padrao`/`compacta`) em
  `TabelaCabecalho`/`TabelaLinha`.
- `painel-dashboard.tsx` e `painel-agenda.tsx`: os 2 `window.confirm`
  mecanicos (`executar()` do dashboard, `rotacionarLink()` da agenda) agora
  usam `ModalConfirmacao`. Testes Playwright que dependiam do dialog nativo
  atualizados (`jornadas-criticas.spec.mjs`, `agendamento-publico.spec.mjs`,
  `console-regression.spec.mjs`).
- `app/portal-shell.tsx`: menu de conta migrado de `<details>` para `Menu` +
  `Avatar` (substitui o `UserRound` generico). Seletor de teste
  `summary[aria-label=...]` atualizado para `button[aria-label=...]`.
- `portal-paciente.tsx`: os 13 badges ad hoc (`<span className="rounded-full
  border border-linha bg-white ...">`) substituidos por `Etiqueta`.

## Nao feito nesta rodada (fica para a proxima)

- 2 `window.confirm` restantes sao guardas de navegacao sincronas
  (`prontuario-paciente.tsx:451` `confirmarSaidaComEvolucaoNaoSalva`,
  `usar-workspace-questionarios.ts:710` `confirmarTrocaComAlteracoesPendentes`).
  Converte-los para `ModalConfirmacao` exige trocar o fluxo de
  sincrono (`if (!confirmar()) return/preventDefault()`) para assincrono
  atraves de multiplos call sites e de um hook consumido por outro
  componente — risco real de regressao na protecao contra perda de dados
  endurecida nas Fases 193/194. Nao foi feito sem ler toda a cadeia de
  chamadas com calma. **Criterio de aceite "zero window.confirm no repo"
  ainda nao esta cumprido.**
- `LinkAcao` (`painel-dashboard.tsx:67`), `AtalhoShell`
  (`console-shell.tsx:66`) e os botoes ad hoc de `portal-paciente.tsx:629,
  651, 668, 688, 702` continuam reimplementando `Botao` a mao.
- `classeCampo` paralelo em `portal-paciente.tsx:93` (diverge de
  `ui/campo.tsx`) nao foi unificado.
- `Aviso`/`CabecalhoSecao`/`Metrica` foram criados mas ainda nao adotados
  nas ~30 telas que o diagnostico lista (blocos inline de
  `painel-dashboard.tsx:197`, `painel-agenda.tsx:498`,
  `portal-paciente.tsx:599`; o padrao titulo+descricao+acoes espalhado; o
  `Indicador` local do `painel-dashboard.tsx` continua em uso, nao foi
  trocado pelo `Metrica` novo).
- Tooltips `title=` nativos (`agenda-semanal.tsx:307,321,427`,
  `console-shell.tsx:64`) nao foram migrados para `Dica`.
- Linhas de 1000+ caracteres de JSX em `painel-dashboard.tsx` nao foram
  quebradas.
- Overrides de foco locais em `campo.tsx`, `abas.tsx`, `modal.tsx`
  (pendencia ja registrada na Fase 202).

## Validacao local

- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.
- `pnpm --dir octaclin-web build`: aprovado.
- `pnpm --dir octaclin-web test:a11y`: 10/10 aprovados.
- `playwright test tests/visual/jornadas-criticas.spec.mjs
  tests/visual/agendamento-publico.spec.mjs
  tests/visual/console-regression.spec.mjs`: 64/64 aprovados (2 regressoes
  encontradas e corrigidas nesta mesma rodada: dialog nativo esperado pelo
  teste onde agora ha modal; seletor `summary[...]` do menu de conta antigo).

## Pendente antes de marcar a fase como concluida

1. Decidir e implementar a conversao segura dos 2 `window.confirm` de guarda
   de navegacao (ou registrar formalmente como excecao aceita, ja que
   protegem contra perda de dados clinicos e o padrao assincrono de modal
   muda o contrato da funcao para todos os call sites).
2. Migrar `LinkAcao`, `AtalhoShell` e os botoes ad hoc de
   `portal-paciente.tsx` para `Botao`.
3. Adotar `Aviso`, `CabecalhoSecao` e `Metrica` nas telas listadas no
   diagnostico.
4. Migrar os `title=` nativos para `Dica`.
5. Quebrar as linhas de 1000+ caracteres de `painel-dashboard.tsx`.
