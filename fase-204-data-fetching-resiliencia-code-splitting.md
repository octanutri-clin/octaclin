# Fase 204 - Data fetching, resiliencia e code splitting

Status: parcialmente concluida em 2026-08-03. O padrao central (hook
compartilhado de cancelamento) foi extraido, validado com teste de race
condition e aplicado em 2 dos 5 monolitos apontados pelo diagnostico
(`portal-cliente.tsx` de ponta a ponta, `agenda-semanal.tsx` no efeito de
feed). `error.tsx`/`loading.tsx`, os 2 `Suspense` com fallback nulo e o
estado derivado mais simples (`painel-comunicacoes.tsx`) tambem foram
resolvidos. Os monolitos maiores (`painel-operacoes.tsx`,
`painel-comunicacoes.tsx`, `portal-paciente.tsx`) e o code splitting do
portal do paciente ficam para proxima rodada.

## Entregue

- `lib/hooks.ts` (novo): `useRequisicaoCancelavel()` — extrai o padrao
  `AbortController` + contador de sequencia de `painel-dashboard.tsx:89-147`
  (ja provado no repo). Retorna a funcao `iniciar` diretamente (nao um
  objeto novo a cada render — ver "Bug corrigido" abaixo).
- `portal-cliente.tsx`: os 5 loaders citados no diagnostico
  (`carregarUsuarios`, `carregarConvites`, `carregarHistoricoConvites`,
  `carregarConfiguracoes`, `carregarPerfilEmpresa`) migrados para o hook,
  cada um com sua propria instancia (recursos independentes nao podem se
  cancelar entre si). `lib/cliente-api.ts`: as 5 funcoes correspondentes
  ganharam `signal` opcional para cancelamento real.
- `agenda-semanal.tsx`: o efeito de feed (que "chegava perto" com uma flag
  `cancelado` mas nao cancelava o fetch de fato) migrado para o hook, com
  cancelamento real. `lib/agenda-api.ts`: `listarFeedAgenda` ganhou `signal`
  opcional.
- `painel-comunicacoes.tsx`: removidos 2 dos 3 `useEffect` que calculavam
  estado derivado (`conversaSelecionadaId` — que ja tinha um memo
  equivalente e mais correto convivendo com o efeito redundante;
  `pacienteAssociacaoId` — virou variavel derivada
  `pacienteAssociacaoIdEfetivo`). O terceiro (`formularioMensagem.templateId`)
  e um padrao diferente (autocorrecao de campo invalido, nao "escolher o
  primeiro item") e foi deixado como esta.
- `app/error.tsx` e `app/loading.tsx` (novos, na raiz): cobrem todas as
  rotas via cascata de error boundary do App Router, sem precisar de um
  arquivo por rota.
- `app/agenda/page.tsx` e `app/pacientes/page.tsx`: `Suspense
  fallback={null}` trocado por `<EsqueletoPagina>`.
- `painel-operacoes.tsx:675,682` e `editor-questionario.tsx:29`: comentarios
  de justificativa adicionados aos `eslint-disable-next-line
  react-hooks/exhaustive-deps` (as funcoes omitidas nao sao `useCallback`;
  incluir causaria loop).
- `tests/visual/race-condition-agenda.spec.mjs` (novo): teste do criterio
  de aceite — troca rapida de profissional na agenda, resposta atrasada do
  profissional anterior nao sobrescreve a mais recente.

## Bug corrigido durante a rodada

O hook inicial retornava `{ iniciar }` — um objeto novo a cada render.
Usar esse objeto em array de dependencia (como fiz em
`agenda-semanal.tsx` e nos `useCallback` de `portal-cliente.tsx`) causava
loop: o efeito/callback via uma dependencia "nova" a cada render e
reexecutava sem parar, abortando e refazendo a requisicao continuamente.
O proprio teste de race condition pegou isso (a requisicao nunca
assentava). Corrigido fazendo o hook retornar `iniciar` diretamente
(ja estavel via `useCallback`), sem wrapper.

## Nao feito nesta rodada

- `painel-operacoes.tsx` (~15 funcoes de carregamento) e
  `painel-comunicacoes.tsx`/`portal-paciente.tsx` (parcialmente) nao
  migraram para o hook compartilhado. Sao os maiores arquivos do bloco
  (1244-1513 linhas) e migrar todas as funcoes de carregamento de cada um
  e um volume de trabalho mecanico grande demais para uma rodada; melhor
  feito arquivo por arquivo conforme a Fase 214 (refatoracao dos
  monolitos) os tocar de qualquer forma.
- `next/dynamic` por secao no portal do paciente: a premissa do diagnostico
  ("aplicar next/dynamic por secao") pressupoe secoes ja separadas em
  arquivos; `portal-paciente.tsx` e um unico componente de 1448 linhas, entao
  o trabalho real e extrair 9 subcomponentes antes de poder fazer dynamic
  import — um refactor maior do que o item da lista sugere.
  Bundle da rota `/portal/perfil` nao foi medido.
  Nenhum monolito foi convertido para Server Component.
- Estado derivado de `agenda-semanal.tsx:profissionalId` (selecao padrao de
  profissional) nao foi convertido — esta entrelacado com o efeito de feed
  que ja foi migrado nesta rodada; misturar as duas mudancas no mesmo
  efeito aumentava o risco sem necessidade.

## Validacao local

- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.
- `pnpm --dir octaclin-web build`: aprovado.
- `pnpm --dir octaclin-web test:a11y`: 10/10 aprovados.
- `playwright test` em `jornadas-criticas`, `agendamento-publico`,
  `console-regression`, `questionarios-editor`, `portal-cliente`,
  `portal-paciente`, `race-condition-agenda`: 90/90 aprovados.
