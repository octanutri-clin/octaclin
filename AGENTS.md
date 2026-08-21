# OctaClin - Guia para agentes de IA

Este arquivo e a primeira leitura obrigatoria para Codex, Claude Code ou qualquer outro agente de IA trabalhando neste repositorio.

## Leitura obrigatoria antes de alterar codigo

1. `RESUMO_FASES_CONCLUIDAS.md`
2. `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
3. `MATRIZ_SKILLS_PLUGINS_MODELOS_FASES_243_248_262.md` para as fases desse ciclo.
4. Os arquivos `fase-*.md` mais recentes relacionados ao trabalho atual.
5. `VARIAVEIS_AMBIENTE.md` se a tarefa tocar deploy, integracoes, secrets ou ambiente.
6. `RUNBOOK_PRODUCAO.md` se a tarefa tocar Render, Neon, Upstash, Gmail, Meta, Google Calendar ou operacao.
7. `DECISOES_ARQUITETURA.md` se a tarefa alterar arquitetura, seguranca, tenancy, auth, dados ou integracoes.
8. `ONBOARDING_DESENVOLVEDOR.md`, `COORDENACAO_DESENVOLVIMENTO_IA.md`, `PACOTE_PROXIMAS_FASES_DESENVOLVEDOR.md`, `DEVELOPMENT_LOG.md`, `RETORNO_APOS_DESENVOLVEDOR.md` e `FERRAMENTAS_E_PLUGINS_RECOMENDADOS.md` quando um novo desenvolvedor/agente entrar no projeto.

## Estado atual

- Produto: OctaClin.
- LiveClin foi apenas referencia de modelagem.
- Fase mais recente concluida: Fase 251 - revisao integral de linguagem e
  microcopy. `GUIA_VOZ_MICROCOPY.md` agora define a voz e o glossario, e o gate
  AST `pnpm --dir octaclin-web test:linguagem` protege texto visivel sem alterar
  contratos internos. Browser, Lighthouse e Playwright validaram desktop e
  celular. A proxima fase e a Fase 252 - arquitetura de navegacao e descoberta
  de funcionalidades. A Fase 250 encerrou a divida Mobile e
  higiene de PRs. Os dois advisories altos de `image-size` continuam sem patch,
  os gates locais passaram e o PR legado `#6` foi encerrado como superado. Nao
  restam PRs abertos; `mobile.sync=false` e o NO-GO de distribuicao permanecem.
  Fases 244 e 245 atualizaram as
  dependencias fora do Mobile e a web para Next.js 16 com Turbopack. A Fase
  201 recebeu a trava distribuida por tenant, mas continua pendente de worker
  dedicado no Render; o backend permanece em `OCTACLIN_PROCESSO=all` e nao
  pode escalar horizontalmente antes desse rollout. O proximo bloqueador de
  negocio e a Fase 233, primeiro piloto assistido. Antes dele, a sequencia de
  melhoria continua esta registrada nas Fases 250 a 262 e em
  `ROADMAP_QUALIDADE_SEGURANCA_FASES_248_262.md`; a Fase 243 foi antecipada
  como interrupcao de seguranca do Mobile, sem ativar o app. Essa interrupcao
  foi concluida em 2026-08-20: Expo 57 esta validado, mas dois avisos upstream
  sem patch e gates funcionais mantem o Mobile em NO-GO para distribuicao.
- Producao isolada foi aceita na Fase 131; backup/restore, observabilidade,
  smokes somente leitura dos quatro papeis, Gmail e Google Agenda foram
  validados nas Fases 219 a 222. Isso nao substitui dominio, identidade de
  envio, revisao juridica nem o aceite real da Fase 233.
- Melhoria continua: Fases 138, 141 e 142 atualizaram NestJS para 11.1.28 e
  TypeORM para 1.1.0; a Fase 245 atualizou a web para Next.js 16.3.1 com
  React 18.3.1 preservado. O shim de cookies BFF continua uma divida tecnica a
  reavaliar somente numa migracao dedicada para React 19.
