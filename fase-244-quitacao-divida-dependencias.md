# Fase 244 - Quitacao da divida de dependencias do backend, web e ai-service

Status: em execucao. Incremento 1 concluido em 2026-08-19. Fase nao bloqueadora
para o piloto: nenhuma das mudancas abre capacidade nova de produto, todas
reduzem divida acumulada de dependencia.

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

## Incrementos pendentes

- Incremento 2 - `baseUrl` depreciado travando o TypeScript 6 em `#26` (web) e
  `#34` (backend). Trocar por `paths` relativo ao proprio `tsconfig.json`, sem
  `ignoreDeprecations`.
- Incremento 3 - `lib` herdado de `target: ES2021` no backend derrubando
  `Array.prototype.at` e travando o `@types/node` 26 (`#36`).
- Incremento 4 - `cron-parser` 4 para 5 (`#35`), unica mudanca com efeito em
  runtime: a v5 removeu `parseExpression`, chamado em
  `servico-questionarios.ts`. Exige teste fixando o proximo disparo de
  questionario recorrente **antes** da troca de API.

## Criterio de conclusao da fase

Nenhum PR do Dependabot aberto fora do Mobile, com os 7 jobs verdes no merge de
cada um, e o comportamento de agendamento recorrente coberto por teste.
