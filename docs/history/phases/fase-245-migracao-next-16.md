# Fase 245 - Migracao do Next.js 15 para 16

Status: concluida em 2026-08-19, inclusive a validacao pos-deploy. Fase nao
bloqueadora do piloto, feita isolada, sem nenhum outro PR de dependencia junto,
como o gate exigia.

## O que a fase temia, e o que era de fato

A triagem levantou uma condicao que faria a fase crescer para uma migracao de
framework: se o Next 16 exigisse React 19, o `react@18.3.1` fixado teria que
subir junto e o escopo deixaria de caber num PR de dependencia.

A verificacao deu negativo. O Next 16.3.1 declara
`react: ^18.2.0 || ^19.0.0`, entao o React fixado continua servindo e a fase
seguiu como planejada.

## A decisao entre Turbopack e webpack

O Next 16 usa Turbopack por padrao no build e recusa um projeto que tem
configuracao `webpack` e nenhuma de `turbopack`:

```
ERROR: This build is using Turbopack, with a `webpack` config and no
`turbopack` config.
```

A fase pedia para decidir entre portar a configuracao para `turbopack` ou fixar
o builder webpack com `--webpack`. Nenhuma das duas foi necessaria: o bloco
`webpack()` do projeto fazia **uma coisa so**, apontar o alias `@` para a raiz
do frontend, e isso ja vem do `paths` do `tsconfig.json`, que os dois bundlers
leem nativamente. O bloco saiu inteiro, e o build passa sem nenhuma
configuracao de bundler.

Commit: `f4d92e9` (PR `#70`), que substituiu o `#27` do Dependabot.

## O gate test:next15 foi reavaliado, nao aposentado

O gate existe desde a Fase 142 para garantir `params`/`searchParams`
assincronos. O Next 16 **removeu de vez** o acesso sincrono, entao ele vale
mais agora, nao menos. O que nao servia era o nome, preso a uma major que
passou: virou `test:apis-dinamicas` no `package.json`, no job `Web Next.js` do
CI e na regra do `AGENTS.md`. As mencoes historicas no
`CHECKLIST_FASES_FUTURAS_PRODUCAO.md` ficaram como estao, porque descrevem o
que rodou na epoca e nao devem ser reescritas.

## O que ficou de proposito

- **`eslint-config-next` continua no 15.5.22.** O 16 exige ESLint 9 com flat
  config, e isso e migracao de lint, nao desta fase. As regras do 15 lintam
  codigo Next 16 sem falso positivo e o gate `lint` segue verde. Fica como
  trabalho separado, junto com o ESLint 9.
- **`tsconfig.json` e `next-env.d.ts` reescritos pelo proprio Next** no
  primeiro build, inclusive trocando `jsx` de `preserve` para `react-jsx` e
  expandindo a formatacao dos arrays. Mantido como ele escreveu, para nao
  brigar a cada build.

## Validacao

Gates locais, todos verdes com o Next 16 nesta maquina:

- `typecheck`, `lint` e `build` da web;
- `test:authz`, 7 scripts e 66 testes;
- `test:apis-dinamicas`, 94 arquivos;
- `test:seguranca-operacional` e `test:seguranca-runtime`;
- o smoke completo reproduzindo o job do CI, com a API demo e o `next start` no
  ar: `smoke-ui-regression` em 9 rotas, `smoke-e2e-bff`, e **Playwright com 178
  testes passando e 2 pulados**.

CI: os 7 jobs verdes no PR `#70` e no commit de `main`.

Um detalhe do caminho que vale registrar, porque quase virou diagnostico errado
de regressao do Next 16: o smoke local falhou primeiro com HTTP 500 no login, e
a causa era `OCTACLIN_API_ORIGENS_PERMITIDAS` ausente no meu ambiente, variavel
que `validarConfiguracaoSegurancaBff` exige em producao e que o CI define no
nivel do job. Reproduzir o smoke local exige o conjunto **completo** de
variaveis do job, nao so as que parecem relevantes.

## Deploy validado

O merge disparou o deploy no Render. Confirmei que producao passou a servir o
build novo comparando os nomes de chunk: o `04pezf8jvo61v.js` do build local
com Turbopack aparece igual em
`https://octaclin-web-producao.onrender.com/login`.

O `Monitor producao` foi disparado contra o deploy ja publicado, execucao
`32287204104`, e voltou **ok nos tres checks**:

```json
{"status":"ok","checks":{"readiness":{"status":"ok","latenciaMs":33239,"tentativa":1},"dependencias":{"status":"ok","latenciaMs":199,"tentativa":1},"web":{"status":"ok","latenciaMs":246,"tentativa":1}}}
```

Os 33 segundos de `readiness` sao o despertar do backend hibernado no Render, e
nao efeito da migracao: o Next 16 so mudou a web, cujo check respondeu em
246 ms.

## Pendencia que sobra

Nenhuma da migracao em si. Fica anotado, fora do escopo desta fase, que o
`eslint-config-next` continua no 15 ate alguem migrar o lint para ESLint 9 com
flat config.
