# Relatorio de seguranca - PR 51 da governanca: Providers e menor privilegio

Data: 2026-09-02. Risco: R5 - bloqueador. Escopo: exclusivamente o PR 51 do
`docs/governance/PROGRAMA_HARDENING_SEGURANCA_PRS_36_56.md`. Nao avanca ao PR 52.

Norma duravel produzida:
`docs/governance/POLITICA_PROVIDERS_MENOR_PRIVILEGIO.md`.

## 1. Baseline (hard gate)

O PR 51 vem depois do PR 50 (Containers e runtime).

- GitHub PR do PR 50: `#178` - estado `MERGED`.
- Merge commit do PR 50: `0e41bf22321f4427579e39f8ecca5632d7596988` (2026-09-01T15:55:56Z), base `main`.
- `git merge-base --is-ancestor 0e41bf2 origin/main` -> exit 0 (ancestral de `main`).
- HEAD inicial do PR 51 (= `origin/main`): `6e4aa729fecc51b2b899b47b4f2159960ebf28db`.

Nenhum controle dos PRs 49 e 50 foi enfraquecido: instalacao congelada,
lockfiles, ledger de excecoes, SBOM, digests imutaveis, runtime non-root e
Actions por SHA permanecem intactos.

## 2. Achado central

**O repositorio declarava o menor privilegio e nunca o media.**

`VARIAVEIS_AMBIENTE.md` descrevia `DATABASE_URL` como "conexao Neon/Postgres por
papel sem `BYPASSRLS`". A frase estava certa como intencao e vazia como
controle: as unicas verificacoes de papel do repositorio viviam em
`src/infraestrutura/e2e/validar-ambiente-staging-e2e.ts`,
`src/infraestrutura/e2e/preparar-ambiente-staging-e2e.ts` e
`src/infraestrutura/e2e/validar-prontuario-fase235.ts` -- todos scripts de E2E,
nenhum deles no caminho de producao.

Por que isso e R5 e nao higiene: a policy de RLS **nao e avaliada** para uma
role que tem `BYPASSRLS`. Todo o isolamento entre tenants provado no PR 43
depende desse atributo estar ausente. Colar a URL da role owner no painel do
Render nao produz erro nenhum -- a aplicacao sobe, `/health` responde `200`,
`/health/pronto` responde `200`, os smokes de quatro papeis passam, e o
isolamento deixa de existir sem um unico sinal. A licao de 2026-08-22 em
`docs/agents/LESSONS_LEARNED.md` registra que o painel de ambiente ja divergiu
do documento uma vez, o que torna a hipotese concreta, e nao teorica.

## 3. Achados secundarios

| # | Achado | Onde | Consequencia |
| --- | --- | --- | --- |
| SEC-PR51-001 | Role de runtime sem verificacao de privilegio em producao | `main.ts`, `servico-saude.ts` | RLS silenciosamente inativa |
| SEC-PR51-002 | Redis aceita `redis://` sem TLS em staging e producao | `configuracao-redis.ts` | usuario, senha e payload de fila em claro |
| SEC-PR51-003 | Endpoint S3 usado literalmente, sem exigir HTTPS | `servico-armazenamento-objetos.ts` | anexo clinico e URL assinada em claro |
| SEC-PR51-004 | `CREATE` no schema `public` para a role de runtime nao e verificado | -- | desfaz a separacao owner/runtime das migrations |

Sobre o SEC-PR51-002: o Postgres exige TLS em staging e producao desde o PR 39,
com cadeia e hostname verificados e `sslmode` permissivo derrubando o boot. O
Redis nao tinha paridade nenhuma. A `REDIS_URL` carrega usuario e senha, e o
payload BullMQ carrega identificador de tenant e conteudo de comunicacao.

Sobre o SEC-PR51-004: a licao de 2026-08-22 registra um deploy que tentou
migration com a role de runtime e falhou por falta de `CREATE`. A correcao foi
tornar migrations opt-in e executa-las fora de banda com a role owner. Devolver
`CREATE` a role de runtime desfaz aquela separacao sem que nada reclame.

## 4. Correcao aplicada

`src/infraestrutura/seguranca/menor-privilegio-providers.ts` (verificacoes
puras) e `servico-menor-privilegio-providers.ts` (medicao no processo real).

| Verificacao | Regra |
| --- | --- |
| `SUPERUSER` na role corrente | `violado` |
| `BYPASSRLS` na role corrente | `violado` |
| pertinencia a role com `SUPERUSER`/`BYPASSRLS` | `violado` |
| `CREATE` no schema `public` | `violado` |
| TLS do Redis em staging/producao | `violado` |
| HTTPS do endpoint de armazenamento em staging/producao | `violado` |