- Fase 139 removeu `any` de codigo backend de producao e consolidou contratos de agenda/convites; preserve `requisitarBackendAutenticado` como a fronteira unica de erros BFF autenticados.
- Fase 140 introduziu `MATRIZ_CONFIABILIDADE_TESTES.md`; atualize a matriz e seu validador sempre que adicionar ou remover um fluxo de risco alto.
- Fase 142 introduziu o gate de APIs dinamicas assincronas, hoje `pnpm --dir octaclin-web test:apis-dinamicas` (chamava-se `test:next15` ate a Fase 245); toda nova rota dinamica deve receber `params`/`searchParams` assincronos e manter esse gate verde.
- O checklist vivo das proximas fases fica em `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
- Para as Fases 191 a 198 (bloco de redesenho), o mapeamento de skills/agentes/plugins do Claude Code a usar em cada fase fica em `ESCOPO_SKILLS_AGENTES_FASES_191_198.md`; leia-o ao revisar esse historico ou tocar as telas correspondentes.
- O repositorio e publico por decisao de custo do GitHub Actions. Antes de
  qualquer push, rode `pnpm security:secrets`; nunca publique dados clinicos,
  dumps, `.env`, URLs com senha ou logs de integracao. Secret Scanning e Push
  Protection estao ativos; uma deteccao exige rotacao, nao apenas remocao do
  arquivo.

## Regras de trabalho

- Trabalhe por fases numeradas.
- Nao pule fase sem decisao explicita do usuario.
- Ao concluir uma fase, crie ou atualize o arquivo `fase-XXX-*.md`.
- Ao concluir uma fase, atualize `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
- Ao concluir uma fase, informe no documento e na resposta final a proxima fase,
  o modelo, o nivel de raciocinio e as skills/plugins recomendados conforme
  `MATRIZ_SKILLS_PLUGINS_MODELOS_FASES_243_248_262.md`.
- Quando a fase consolidar uma capacidade do produto, atualize tambem `RESUMO_FASES_CONCLUIDAS.md`.
- Use commits pequenos e objetivos.
- Por padrao, faca push para `main` apos validar e commitar, pois o usuario pediu continuidade com GitHub como fonte de verdade.
- Se outro desenvolvedor ou agente estiver trabalhando na fase atual, aguarde ou combine escopo antes de alterar a mesma area.
- Um desenvolvedor/agente pode avancar por varias fases, desde que conclua cada fase com documentacao, validacao, commit e push antes de iniciar a proxima.
- Nunca reverta mudancas que voce nao fez sem pedido explicito.
- Nunca commite secrets, tokens, senhas, arquivos `.env` reais, dumps de banco ou logs com credenciais.
- Leia `## Erros ja cometidos neste repositorio` antes de afirmar qualquer coisa
  sobre producao, antes de dizer que um teste passou e antes de editar arquivos
  por script. Todo erro novo entra la, no formato descrito em
  `## Registro obrigatorio de erros novos`, no mesmo commit que o corrige.

## TDD e validacao

Para mudancas de produto ou bugfix:

1. Escreva teste primeiro.
2. Rode o teste e veja falhar pelo motivo esperado.
3. Implemente o minimo necessario.
4. Rode o teste novamente.
5. Rode validacoes de regressao proporcionais ao risco.

Validacoes comuns:

```powershell
pnpm --dir octaclin-backend test -- <specs> --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list
```

Em Windows, se `node`, `pnpm` ou `git` nao estiverem no PATH, procure os runtimes empacotados do Codex antes de desistir.

## Erros ja cometidos neste repositorio: nao repetir

Esta secao e obrigatoria, nao e referencia opcional. Cada item aqui custou tempo
de verdade. A regra que os cobre todos:

> **Nao conclua a partir de algo adjacente a evidencia. Conclua a partir da
> evidencia, com um comando no mesmo turno da afirmacao.**

Adjacente a evidencia significa: outro ambiente, um teste que passou por outro
motivo, um arquivo criado mas nao registrado, um numero lembrado, uma regra que
voce mesmo resumiu, um estado lido uma hora antes.

### 1. Nunca afirme sobre producao olhando a integracao

Producao conecta como `octaclin_app_producao`, **sem `CREATE` no schema
`public`**. A integracao conecta como `neondb_owner`, que tem. Por isso
`migrationsRun` no boot **nunca** consegue aplicar DDL em producao: falha com
`42501 permission denied for schema public` e o container sai com codigo 1.

Confira a identidade antes de qualquer frase ou comando sobre um banco. O trecho
abaixo e fail-closed: sem casar o padrao ele nao imprime nada, entao uma string
malformada nunca vaza.

