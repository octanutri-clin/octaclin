# Fase 244 - Quitacao da divida de dependencias do backend, web e ai-service

Status: concluida em 2026-08-19. Fase nao bloqueadora para o piloto: nenhuma
das mudancas abre capacidade nova de produto, todas reduzem divida acumulada de
dependencia.

## Objetivo

Zerar os PRs do Dependabot fora do Mobile, separados por causa e nao por pacote,
mantendo os 7 jobs verdes no merge de cada um. A origem e a triagem de
2026-08-18: quatorze PRs abertos, cinco do Mobile (Fase 243) e nove aqui.

## Incremento 1 - os quatro sem trabalho de compatibilidade

Concluido em 2026-08-19. Os quatro PRs ja passavam nos 7 jobs antes do merge e
nenhum exigiu mudanca de codigo:

| PR | Mudanca | Commit em `main` |
| --- | --- | --- |
| `#20` | `fastapi` 0.115.6 para 0.141.1 (`octaclin-ai-service`) | `7d666b0` |
| `#51` | `uvicorn[standard]` 0.32.1 para 0.52.3 (`octaclin-ai-service`) | `835aa50` |
| `#31` | `tailwind-merge` 2.6.1 para 3.6.0 (`octaclin-web`) | `8b4c07b` |
| `#28` | `@types/node` 22.20.1 para 26.2.0 (`octaclin-web`, dev) | `d09b522` |

Mergeados um de cada vez, com o `OctaClin CI` de `main` fechando verde antes do
merge seguinte, para que um job vermelho apontasse o pacote sem ambiguidade.

Dois conflitos apareceram e foram resolvidos por recriacao do PR pelo
Dependabot, nunca por auto-merge textual:

- `#51` ficou `CONFLICTING` no `requirements.txt` depois do `#20`, porque as
  duas linhas sao adjacentes. Rebase pelo Dependabot, CI 7/7 novamente verde
  sobre `7d666b0`, e so entao o merge.
- `#28` ficou `CLEAN` depois do `#31` por auto-merge do `pnpm-lock.yaml`, e
  ainda assim foi rebaseado de proposito. Lockfile resolvido linha a linha pelo
  git pode ficar coerente no texto e incoerente com o `package.json`, e a falha
  aparece so no `--frozen-lockfile` do CI, depois do merge. O rebase regenerou
  o lock e o CI rodou na arvore combinada antes do merge.

Validacao: `OctaClin CI` completo (`AI FastAPI`, `Backend NestJS`,
`Web Next.js`, `Mobile Expo`, `Operacao de lancamento`, `Rollout seguro` e
`Demo local smoke`) verde em cada PR e em cada commit de `main` do incremento.
Nenhum gate local foi executado nesta maquina: o incremento nao tem mudanca de
codigo para testar, e a evidencia e o CI.

Escopo consciente do que nao foi verificado: `octaclin-ai-service` nao esta
coberto pelo `Monitor producao`, que so observa `OCTACLIN_MONITOR_BACKEND_URL` e
`OCTACLIN_MONITOR_WEB_URL`. A saude do FastAPI e do uvicorn novos em producao,
se e quando o servico for publicado, precisa de verificacao propria.

## Incremento 2 - o que o TypeScript 6 realmente exigia

O incremento levou cinco PRs em vez de dois, e a razao vale mais que o
resultado: **enquanto existe um erro de configuracao, o `tsc` para ali e nunca
chega a checar os arquivos**. Cada correcao revelava a seguinte. O diagnostico
da triagem nao estava errado; estava vendo so o primeiro degrau.

A licao pratica, ja registrada em `AGENTS.md`: antes de afirmar que um bump de
compilador esta destravado, rode o compilador alvo localmente contra o
`node_modules` real. Um log de CI que mostra um erro mostra o primeiro, nao
todos.

Concluido em 2026-08-19, em dois PRs, porque o diagnostico da triagem estava
incompleto.

