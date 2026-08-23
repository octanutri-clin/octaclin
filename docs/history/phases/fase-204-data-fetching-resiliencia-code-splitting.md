# Fase 204 - Data fetching, resiliencia e code splitting

Status: concluida (escopo de resiliencia) em 2026-08-03, em 2 rodadas. O
padrao central (hook compartilhado de cancelamento) foi extraido, validado
com teste de race condition, e agora esta aplicado em todo loader com risco
real de sobreposicao de requisicoes: `portal-cliente.tsx` (5 loaders),
`agenda-semanal.tsx` (feed), `painel-operacoes.tsx` (9 loaders / 7 endpoints)
e `portal-paciente.tsx` (detalhe de formulario respondido).
`error.tsx`/`loading.tsx`, os 2 `Suspense` com fallback nulo e o estado
derivado mais simples (`painel-comunicacoes.tsx`) tambem foram resolvidos.
`next/dynamic` no portal do paciente e a conversao para Server Components
seguem fora de escopo — ver "Nao feito" abaixo, motivo mantido.

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

## Rodada 2 (2026-08-03)

- `lib/operacoes-api.ts`: 7 funcoes de leitura ganharam `opcoes?: { signal?:
  AbortSignal }` (`carregarDadosOperacionais`, `carregarAlertasOperacionais`,
  `carregarAuditoriaOperacionalPaginada`, `carregarFalhasOutboxPaginadas`,
  `carregarFalhasComunicacao`, `carregarSolicitacoesLgpd`,
  `carregarSolicitacoesAssinatura`, `carregarRetencaoDadosOperacional`,
  `obterDetalheSolicitacaoLgpd`).
- `painel-operacoes.tsx`: 9 funcoes de carregamento migradas para
  `useRequisicaoCancelavel`, agrupadas por 7 instancias de hook por recurso
  (dados base, auditoria, outbox, falhas de comunicacao, assinatura, lgpd,
  detalhe lgpd) — funcoes de filtro e paginacao do mesmo recurso
  compartilham a mesma instancia porque disputam a mesma secao de estado
  (ex.: clicar "proxima pagina" duas vezes rapido antes da 1a resolver).
- `portal-paciente.tsx` + `lib/portal-api.ts`: `obterFormularioRespondidoPaciente`
  ganhou `signal`; `abrirFormularioRespondido` (abre detalhe ao clicar num
  formulario respondido da lista) migrado — clicar em dois formularios
  diferentes em sequencia rapida podia deixar a resposta mais lenta
  sobrescrever a mais recente.
- `painel-comunicacoes.tsx`: nao migrado. Seu unico fetch de dados
  (`carregarBootstrapComunicacoes`, em `carregar()`) roda uma vez no mount
  via `useEffect([])` sem re-trigger possivel por interacao do usuario —
  sem risco real de corrida, migrar seria diff sem mudanca de comportamento.
- `portal-contexto.tsx` (`usePortalPaciente`): mesmo caso —
  `obterPortalPaciente()` roda uma vez no mount, chamado de novo apenas de
  forma sequencial (await) apos mutacoes (desmarcar consulta etc.), nunca
  concorrente.
- Nao ha teste visual dedicado a `painel-operacoes.tsx` no repo (rota
  `/operacoes` so aparece coberta indiretamente em `console-regression.spec.mjs`
  para LGPD/assinatura); a migracao foi validada por lint/typecheck/build e
  pela suite completa sem regressao, mas sem teste de race condition
  especifico como o de `agenda-semanal.tsx`.

## Nao feito (mantido fora de escopo)

- `next/dynamic` por secao no portal do paciente: a premissa do diagnostico
  ("aplicar next/dynamic por secao") pressupoe secoes ja separadas em
  arquivos; `portal-paciente.tsx` e um unico componente de 1448 linhas, entao
  o trabalho real e extrair 9 subcomponentes antes de poder fazer dynamic
  import — um refactor maior do que o item da lista sugere.
  Bundle da rota `/portal/perfil` nao foi medido.
  Nenhum monolito foi convertido para Server Component.
- Estado derivado de `agenda-semanal.tsx:profissionalId` (selecao padrao de
  profissional) nao foi convertido — esta entrelacado com o efeito de feed
  que ja foi migrado; misturar as duas mudancas no mesmo efeito aumentava o
  risco sem necessidade.

## Validacao local

### Rodada 1
- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.
- `pnpm --dir octaclin-web build`: aprovado.
- `pnpm --dir octaclin-web test:a11y`: 10/10 aprovados.
- `playwright test` em `jornadas-criticas`, `agendamento-publico`,
  `console-regression`, `questionarios-editor`, `portal-cliente`,
  `portal-paciente`, `race-condition-agenda`: 90/90 aprovados.

### Rodada 2
- `pnpm --dir octaclin-web lint`: aprovado.
- `pnpm --dir octaclin-web typecheck`: aprovado.
- `pnpm --dir octaclin-web build`: aprovado.
- `pnpm --dir octaclin-web test:a11y`: 10/10 aprovados.
- `playwright test` na mesma suite da rodada 1: 90/90 aprovados, sem
  regressao.