### Por que `MEMBER` e nao `USAGE`

`BYPASSRLS` e `SUPERUSER` sao atributos de role: nao sao herdados pela
associacao, nem com `INHERIT`. O que a associacao concede e o direito de
`SET ROLE`, e depois do `SET ROLE` os atributos passam a valer. Uma verificacao
por `pg_has_role(..., 'USAGE')` nao veria esse caminho. A consulta usa
`'MEMBER'`, e ha teste que trava essa escolha.

A direcao inversa e segura e existe de proposito neste projeto: o
`AUDITORIA_FINAL_FASE_235_2026-08-13.md` registra que "a associacao preexistente
do owner com a role runtime foi preservada". Owner membro do runtime nao aparece
na consulta, porque ela parte de `current_user`.

### Tres propriedades do relatorio

1. **`nao-verificado` nao e aprovacao.** Provider ausente do processo, consulta
   de `pg_roles` negada ou `DataSource` nao inicializado produzem
   `nao-verificado`. O veredicto geral so vira `conforme` se ao menos uma
   verificacao passou de fato; tres `nao-verificado` continuam
   `nao-verificado`.
2. **Motivos nao carregam segredo.** Nem host, nem credencial, nem nome de role
   aparecem no relatorio ou no log, com teste negativo cobrindo os tres.
3. **Fora de `/health/detalhado`.** Aquele endpoint e publico e nao autenticado;
   dizer a um anonimo que a role do runtime tem `BYPASSRLS` seria entregar o
   mapa. O relatorio vive em `GET /operacoes/providers`, atras de `GuardaJwt`,
   `GuardaPapeis`, `GuardaPermissoes`, papel `SuperAdmin` e permissao
   `operacoes.auditoria.ler`.

## 5. Medir antes de bloquear

A sequencia acordada com o proprietario foi: **medir -> coletar evidencia de
producao -> converter para falha fechada**. O motivo e a licao de 2026-08-22 em
`docs/agents/LESSONS_LEARNED.md` -- "Health novo medido fora do ambiente real":
um check opcional degradou a saude de producao porque a regra foi validada
contra configuracao presumida.

O ambiente de desenvolvimento nao tem credencial de Render, Neon, Redis ou
Backblaze. Declarar falha fechada sem medir seria apostar que a configuracao
produtiva atende as seis regras; se nao atendesse, o proximo deploy nao subiria
-- e o modo de falha de um gate de seguranca nao pode ser uma indisponibilidade
surpresa.

### 5.1 Evidencia de producao (2026-09-02)

O deploy do merge `43e7ee0` subiu e os dois processos de producao foram lidos no
log do Render:

| Processo | Horario | `postgres` | `redis` | `armazenamento` | Veredicto |
| --- | --- | --- | --- | --- | --- |
| `web` | 12:24:22 | `conforme` | `conforme` | `conforme` | `conforme` |
| `worker` | 12:05:18 | `conforme` | `conforme` | `nao-verificado` | `conforme` |

`postgres: conforme` e verificacao positiva, nao ausencia de verificacao: a
consulta a `pg_roles` respondeu e as quatro flags voltaram falsas. **A role de
runtime de producao nao tem `SUPERUSER`, nao tem `BYPASSRLS`, nao e membro de
role privilegiada e nao tem `CREATE` no schema `public`.** O isolamento entre
tenants provado no PR 43 esta ativo em producao, e agora isso e fato medido em
vez de intencao documentada.

O `armazenamento: nao-verificado` do `worker` e esperado e benigno: aquele
processo nao configura `ARMAZENAMENTO_S3_ENDPOINT` porque nao serve anexo.

Sonda independente do mesmo deploy: `GET /operacoes/providers` respondeu `401`,
e nao `404`, confirmando que a rota estava no ar e protegida.

### 5.2 Falha fechada habilitada

Com os dois processos medidos, `motivoDeBloqueio` passou a derrubar o bootstrap
em staging e producao. Duas regras:

1. **qualquer provider `violado`** bloqueia;
2. **`postgres` diferente de `conforme`** bloqueia, inclusive `nao-verificado`.

A assimetria da segunda e deliberada. O privilegio da role e a unica propriedade
aqui de que depende o isolamento entre tenants, e ela e verificavel em todo
processo que abre o `DataSource` -- os dois processos de producao provaram isso.
Subir sem saber justamente o que este controle existe para saber reabriria o
ponto cego que o PR 51 fechou.

Redis e armazenamento podem ficar `nao-verificado` sem bloquear, porque provider
ausente do processo e estado legitimo -- exatamente o caso do `worker`.