`bf3d660` (PR `#64`) tirou o `baseUrl` dos dois `tsconfig.json`. No backend era
configuracao morta: nao ha import nao relativo de `src/` em `src` nem em
`test`, e o jest resolve por `rootDir`. Na web o `paths` `@/*` passou a
resolver relativo ao proprio `tsconfig.json`, que e o comportamento do
compilador sem `baseUrl`. `ignoreDeprecations` foi descartado de proposito:
adia o mesmo trabalho para o TypeScript 7 e deixa o aviso ligado no meio-tempo.

Os PRs `#26` e `#34` continuaram vermelhos depois disso, com erros novos. A
causa do engano e um detalhe do compilador que vale registrar: **enquanto o
`TS5101` do `baseUrl` existia, o `tsc` parava na checagem de configuracao e
nunca chegava a checar os arquivos**. O log da triagem mostrava so o
`baseUrl` porque era so ate ali que o compilador ia.

`9809740` (PR `#67`) corrigiu os dois primeiros erros reais, um por projeto:

- Backend, 5372 erros `Cannot find name 'jest'` em todos os specs. O TypeScript
  6 deixou de incluir os pacotes `@types` automaticamente quando `types` nao e
  declarado. Reproduzido com `tsc 6.0.3` contra o `node_modules` da maquina:
  5373 erros sem `types`, 0 com `"types": ["jest", "node"]`. `typeRoots`
  explicito **nao** resolve, porque o que mudou e a inclusao automatica e nao a
  descoberta do diretorio.
- Web, um `TS2882` no import de efeito colateral de `./globals.css`. O
  TypeScript 6 verifica esses imports por padrao. Uma declaracao ambiente em
  `octaclin-web/tipos-estilos.d.ts` resolve e mantem a checagem ligada para os
  demais imports, que e o valor do aviso. Desligar
  `noUncheckedSideEffectImports` foi descartado pelo mesmo motivo do
  `ignoreDeprecations`.

`c930747` (PR `#68`) resolveu o terceiro, que so apareceu depois:
`TS5011`, o `rootDir` do emit deixou de ser inferido. O valor declarado e o
mesmo que ja era inferido, entao o layout do `dist` nao muda, e a mudanca vive
so no `tsconfig.build.json`.

Com isso o `#34` (TypeScript 6 no backend) fechou verde e entrou em `e60e7fd`.

`5f1199e` (PR `#69`) fez o lado da web, e substituiu o `#26` do Dependabot pelo
mesmo motivo do `cron-parser`: a versao e o codigo que ela obriga a mudar
precisam viajar juntos. O TS 6 quebrou o harness de testes em tres frentes:

- `TS5112`, passar arquivos na linha de comando com um `tsconfig.json` presente
  virou erro. Tres scripts ganharam `--ignoreConfig`, flag que **nao existe no
  TS 5.9** — e por isso nao podia entrar num PR anterior ao bump.
- `TS5107`, `moduleResolution=node10` depreciado nos 13 scripts que compilam
  codigo do app fora do projeto. Silenciado com `ignoreDeprecations: '6.0'`.
  Migrar para `node16` foi testado e **nao serve**: exige extensao explicita em
  import relativo (`TS2835`) e o codigo do app e escrito para resolucao de
  bundler. Levar o harness para ESM e trabalho de outra ordem e cabe a quem
  fizer o TypeScript 7, onde `node10` some. O `ignoreDeprecations` aqui e de
  harness de teste; o `tsconfig.json` do projeto continua limpo.
- `TS2591`/`TS2688`, a mesma perda de `@types` do backend. Nos configs
  temporarios, declarar `types` sozinho nao basta: eles vivem na pasta
  temporaria do sistema e a busca por `@types` parte dali. O `tsconfig.json` da
  web declara `types: ["node"]` e `typeRoots` relativo a si, e os temporarios
  herdam o caminho ja resolvido.

Validacao: `typecheck`, `lint` e `build` dos dois projetos, `test:authz` da web
com 7 scripts e 66 testes, `test:next15` com 94 arquivos,
`test:seguranca-operacional`, `test:seguranca-runtime`, suite do backend com 957
de 958 testes, e os 7 jobs do CI verdes em cada PR e em cada commit de `main`.
A unica falha local e `catalogo-taco.spec.ts`, a falha conhecida de CRLF em
checkout Windows.