```bash
v=$(sed 's/^DATABASE_URL=//' .env.producao)
if [[ "$v" =~ ^([a-z]+)://([^:@/]+):[^@]*@([^:/]+)(:[0-9]+)?/([^?]+) ]]; then
  echo "usuario : ${BASH_REMATCH[2]}"
  echo "host    : ***.${BASH_REMATCH[3]#*.}"
  echo "banco   : ${BASH_REMATCH[5]}"
else
  echo "NAO PARSEOU - nada sera impresso"
fi
```

Integracao e host `c-10`; producao e `c-12`. Nunca cole connection string no
chat: o usuario grava o arquivo, voce extrai so os identificadores.

### 2. Um teste que passa precisa passar pelo motivo declarado

Uma prova de constraint ja reportou os dois inserts como recusados — mas com
`08P01 invalid message format`, erro de protocolo que derrubou a conexao antes
de a constraint ser avaliada. A causa era `bytea` como literal no SQL. Quase
virou "provas ok" sem prova nenhuma.

Afirme o motivo, nao so o desfecho, e passe `bytea` como parametro:

```js
ok = erro.code === '23514' && erro.constraint === 'nome_do_check';
await cliente.query('insert ... values ($1)', [Buffer.from([0])]);
```

Ao adicionar teste-guarda, veja-o falhar primeiro e **leia a mensagem de falha**.

### 3. Nunca escreva "validado" sem nomear os gates

Liste os comandos que rodaram e o resultado de cada um. Gate pulado se declara
pulado; job `skipped` no CI e nao verificado, nao aprovado. Uma execucao parcial
declarada como validada ja mandou uma quebra para o `main`.

### 4. Criar o arquivo nao o registra

`opcoes-typeorm.ts` lista migrations num **array explicito**, nao num glob. A
migration `1032` foi mergeada com arquivo presente, spec proprio verde e 7 jobs
verdes — e `migration:run` jamais a aplicaria.

Depois de adicionar qualquer artefato, procure onde os irmaos dele sao
registrados:

```bash
grep -rn "NomeDoIrmaoAnterior" src --include=*.ts | grep -v spec
```

Vale para migrations, entidades ORM (tambem nos `modulo-*.ts`), rotas e DTOs.

**`expect.arrayContaining` nao detecta omissao.** Quando completude importa,
compare conjuntos com `toEqual`.

### 5. Numero em prosa vem de comando, nunca de lembranca

Antes de escrever qualquer afirmacao de impacto, conte:

```sql
select count(*) from tabela_afetada;
```

Ja afirmei em commit e PR que um backfill evitava perda silenciosa de dados, sem
ter contado as linhas. Eram zero.

### 6. Ordem de rollout de migration com DDL, cinco passos

Nunca reduza para tres. O passo 3 e o que pega erro.

1. backup aprovado com teste de restore, disparado **depois** da ultima migration
   aplicada, para o ponto de retorno cobrir o estado atual;
2. merge;
3. `migration:show` e `migration:run` contra a **integracao**, mais verificacao
   independente que leia o catalogo do Postgres e prove constraints com insert
   real em transacao revertida;
4. `migration:run` contra producao com `neondb_owner`, identidade conferida antes;
5. deploy, e depois `gh workflow run monitor-producao.yml`.

### 7. Leia o estado no mesmo turno da acao

`gh pr view N --json updatedAt,mergeStateStatus` custa uma chamada e e mais
barato que uma acao errada.

### 8. Armadilhas de ambiente que so custam tentativas

- Editar arquivo por script: normalize antes de casar, porque os arquivos estao
  em CRLF no disco e em LF no repositorio, e **sempre** guarde a falha.
  ```js
  let s = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  if (!s.includes(de)) { console.log('NAO ENCONTRADO'); process.exit(1); }
  ```
- Nada de `node -e "..."` com crases nem heredoc longo: o shell expande e
  quebra. Escreva o script num arquivo e rode `node arquivo.mjs`.
- Nada de `sed` em conteudo com barra invertida: `(\w+)` vira `(w+)`.
- Script que usa dependencia do repo mora dentro do pacote, nunca no scratchpad.
- `esModuleInterop` esta desligado no backend: copie o estilo de import que o
  repo ja usa em vez de assumir `import x from 'node:modulo'`.
