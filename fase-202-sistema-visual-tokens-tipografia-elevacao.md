# Fase 202 - Sistema visual: tokens, tipografia e elevacao

Status: concluida em 2026-08-02. Implementacao local mais lint, typecheck,
build, gate de acessibilidade e regressao funcional do portal do cliente
todos aprovados.

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
- `pnpm --dir octaclin-web test:a11y` (`tests/visual/acessibilidade.spec.mjs`,
  inclui gate de contraste AA nas rotas criticas — login, dashboard, agenda
  interna, portal do paciente, portal do cliente, desktop e mobile): 10/10
  aprovados. Cobre a sidebar escura, a barra lateral de status e o anel de
  foco novos.
- `playwright test tests/visual/portal-cliente.spec.mjs` (regressao
  funcional/DOM do portal do cliente, nao screenshot-diff): 8/8 aprovados.