O log `error` sai **antes** do bloqueio, para que a evidencia exista mesmo
quando o processo nao sobe. `main.ts` passou a tratar a rejeicao do bootstrap
explicitamente, com saida deliberada de codigo 1, em vez de depender do
comportamento padrao do Node para rejeicao nao tratada.

Fora de staging e producao nada e derrubado: MinIO local em `http://` ou
Postgres de desenvolvimento com role ampla nao impedem ninguem de rodar o
projeto.

## 6. Validacoes

| Gate | Resultado |
| --- | --- |
| `pnpm --dir octaclin-backend test` | PASS - 170 suites, 1391 testes; 3 suites skipped (testcontainers, sem Docker local) |
| `menor-privilegio-providers.spec.ts` | PASS - 30 testes |
| `servico-menor-privilegio-providers.spec.ts` | PASS - 12 testes |
| `controlador-operacoes.spec.ts` | PASS - 4 testes, incluindo o endpoint novo |
| `pnpm --dir octaclin-backend typecheck` | PASS |
| `pnpm test:confiabilidade` | PASS |
| `pnpm security:secrets` | PASS |
| `git diff --check` | limpo |

Cobertura negativa especifica: `BYPASSRLS`, `SUPERUSER`, pertinencia,
`CREATE` no schema, `redis://` sem TLS, `REDIS_URL` invalida, endpoint `http://`,
consulta de `pg_roles` negada, `DataSource` nao inicializado, e ausencia de
vazamento de host/credencial/role no log e no relatorio -- inclusive no caminho
em que o processo e derrubado, porque o log precisa existir mesmo quando o
processo nao sobe.

Cobertura da falha fechada: bloqueio em producao e em staging, bloqueio quando
`postgres` fica `nao-verificado`, ausencia de bloqueio quando so `redis` e
`armazenamento` ficam `nao-verificado` (o caso real do `worker`), e ausencia de
bloqueio fora de staging e producao.

## 7. O que este PR **nao** prova

O privilegio da role de runtime foi medido em producao (secao 5.1). As demais
propriedades do gate dependem dos paineis dos provedores, que este ambiente nao
alcanca -- e o gate minimo exige "nenhuma mudanca externa sem aceite humano".
Continuam pendentes, para o proprietario:

| Item | Onde |
| --- | --- |
| Neon: staging e producao como projetos distintos | secao 6.2 da norma |
| Redis: `rediss://` e `maxmemory-policy=noeviction` | secao 6.3 |
| B2: escopo das Application Keys e ausencia de acesso publico | secao 6.4 |
| Render: separacao por servico e variaveis marcadas como secret | secao 6.5 |
| data da ultima rotacao de cada credencial | secao 6.6 |

`STATUS_ATUAL_PROJETO.md` e o `PREFLIGHT_PRODUCAO.md` registram a separacao de
ambientes como aceita na Fase 131, com credenciais rotacionadas. Isso e
evidencia historica, nao evidencia deste ciclo, e a regra do repositorio e que
producao exige evidencia de producao.

## 8. Riscos residuais

- A verificacao mede o processo que a executa. Com a falha fechada, isso deixou
  de ser ponto cego -- cada processo bloqueia por conta propria --, mas o
  relatorio do `web` continua nao falando pelo `worker`.
- Staging nunca foi medido. A falha fechada vale la tambem, entao staging e o
  primeiro lugar onde o bloqueio pode aparecer. E o lugar barato para descobrir:
  se acontecer, o log `error` do deploy nomeia o provider e o motivo.
- `maxmemory-policy` nao e verificada em codigo: provedores gerenciados
  costumam restringir `CONFIG`, e uma verificacao que falha por permissao geraria
  ruido permanente. Fica na coleta humana da secao 6.3.
- O escopo das chaves B2 e a separacao de projetos Neon nao sao observaveis a
  partir do processo. So o painel responde.
- A falha fechada torna uma mudanca de credencial que viole as regras um
  impedimento de deploy. E o comportamento pretendido, mas quem for mexer em
  provider precisa conhecer a regra antes: ela esta na secao 5 da norma.

## 9. Rollback

Reverter o commit da falha fechada devolve o modo de observacao, sem perder a
medicao: o log e o endpoint continuam existindo. Reverter o PR 51 inteiro
remove tambem a medicao.

As verificacoes nao alteram conexao, consulta de negocio, schema ou contrato
HTTP existente. O unico acrescimo de superficie e `GET /operacoes/providers`, ja
restrito a `SuperAdmin`.

## 10. Operacoes externas

Nenhuma. Nenhum painel de provider foi acessado, nenhuma credencial foi lida,
criada, rotacionada ou revogada, e nenhuma configuracao externa foi alterada.