- `python3` nao existe nesta maquina. Use Node.
- O prefixo `!` do usuario roda Git Bash, nao PowerShell. De sempre a versao
  POSIX; o clipboard e `/dev/clipboard`.
- `catalogo-taco.spec.ts` falha **sempre** em checkout Windows por CRLF e passa
  no CI. Nunca normalize esse JSON: consertar aqui quebra la.
- Espera de CI por `gh run list --jq 'select(.name==...)'` mente. Em
  2026-08-19, na Fase 244, um laco que saia quando nenhum run com esse nome
  estava fora de `completed` deu o CI de `main` como encerrado enquanto ele
  ainda rodava, e a leitura seguinte trouxe `cancelled` para um run que
  terminou verde. A listagem e uma janela paginada e pode omitir o run por um
  instante. Espere sempre pelo id:
  ```sh
  until [ "$(gh run view <id> --json status --jq .status)" = "completed" ]; do sleep 30; done
  gh run view <id> --json jobs --jq '.jobs[].conclusion'
  ```
  Custo: uma afirmacao errada sobre o CI, corrigida no mesmo turno. Barato aqui,
  caro no dia em que virar decisao de merge.

### 9. Um erro de configuracao do tsc esconde todos os erros de arquivo

Na Fase 244 o Incremento 2 foi planejado como "tirar o `baseUrl` e mergear os
dois PRs do TypeScript 6". Virou cinco PRs. Cada correcao revelava a proxima,
porque **enquanto existe erro de configuracao o `tsc` para ali e nunca chega a
checar os arquivos**. Na ordem em que apareceram: `TS5101` (baseUrl), depois
5372 erros de `@types` sumido, depois `TS5011` (rootDir), e na web `TS2882`,
`TS5112`, `TS5107` e `TS2591`.

A verificacao que passa a ser feita antes de dizer que um bump de compilador
esta destravado: rodar o compilador alvo localmente, contra o `node_modules`
real, sem instalar nada no projeto.

```sh
pnpm --package=typescript@6.0.3 dlx tsc --noEmit -p tsconfig.json
```

Um log de CI mostra o primeiro erro, nao todos. Custo: quatro ciclos de rebase
do Dependabot mais CI, de 5 a 10 minutos cada, para descobrir em serie o que
uma execucao local mostraria de uma vez.

### 10. Bump de dependencia que muda API nao pode ser mergeado sozinho

Ainda na Fase 244, dois PRs do Dependabot foram fechados e refeitos: `#35`
(cron-parser 5, que removeu `parseExpression`) e `#26` (TypeScript 6 na web,
que passou a exigir `--ignoreConfig`, flag inexistente no 5.9). Mergeados
sozinhos, deixariam `main` quebrada ate o PR de correcao entrar, e a correcao
nao podia entrar antes porque depende da versao nova.

Regra: quando o bump exige mudanca de codigo, versao e codigo entram no mesmo
commit, e o PR do Dependabot e fechado apontando o substituto.

### 11. Lockfile regenerado por pnpm mais antigo remove metadado

`pnpm --filter <pacote> add <dep>@<versao>` com o pnpm 9.15.9 fixado em
`packageManager` apagou 10 linhas `libc:` de binarios opcionais que um pnpm
mais novo, o do Dependabot, havia escrito. O diff do bump vinha com ruido que
nao era do bump.

Confira o diff do lock antes de commitar e restaure o que nao e seu:

```sh
git diff <pacote>/pnpm-lock.yaml | grep -E "^[-+]" | grep -v "^[-+][-+][-+]"
```

### 12. Lockfile resolvido por auto-merge do git nao e lockfile valido

Dois PRs do Dependabot que tocam o mesmo `pnpm-lock.yaml` podem ficar `CLEAN`
depois que o primeiro entra, porque o git resolve o texto linha a linha. O
resultado pode ser coerente como texto e incoerente com o `package.json`, e a
falha so aparece no `--frozen-lockfile` do CI, depois do merge.

Peca `@dependabot rebase` no segundo PR mesmo quando o GitHub diz `CLEAN`, e
espere o CI dele fechar na arvore combinada antes de mergear.

### 13. Check de saude novo se mede contra a configuracao real de producao

Em 2026-08-19 adicionei `checks.ia` ao `/health/detalhado` e tratei meia
configuracao como `degradado`. Em producao existia exatamente uma das duas
variaveis de IA, sobra de exploracao anterior. O `degradado` propagou para o
`status` geral, o monitor externo exige `status: "ok"`, falhou as 21:42 e abriu
a issue de incidente #72 — por uma integracao que ninguem usa.

