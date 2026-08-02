# Fase 202 - Sistema visual: tokens, tipografia e elevacao

Status: implementacao concluida localmente em 2026-08-02; regressao visual
Playwright pendente de execucao e revisao manual antes do fechamento formal
da fase.

## Entregue

- `app/globals.css`: camada de CSS variables semanticas (`--superficie-base`,
  `--linha-base`, `--texto-corpo`, `--anel-foco`), foco unico em anel duplo
  (offset + halo, substitui o outline solido anterior), `tabular-nums` +
  fonte monoespacada para `table`/`time`/`.numeros-tabulares`, e
  `prefers-reduced-motion`.
- `tailwind.config.ts`: escala tipografica com entrelinha corrigida
  (xs/sm/md/base/lg/xl/2xl, mantendo os nomes de classe existentes), escala
  de raio 6/8/12/16, sombras em duas camadas tingidas com a tinta
  (`shadow-sm`, `shadow-lg`, `shadow-cartao`), espacamentos semanticos
  (`campo`, `cartao`, `secao`) e escala neutra completa (`neutro-50..950`).
- Tipografia: troca de Figtree + Noto Sans para IBM Plex Sans (corpo e
  titulos) + IBM Plex Mono (dados tabulares), decisao confirmada pelo
  usuario.
- `ui/cartao.tsx`: borda trocada por `shadow-cartao`; titulo `text-sm` para
  `text-md`; padding `p-4` para `p-cartao` (20px).
- `app/portal-shell.tsx`: sidebar da variante `sidebar` em `bg-neutro-900`;
  item de navegacao ativo com barra indicadora de 3px em vez do fundo quase
  identico ao hover.
- `ui/botao.tsx`: prop `tamanho` (sm/md/lg), prop `carregando` (spinner +
  `aria-busy` + `disabled`), transicao com propriedades explicitas e
  `active:translate-y-px`.
- `agenda/agenda-semanal.tsx`: `classeConsulta` cobre os cinco status do
  dominio (agendada, reagendada, concluida, falta, cancelada) com barra
  lateral de 3px por status, substituindo o esquema de duas cores.

## Nao feito nesta fase (fora do escopo dos 8 itens do diagnostico)

- Remocao dos overrides de foco locais em `campo.tsx`, `abas.tsx`,
  `modal.tsx` (globals.css agora define o anel unico; esses arquivos ainda
  nao foram migrados) — considerar na Fase 203, que ja mexe nesses
  componentes.
- Escala completa de tons de `primaria` (apenas `neutro` ganhou escala
  completa; nada no escopo desta fase consome tons adicionais de primaria).
- Dark mode: nao fazer agora (ver diagnostico, Anexo A).

## Validacao local

- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.
- `pnpm --dir octaclin-web build`: aprovado.
- Regressao visual Playwright (`tests/visual/portal-cliente.spec.mjs`): ainda
  nao executada nesta sessao; diagnostico avisa que a suite vai acusar diff
  em praticamente todas as telas por causa da troca de token — esperado, mas
  exige revisao manual antes de fechar a fase.
- Contraste AA dos pares de cor novos (sidebar escura, barra de status,
  anel de foco): nao verificado automaticamente nesta sessao.

## Pendente antes de marcar a fase como concluida

1. Rodar `pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list`,
   revisar os diffs manualmente e atualizar os baselines aprovados.
2. Verificar contraste AA (sidebar escura x texto, barra de status x fundo,
   anel de foco) com `ecc:a11y-architect` ou ferramenta equivalente.
3. Rodar `pnpm --dir octaclin-web test:a11y`.