## Incremento 3 - lib ES2022 no backend

Concluido em 2026-08-19, commit `10d99f5` (PR `#65`). O backend nao declarava
`lib` e herdava de `target: ES2021`, deixando `Array.prototype.at` fora da
biblioteca padrao e travando o `@types/node` 26 com `TS2550` em
`servico-pacientes.ts` e `servico-questionarios.ts`.

A verificacao que a fase pediu foi feita e o resultado e negativo, como se
queria: **o target emitido nao muda**. O `dist` foi reconstruido antes e depois
e comparado com `diff -r`; a unica diferenca e o `tsconfig.build.tsbuildinfo`,
que registra quais arquivos de lib o compilador carregou. Nenhum `.js` ou
`.d.ts` emitido mudou. O Node 22 do Dockerfile suporta ES2022, e `.at` existe
desde o Node 16.6.

Efeito colateral desejado: sem o `lib` herdado, o backend deixa de enxergar os
tipos de DOM, que nao tem uso num servico Node.

## Incremento 4 - cron-parser 5

Concluido em 2026-08-19, commit `3c3bebd` (PR `#66`), unica mudanca do lote com
efeito em runtime. Substituiu o PR `#35` do Dependabot, que sozinho subiria a
versao e deixaria a chamada quebrada.

Na ordem que a fase exigiu, o teste veio primeiro. O calculo do proximo envio
recorrente so era coberto de forma indireta: os testes existentes verificavam
*quem* recebe o envio, nunca *quando* cai o proximo. O teste fixa `0 8 * * 1`
em `America/Sao_Paulo`: processando em `2026-08-19T12:00Z`, o proximo disparo e
`2026-08-24T11:00:00Z`. Que ele mede o que diz medir foi verificado por
mutacao: trocando o fuso do parser por UTC na implementacao, ele falha acusando
`08:00Z` no lugar de `11:00Z`.

So entao a troca de API: `cronParser.parseExpression(...)` virou
`CronExpressionParser.parse(...)`. As opcoes `currentDate` e `tz` nao mudaram
de forma e `next().toDate()` continua existindo, e o teste passa igual antes e
depois. O `cron-parser@4.9.0` continua no lock porque o `bullmq` depende dele;
as duas versoes coexistem e so a dependencia direta do backend subiu.

Validacao: suite completa do backend com 957 de 958 testes (a falha e o
`catalogo-taco.spec.ts` de sempre), `typecheck`, `build`, e os 7 jobs verdes no
PR e em `main`.

## Criterio de conclusao da fase

Atendido em 2026-08-19. Nao ha PR do Dependabot aberto fora do Mobile, exceto o
`#27` (Next 16), que a propria triagem isolou na Fase 245. Os 7 jobs fecharam
verdes no merge de cada PR e em cada commit de `main`, e o comportamento de
agendamento recorrente esta coberto por teste com verificacao por mutacao.

Dois PRs do Dependabot foram substituidos por PRs proprios em vez de mergeados,
sempre pelo mesmo motivo: a versao e o codigo que ela obriga a mudar precisam
entrar no mesmo commit, ou `main` fica quebrada no intervalo. `#35` virou
`#66` (cron-parser) e `#26` virou `#69` (TypeScript 6 na web).

## Pendencias deixadas de proposito

- O `ignoreDeprecations: '6.0'` do harness de testes da web tem prazo: o
  TypeScript 7 remove `moduleResolution=node10`. Quem levar o projeto ao 7
  precisa migrar esses 13 scripts para ESM, e nao adiar de novo.
- O `octaclin-ai-service` nao esta no `Monitor producao`, que so observa
  `OCTACLIN_MONITOR_BACKEND_URL` e `OCTACLIN_MONITOR_WEB_URL`. FastAPI e uvicorn
  novos nao tem verificacao de saude em producao.
- A Fase 245 (Next 16) segue aberta e isolada, como a triagem decidiu.