O diagnostico do check estava certo; o processo, nao. Um check novo que pode
derrubar a saude global precisa ser conferido contra o estado real de producao
**antes** do merge, e nao depois:

```sh
curl -s https://octaclin-backend-producao.onrender.com/health/detalhado
```

Regra pratica: severidade se define pelo uso, nao pela pureza. Integracao que
nao esta em uso reporta e nao degrada; quando entrar em uso, o check vira sonda
real e a severidade sobe junto.

Custo: um monitor vermelho, uma issue de incidente e um PR extra de correcao.
Este e o item 1 desta secao repetido de outra forma — nao afirmar sobre
producao sem ler producao.

## Registro obrigatorio de erros novos

Todo erro cometido daqui em diante entra nesta secao, no mesmo formato, **no
mesmo commit ou PR que o corrige**. Nao deixe para depois e nao registre so na
memoria do agente: memoria chega como contexto de fundo e pode ser ignorada,
este arquivo chega como instrucao e e versionado.

Cada registro tem tres partes, nesta ordem:

1. **O erro** — o que foi feito, com o sintoma exato pelo qual ele sera
   reconhecido de novo: codigo de erro, mensagem literal, ou o comando que
   mentiu. Sem generalizar: descreva o caso que aconteceu.
2. **A solucao** — o que consertou, em comando ou trecho de codigo copiavel.
3. **Como nao repetir** — a verificacao que passa a ser feita antes, de
   preferencia um teste, um gate de CI ou uma linha de comando. Se der para
   transformar em teste automatizado, transforme: regra que depende de alguem
   lembrar volta a falhar.

Registre tambem o que **custou**. Um erro que custou um deploy vermelho pesa
diferente de um que custou uma chamada de API, e quem ler depois precisa saber
qual dos dois esta lendo.

Errar uma vez e aceitavel. Errar duas vezes o mesmo e desperdicio de tempo e de
tokens do usuario.

### Fase 248 - glob do PowerShell, patch amplo e inspecao do navegador

1. **O erro:** um `rg` com glob de chaves foi interpretado pelo PowerShell e
   falhou com `Missing argument in parameter list`; depois um patch amplo do
   prontuario falhou porque esperava `gap-2`, mas o arquivo tinha `gap-3`. Mais
   tarde, `rg ... *.md` passou o curinga literalmente e falhou com erro 123.
   **A solucao:** passar arquivos explicitamente ao `rg` e dividir patches
   grandes em blocos com contexto relido. **Como nao repetir:** no PowerShell,
   nao usar expansao `{a,b}` nem curinga literal como argumento de `rg`, e
   sempre reler o trecho imediatamente antes de um patch amplo. Custo: tres
   comandos locais, sem mudanca parcial de arquivo.
2. **O erro:** `pnpm exec next dev` com PTY falhou em Windows com
   `CreateProcess ... Acesso negado`. **A solucao:** iniciar o mesmo servidor
   sem PTY e encerrar a sessao explicitamente. **Como nao repetir:** reservar
   PTY apenas para comandos realmente interativos. Custo: uma chamada local.
3. **O erro:** o `initScript` temporario do Chrome DevTools assumiu que todo
   argumento de `fetch` tinha URL e gerou `Cannot read properties of undefined
   (reading 'includes')` no carregamento RSC. **A solucao:** a validacao foi
   baseada na arvore acessivel e rede reais, e o servidor temporario foi
   encerrado; o codigo do produto nao foi alterado por esse script. **Como nao
   repetir:** em mocks de navegador, normalizar `string`, `URL` e `Request`
   antes de comparar a URL. Custo: uma navegacao adicional no DevTools.
4. **O erro:** o primeiro `test:a11y` encontrou `Another next dev server is
   already running` porque o processo filho do DevTools sobreviveu ao
   encerramento da sessao pai. **A solucao:** conferir a linha de comando do
   PID, encerrar apenas o processo pertencente ao checkout e repetir o gate,
   que aprovou 10/10. **Como nao repetir:** depois de usar servidor manual,
   verificar as portas 3000/3010 antes de iniciar Playwright. Custo: uma
   execucao invalida do gate.
