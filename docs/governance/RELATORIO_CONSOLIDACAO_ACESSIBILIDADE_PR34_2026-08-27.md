# Relatorio de consolidacao da governanca de acessibilidade - PR 34

Data: 2026-08-27
Base: `5f76eac` (merge do PR #148, PR 33 da governanca), `origin/main` sincronizada.

## Objetivo

Consolidar a governanca de acessibilidade construida nos PRs 13 e 27 a 33: uma matriz unica,
verificavel por maquina, dos gates existentes; a ligacao ao CI dos gates que ainda so existiam como
comando local; uma politica objetiva de flakes; e o registro explicito do que **nao** esta validado.

Este PR nao redesenha tela, nao cria funcionalidade e nao altera produto. Nenhum arquivo de
`octaclin-web/app`, `octaclin-web/components`, `octaclin-mobile/app` ou do backend foi tocado.

## 1. Escopo consolidado

| Item pedido | Onde ficou |
| --- | --- |
| Cobertura funcional Playwright + axe-core | `octaclin-web/tests/visual/acessibilidade.spec.mjs`, 132 testes x 2 projects = 264 |
| Componentes compartilhados | bloco `componentes compartilhados (PR 29)`, 12 testes |
| Jornadas completas por teclado | bloco `jornadas completas por teclado (PR 30)`, 5 testes |
| Reflow e acessibilidade visual | `octaclin-web/tests/visual/reflow-visual.spec.mjs`, 30 testes x 2 projects = 60 |
| Validacao manual com NVDA | `RELATORIO_NVDA_PR32_2026-08-27.md` (PR 32), nao reexecutada nesta sessao |
| Auditoria estatica do aplicativo Expo | `octaclin-mobile/scripts/auditoria-acessibilidade.spec.mjs`, 15 testes |
| Limitacoes de TalkBack e VoiceOver | SKIPPED com motivo, risco e condicao de fechamento na matriz |
| Execucao bloqueante e estavel no CI | secao 4 |
| Matriz definitiva de evidencias, excecoes e riscos | `docs/governance/matriz-acessibilidade.json` |

## 2. Inventario dos gates

A matriz declara 11 gates. Cada um foi confrontado com o `package.json` correspondente, com o
arquivo de spec no disco e com os steps do `.github/workflows/ci.yml`.

| Gate | Comando | Diretorio | Bloqueante | Como roda no CI |
| --- | --- | --- | --- | --- |
| `web-suite-visual` | `smoke:visual` | `octaclin-web` | sim | job `demo-smoke`, step `pnpm smoke:visual` |
| `web-a11y` | `test:a11y` | `octaclin-web` | sim | coberto por `web-suite-visual` |
| `web-reflow` | `test:reflow` | `octaclin-web` | sim | coberto por `web-suite-visual` |
| `mobile-a11y` | `test:a11y` | `octaclin-mobile` | sim | job `mobile` |
| `mobile-audit-a11y` | `audit:a11y` | `octaclin-mobile` | nao | duplica `mobile-a11y`, deliberadamente fora do CI |
| `mobile-test-security` | `test:security` | `octaclin-mobile` | sim | job `mobile` |
| `mobile-audit-security` | `audit:security` | `octaclin-mobile` | sim | job `mobile` |
| `mobile-build-validate` | `build:validate` | `octaclin-mobile` | sim | job `mobile` |
| `matriz-a11y` | `test:a11y:matriz` | raiz | sim | job `governanca` (novo neste PR) |
| `matriz-confiabilidade` | `test:confiabilidade` | raiz | sim | job `governanca` (novo neste PR) |
| `secrets` | `security:secrets` | raiz | sim | job `governanca` (novo neste PR) |

### Por que `test:a11y` e `test:reflow` nao viraram steps proprios

`playwright.config.mjs` usa `testDir: './tests/visual'` sem `testMatch` nem `testIgnore`, e o step
`pnpm smoke:visual` do job `demo-smoke` executa `playwright test` sem filtro. Os dois specs de
acessibilidade ja rodam ali, nos dois projects. Adicionar `pnpm test:a11y` como step separado
executaria os mesmos 264 testes uma segunda vez no mesmo job, sem cobertura nova.

Essa cobertura por suite completa e fragil por natureza: basta alguem introduzir `testIgnore` para o
gate desaparecer sem que nenhum teste falhe. Por isso o inventario executavel reprova qualquer
`testMatch`/`testIgnore` na configuracao e exige que o gate de cobertura esteja ligado ao CI.

### Por que `audit:a11y` do mobile nao entrou no CI

`auditoria-acessibilidade.spec.mjs` ja tem um caso que carrega o projeto real e roda a mesma
auditoria (`carregarProjeto` + `avaliarProjeto`). `pnpm audit:a11y` e o mesmo trabalho pela linha de
comando, util em diagnostico local. O inventario executavel **reprova** se `audit:a11y` for
adicionado a algum job, para impedir que a duplicacao entre por engano.

## 3. Matriz de cobertura

`docs/governance/matriz-acessibilidade.json` tem 28 linhas: **22 PASS, 5 SKIPPED, 1 NA**.
Cada linha registra superficie, rota ou tela, estado, interacao, viewport ou plataforma, mecanismo
(automatizado ou manual), resultado, evidencia, justificativa quando aplicavel e risco residual.

Cobertura por superficie:

| Superficie | Rotas ou telas | Resultado |
| --- | --- | --- |
| Web publica | `/login`, `/esqueci-senha`, `/recuperar-senha`, `/primeiro-acesso`, `/agendar/token-publico`, `/formularios/token-publico`, `/formularios/token-pwa`, `/formularios/token-upload`, `/offline` | PASS |
| Web autenticada do paciente | `/portal` e `/portal/agenda`, `/checkins`, `/mensagens`, `/plano`, `/privacidade`, `/formularios`, `/mais`, `/perfil` | PASS |
| Console profissional e administrativo | `/dashboard`, `/agenda`, `/cliente`, `/pacientes` e subrotas, `/questionarios`, `/comunicacoes`, `/profissionais`, `/automacoes`, `/ia`, `/operacoes`, `/gamificacao` | PASS |
| Componentes compartilhados | modal, abas e menu, exercitados em `/profissionais` e `/dashboard` | PASS |
| Jornadas por teclado | cadastro de paciente, consulta, distribuicao de check-in, resposta no portal, conversa | PASS |
| Reflow e zoom | 9 rotas a 200% e 400%, retrato e paisagem, mais `prefers-reduced-motion` | PASS |
| NVDA | `/login`, `/pacientes`, `/pacientes/novo`, `/portal/checkins` em Chrome e Edge | PASS (PR 32) |
| NVDA, demais rotas | todas as outras | SKIPPED |
| Aplicativo Expo | 6 telas e componentes, auditoria estatica | PASS |
| Aplicativo Expo, autenticacao | inexistente no aplicativo | NA |
| TalkBack | todas as telas | SKIPPED |
| VoiceOver | todas as telas | SKIPPED |
| Fonte ampliada nativa | todas as telas | SKIPPED |
| Reducao de movimento nativa | todas as telas | SKIPPED |

Sao 33 rotas web distintas visitadas pelo gate de acessibilidade. O gap analysis de 2026-08-25
listava 22 rotas de produto sem nenhuma checagem; todas foram absorvidas pelos PRs 18 a 31.

### Inventario executavel

O risco central de uma matriz documental e afirmar cobertura que nao existe. `pnpm test:a11y:matriz`
confronta a matriz com o repositorio e reprova nestes casos:

- script documentado que nao existe no `package.json` do diretorio declarado;
- spec referenciado que nao existe no disco;
- bloco `test.describe` citado pela matriz que nao existe mais no spec;
- rota documentada que o spec nao visita (por `page.goto` ou por tabela de rotas);
- project do Playwright citado que nao existe na configuracao;
- gate bloqueante que nao roda em nenhum job do CI, ou que roda com outro comando;
- gate coberto por uma suite que, por sua vez, nao esta ligada ao CI;
- `testMatch`/`testIgnore` na configuracao, que quebraria a cobertura por suite completa;
- `continue-on-error` no workflow, ou `|| true` mascarando a falha de um gate;
- resultado manual tratado como automatizado, ou validacao manual sem relatorio de evidencia;
- TalkBack, VoiceOver, fonte ampliada nativa ou reducao de movimento nativa declarados PASS;
- linha SKIPPED ou NA sem justificativa; linha SKIPPED sem condicao de fechamento;
- teste desligado com `test.skip`/`test.fixme` sem entrada correspondente de quarentena;
- entrada de quarentena sem responsavel, justificativa ou prazo, ou classificada como PASS;
- `retries`, `timeout` ou `expect.timeout` acima do teto da politica de flakes;
- `trace` ou `screenshot` configurados para nao preservar artefato.

`scripts/test-matriz-acessibilidade.spec.mjs` prova essa deteccao: 19 casos partem da matriz real,
aplicam uma mutacao e exigem a reprovacao; o vigesimo exige que a matriz versionada passe.
Sao dados estruturados e verificacoes de texto, sem dependencia nova e sem plataforma de testes nova.

## 4. Execucao no CI

### Gates que ja rodavam e foram confirmados

- Job `demo-smoke`: `pnpm smoke:visual` executa `acessibilidade.spec.mjs` (264) e
  `reflow-visual.spec.mjs` (60) nos projects `desktop-chromium` e `mobile-chromium`.
- Job `mobile`: `pnpm test:a11y`, `pnpm test:security`, `pnpm audit:security` e `pnpm build:validate`.

### Gates conectados neste PR

Job novo `governanca` ("Governanca de repositorio"), sem instalacao de dependencias:

```yaml
- run: pnpm test:a11y:matriz
- run: pnpm test:confiabilidade
- run: pnpm security:secrets
```

`test:confiabilidade` e `security:secrets` existiam desde antes e estavam documentados como execucao
minima, mas nao rodavam em nenhum workflow: uma matriz desatualizada ou um secret novo chegariam ao
`main` sem sinal. Os tres sao scripts Node de raiz e rodam em segundos.

### Requisitos atendidos

- Falha real bloqueia o job: os tres steps saem com codigo diferente de zero.
- Nenhum `continue-on-error` no workflow, verificado pelo proprio inventario executavel.
- Nenhum `|| true` sobre comando de gate. As duas ocorrencias de `|| true` no `ci.yml` estao no
  bloco de diagnostico do step "Wait for services", que imprime os logs e termina com `exit 1`.
- Nenhum FAIL convertido em warning.
- Nenhuma suite duplicada: ver as duas justificativas da secao 2.
- Retries inalterados (1 no CI, 0 local).
- Logs preservados: o job novo produz saida textual; os artefatos do Playwright continuam publicados.
- Custo proporcional: um runner adicional, sem `pnpm install`, sem navegador.

### Achado nao corrigido (fora do escopo de acessibilidade)

O job `demo-smoke` executa `pnpm smoke:visual` e, depois, `pnpm test:fase248`, `pnpm test:fase249` e
`pnpm test:fase251`. Os tres rodam specs que `smoke:visual` ja executou, com `--project=desktop-chromium`,
ou seja, um subconjunto estrito do que acabou de rodar. E duplicacao real de tempo de CI, mas em
specs de estados, densidade e microcopy, nao de acessibilidade. Nao foi alterado neste PR para nao
mexer em cobertura fora do escopo autorizado. Fica registrado como proximo passo.

## 5. Politica de flakes

Registrada em `politicaDeFlakes` na matriz e parcialmente automatizada:

| Regra | Automatizada? |
| --- | --- |
| Falha intermitente nao e PASS; vira FAIL ou SKIPPED com responsavel | nao (regra de conduta) |
| Retry nao corrige teste instavel; teto de 1 retry no CI | sim, o inventario reprova `retries` acima do teto |
| Toda falha preserva rota, project, etapa e artefato | sim, `trace: 'retain-on-failure'` e `screenshot: 'only-on-failure'` sao exigidos |
| Teste flake recebe correcao localizada, nao timeout maior | sim, tetos de `timeout` (30s) e `expect.timeout` (10s) verificados |
| Quarentena so com responsavel, justificativa, prazo e classificacao SKIPPED | sim, campos obrigatorios verificados |
| Teste desligado no codigo exige entrada de quarentena | sim, `test.skip`/`test.fixme` sem entrada reprova |
| Sem seletor ambiguo ou locator nao estrito conhecido | nao (revisao humana) |

**Nenhum teste de acessibilidade esta em quarentena.** A lista existe vazia, com as regras que
passam a valer se alguem precisar usa-la. Nao foi construido nenhum mecanismo de quarentena alem
disso, justamente porque nao ha caso.

O precedente concreto que sustenta a politica: o gate do painel de IA sem historico foi um flake de
25 a 30% e recebeu correcao localizada no commit `55063d0`, nao retry nem timeout maior. A linha
correspondente da matriz carrega esse risco por escrito.

## 6. Artefatos de diagnostico

Verificado em `playwright.config.mjs` e no `ci.yml`, sem alteracao necessaria:

- `trace: 'retain-on-failure'` — trace preservado na falha;
- `screenshot: 'only-on-failure'`;
- reporter `list` + `html` (`playwright-report`) quando `CI` esta definido;
- o job `demo-smoke` publica `octaclin-web/playwright-report` e `octaclin-web/test-results` com
  `if: always()`, alem dos logs de API e web;
- o nome do project (`desktop-chromium` / `mobile-chromium`) e o titulo do teste aparecem no
  relatorio, o que identifica rota e etapa.

Todos os fixtures das suites sao sinteticos: rotas de API interceptadas por `page.route`, tokens
literais de teste, pacientes `paciente-1`. Nenhum cookie, token real, dado de paciente ou conteudo
clinico e publicado em artefato.

## 7. Evidencias automatizadas desta sessao

| Comando | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` (raiz, web, mobile) | PASS, lockfiles inalterados |
| `pnpm --dir octaclin-web typecheck` | PASS |
| `pnpm --dir octaclin-web lint` | PASS, 0 erros e 52 warnings conhecidos (igual ao baseline do PR 32) |
| `pnpm --dir octaclin-web build` | PASS |
| `pnpm --dir octaclin-web test:a11y` | PASS, 264/264 |
| `pnpm --dir octaclin-web test:reflow` | PASS, 60/60 |
| `pnpm --dir octaclin-mobile typecheck` | PASS |
| `pnpm --dir octaclin-mobile doctor` | PASS |
| `pnpm --dir octaclin-mobile test:security` | PASS, 6/6 |
| `pnpm --dir octaclin-mobile test:a11y` | PASS, 15/15 |
| `pnpm --dir octaclin-mobile audit:a11y` | PASS |
| `pnpm --dir octaclin-mobile audit:security` | PASS com as duas excecoes upstream conhecidas de `image-size` |
| `pnpm --dir octaclin-mobile build:validate` | PASS |
| `pnpm test:a11y:matriz` (novo) | RED antes da correcao, PASS 20/20 depois |
| `pnpm test:confiabilidade` | PASS, 16 referencias criticas |
| `pnpm security:secrets` | PASS |
| `git diff --check` | PASS |

O ciclo RED -> GREEN do gate novo foi este: com a matriz ja escrita e antes de tocar no `ci.yml`,
`pnpm test:a11y:matriz` reprovou com `Gate matriz-a11y: o job governanca nao existe em
.github/workflows/ci.yml`. O job `governanca` foi criado com os tres steps e o gate passou.
A divergencia detectada era real: `test:confiabilidade` e `security:secrets` estavam documentados
como obrigatorios e nao rodavam em lugar nenhum.

## 8. Evidencias manuais

Nenhuma validacao manual com leitor de tela foi executada nesta sessao. As evidencias manuais da
matriz sao as do PR 32, referenciadas e nao reexecutadas:

- NVDA 2026.1.1 com Visualizador da Fala, Chrome 151 e Edge 151, em `/login` (inicial e credenciais
  invalidas), `/pacientes`, `/pacientes/novo` e `/portal/checkins`;
- registro textual do que foi anunciado, em `RELATORIO_NVDA_PR32_2026-08-27.md`.

## 9. SKIPPED e NA

| Item | Classificacao | Motivo concreto | Condicao de fechamento |
| --- | --- | --- | --- |
| TalkBack em Android | SKIPPED | Sem Android SDK, emulador, JDK ou aparelho neste ambiente. A arvore de `react-native-web` nao substitui o TalkBack: o mapeamento de props e outro | Roteiro da secao 10 do relatorio do PR 33 em Android 13+ com registro de fala |
| VoiceOver em iOS | SKIPPED | Exige macOS, indisponivel | Roteiro da secao 11 do relatorio do PR 33 em iPhone real ou simulador |
| Fonte ampliada nativa | SKIPPED | Exige dispositivo; a troca de `height` por `minHeight` foi verificada so no codigo | Telas na maior escala de fonte do sistema, em aparelho real |
| Reducao de movimento nativa | SKIPPED | Exige a preferencia do sistema ligada em dispositivo; `prefers-reduced-motion` cobre a web, nao o aplicativo | Preferencia ativa no sistema, confirmando que nenhuma transicao essencial depende de animacao |
| NVDA nas demais rotas | SKIPPED | A matriz manual do PR 32 foi representativa por decisao de escopo | Rodada NVDA dedicada por superficie, como PR de governanca proprio |
| Autenticacao/ativacao no aplicativo Expo | NA | Nao existe tela de login nem fluxo de ativacao; `lib/api.ts` usa token literal de desenvolvimento | Nao se aplica enquanto a superficie nao existir |

Nenhum desses itens aparece como PASS em lugar nenhum da matriz, e o inventario executavel reprova
se alguem tentar declarar isso.

## 10. Riscos residuais

1. **Leitor de tela nativo nao verificado.** Nome, papel, estado e ordem de leitura reais no Android
   e no iOS permanecem desconhecidos. A auditoria estatica do mobile le codigo-fonte; ela impede
   regressao das correcoes do PR 33, nao prova o que TalkBack ou VoiceOver falam. Distribuicao mobile
   segue NO-GO.
2. **Cobertura de NVDA representativa, nao exaustiva.** O PR 32 comprovou um defeito transversal
   (titulo generico) que o axe-core nao sinalizava. Defeito da mesma natureza pode existir em rota
   nao visitada manualmente.
3. **Rotas novas nao entram na matriz sozinhas.** O inventario executavel detecta rota documentada
   que sumiu do spec, mas nao detecta rota nova do produto que ninguem documentou. Esse continua
   sendo trabalho de revisao humana no PR que cria a rota.
4. **Cobertura por suite completa.** `test:a11y` e `test:reflow` dependem de `smoke:visual` varrer
   todo o `testDir`. A protecao contra `testMatch`/`testIgnore` esta automatizada, mas mover um spec
   para fora de `tests/visual` continua sendo detectavel so pelo bloco/rota que a matriz exige.
5. **Emulacao de zoom.** O reflow e medido com viewport reduzido, aproximacao do zoom do navegador;
   nao substitui zoom real do sistema operacional.
6. **Contraste alem do axe-core.** O axe cobre `wcag2aa`, incluindo contraste de texto, mas nao
   avalia legibilidade percebida nem estados de foco em imagens de fundo.
7. **Duplicacao de tempo no job `demo-smoke`** (secao 4), ainda presente.

## 11. Proximos passos autorizados

1. Executar TalkBack e VoiceOver com os roteiros ja escritos, em aparelho ou emulador, e converter as
   quatro linhas SKIPPED do mobile em PASS ou FAIL com evidencia.
2. Rodada NVDA por superficie para reduzir o risco 2.
3. Remover os steps `test:fase248`, `test:fase249` e `test:fase251` do job `demo-smoke`, ja cobertos
   por `smoke:visual`, como PR proprio de custo de CI.

Nenhum deles foi iniciado neste PR.

## 12. Conclusao

**Esta validado:** a cobertura automatizada de acessibilidade da web em 33 rotas, seus estados e
interacoes, em dois viewports, com axe-core nas tags `wcag2a`, `wcag2aa`, `wcag21a` e `wcag21aa`;
os padroes ARIA dos componentes compartilhados; cinco jornadas completas somente por teclado; reflow
a 200% e 400%, espacamento de texto e `prefers-reduced-motion` na web; a auditoria estatica de
acessibilidade do aplicativo Expo. Tudo isso roda de forma bloqueante no CI, e agora a propria
matriz que descreve essa cobertura e verificada por maquina a cada PR.

**Nao esta validado:** o que leitores de tela nativos anunciam no Android e no iOS; o comportamento
do aplicativo com fonte ampliada e reducao de movimento do sistema operacional; e o comportamento com
NVDA fora das quatro rotas do PR 32. Esses itens estao classificados como SKIPPED, com motivo, risco
e condicao de fechamento, e nao podem ser declarados PASS sem que o inventario executavel reprove.