5. **O erro:** `pnpm security:secrets` encontrou a credencial no arquivo local
   e ignorado `octaclin-backend/.env.integracao`; a primeira tentativa de
   validar so arquivos versionaveis tambem chamou o modulo por `node -e` sem
   `process.argv[1]`, causando `ERR_INVALID_ARG_TYPE`, e depois deixou de
   aplicar as exclusoes de diretorio do scanner. **A solucao:** confirmar com
   `git check-ignore`/`git ls-files` que o `.env` nao e versionavel e repetir a
   mesma varredura somente sobre `git ls-files --cached --others
   --exclude-standard`, preservando as exclusoes originais; nenhum achado
   restou. **Como nao repetir:** scripts ESM importados por `node -e` precisam
   de `process.argv[1]` antes do import dinamico, e a raiz logica do scanner nao
   pode ser perdida ao percorrer arquivos individualmente. Custo: tres comandos
   locais; nenhum secret foi impresso, alterado ou versionado.

### Fase 249 - contrato incorreto no mock global de notificacoes

1. **O erro:** o primeiro RED de `test:fase249` deixou o fallback global de
   `/api/**` responder `[]` para `/api/notificacoes?limite=20`; o
   `SinoNotificacoes` esperava `{ naoLidas, itens }` e falhou com `Cannot read
   properties of undefined (reading 'length')`. **A solucao:** adicionar o
   contrato explicito `{ naoLidas: 0, itens: [] }` antes do fallback generico.
   **Como nao repetir:** todo mock global precisa mapear os contratos de shell
   compartilhado (sessao e notificacoes) antes de responder endpoints da tela.
   Custo: uma execucao RED parcialmente contaminada; nenhum codigo de produto
   foi alterado por essa falha.
2. **O erro:** o teste de teclado guardou um `Locator` da aba selecionada e
   chamou `textContent()` somente depois de `ArrowRight`; como locators sao
   reavaliados, comparou a nova aba com ela mesma e esperou ate o timeout.
   **A solucao:** capturar o texto da aba ativa antes da tecla e comparar o
   estado posterior com esse valor imutavel. **Como nao repetir:** congelar
   valores anteriores antes de interacoes quando o locator usa filtros de
   estado como `{ selected: true }`. Custo: uma execucao local de 20 segundos.

## Padroes de arquitetura

- Backend: `octaclin-backend`, NestJS, TypeORM, PostgreSQL.
- Frontend: `octaclin-web`, Next.js App Router, rotas BFF em `app/api`.
- Tenant e derivado do JWT e aplicado por `ExecutorTenant`; nao aceite tenant livre vindo do cliente.
- Sessao web usa cookies HttpOnly.
- Dados sensiveis devem ser criptografados ou minimizados em DTOs.
- Arquivamento logico e preferido a delete fisico em dados clinicos/operacionais.
- Acoes sensiveis devem ter auditoria.
- Rotas frontend devem passar pelo BFF quando dependerem de sessao autenticada.

## Papeis atuais

- `SuperAdmin`: operacao/admin interno.
- `Professional`: profissional/clinico.
- `Collaborator`: colaborador operacional.
- `Patient`: portal do paciente.
- `Client`: gestor da conta/cliente SaaS.

## Integracoes ja existentes

- Neon PostgreSQL.
- Render.
- Upstash Redis.
- Gmail SMTP/Gmail API.
- Google Calendar.
- Meta WhatsApp Cloud API.
- Webhooks WhatsApp.

Antes de mexer em qualquer integracao, leia `VARIAVEIS_AMBIENTE.md` e `RUNBOOK_PRODUCAO.md`.

## Como fechar uma fase

1. Rode validacoes frescas.
2. Registre em `AGENTS.md` qualquer erro cometido durante a fase, com erro,
   solucao e como nao repetir.
3. Atualize documentacao da fase.
4. Atualize o checklist vivo.
5. Rode `git diff --check`.
6. Faça commit com mensagem objetiva.
7. Faça push.
8. Responda ao usuario com resumo, commit e validacoes, nomeando cada gate que
   rodou e cada um que nao rodou.

## Quando estiver em duvida

- Prefira manter escopo estreito.
- Preserve decisoes ja documentadas.
- Consulte `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` para a ordem do roadmap.
- Se uma tarefa depender de conta externa, login, 2FA ou aprovacao manual, explique exatamente o que o usuario precisa fazer e retome depois.
