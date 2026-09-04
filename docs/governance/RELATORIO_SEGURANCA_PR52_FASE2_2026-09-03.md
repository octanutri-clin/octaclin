# Relatorio de seguranca - PR 52 da governanca, fase 2: imutabilidade e correlacao

Data: 2026-09-03. Risco: R4 - bloqueador. Escopo: exclusivamente a **fase 2** do
PR 52 do `docs/governance/PROGRAMA_HARDENING_SEGURANCA_PRS_36_56.md`. Nao avanca
ao PR 53.

Norma duravel atualizada:
`docs/governance/POLITICA_TRILHA_AUDITORIA_E_REDACAO.md` (secoes 1, 5.1, 6.4, 9 e 10).

**Esta fase nao fecha o gate minimo do PR 52, e nao deve ser lida como tal.** O
gate diz "eventos criticos detectados; secrets/PHI ausentes dos logs; teste de
alerta e tabletop sintetico documentados". A fase 1 fechou as duas primeiras
metades; esta fase fecha as quatro pendencias que a fase 1 declarou como excecao
datada, e **nenhuma parte da terceira metade**. Alerta, runbook de resposta a
incidentes e tabletop sintetico continuam inteiramente na fase 3.

## 1. Baseline (hard gate)

- GitHub PR da fase 1: `#191` - estado `MERGED`.
- Merge commit da fase 1: `6d389f67676c376719125bdce81c8518adc56687`.
- `git merge-base --is-ancestor 6d389f6 origin/main` -> exit 0 (ancestral de `main`).
- HEAD inicial da fase 2 (= `origin/main`): `6d389f67676c376719125bdce81c8518adc56687`.

Nenhum controle dos PRs 49 a 51 nem da fase 1 foi enfraquecido. O redator de
`metadados`, o gate de cobertura e os dois caminhos de escrita permanecem
intactos: o inventario saiu de 181 para 182 chaves e o numero de call sites ficou
em 148, exatamente porque a unica chave nova (`loginsSuprimidos`) entrou em call
site ja existente.

Continua pendente do PR 51, para o proprietario: a evidencia redigida dos paineis
de Neon, Redis, Backblaze e Render (secoes 6.2 a 6.6 da norma daquele ciclo).
Esta fase nao a substitui.

## 2. Achado central: afirmacao verdadeira hoje, sem rede para amanha

A fase 1 encontrou um modulo afirmando garantia que nao entregava. A fase 2
encontrou a versao mais dificil do mesmo defeito: afirmacoes que eram
**verdadeiras no momento em que foram escritas** e que nada impedia de deixarem
de ser.

Tres exemplos, todos achados por revisao adversarial e todos corrigidos:

1. `servico-auth.ts` afirmava que a janela de deduplicacao e "de modulo, e nao de
   instancia" -- a propriedade correta, pela razao correta (o provider e
   declarado em 15 modulos). Mas **os dez testes novos passariam identicos** se
   alguem movesse a janela para campo de instancia: o teste de colapso usava uma
   instancia so, e os dois que usavam duas afirmavam *nao*-supressao, que passa
   nos dois desenhos. Provado por mutacao: com a janela em campo de instancia, o
   teste novo falha e os outros 54 passam.
2. `correlacao-bff.ts` afirmava que "nenhum valor de origem externa consegue
   virar id de correlacao", e tres linhas abaixo devolvia verbatim qualquer valor
   com forma de UUID v4. O cenario em que a frase era invocada -- um caminho que
   nao passe pelo middleware -- era exatamente o unico em que ela falhava.
3. `janela-deduplicacao-trilha.ts` herdou da fase 1 a frase "o pior caso e gravar
   de novo; nunca deixar de gravar um evento distinto". Ela era exata quando nao
   havia contagem de supressao. Sobre uma API que agora carrega residual, passou
   a prometer para o residual uma garantia que ele nao tem.

A licao que fica registrada na norma: **fechar uma excecao sem registrar o que
sobrou dela e como este defeito comeca**. Por isso a fase 2 fechou EXC-AUD-002,
003 e 004 e abriu EXC-AUD-006 a 010 no lugar.

## 3. O que foi entregue

### 3.1 Imutabilidade da trilha (fecha EXC-AUD-003)

Migracao `1720000001038-TornarTrilhaAuditoriaImutavel`: trigger
`before update or delete ... for each row` e trigger
`before truncate ... for each statement`, ambos `enable always`, levantando
excecao com `errcode = '42501'`. `REVOKE update, delete` condicionado a
`pg_roles` entra como **reforco**, e nao como mecanismo.

A inversao importa e foi deliberada. O repositorio conhece dois nomes de role,
mas nada obriga um ambiente a usa-los, e `REVOKE` contra o dono da tabela nao tem
efeito nenhum: um `REVOKE` sozinho rodaria verde sem proteger nada -- a forma de
falha que esta norma existe para impedir. `enable always` fecha o desvio por
`session_replication_role = 'replica'`; o trigger de statement existe porque
trigger de linha nao enxerga `TRUNCATE`. `INSERT` fica intocado, e os dois
caminhos de escrita da secao 5 continuam funcionando.

Hash-chain foi avaliado e descartado nesta fase: detecta, nao impede, e exigiria
mudar os dois caminhos de escrita. Virou EXC-AUD-008, junto com WORM e com a
ausencia de protecao contra o administrador do banco.

### 3.2 Teto de `auth.login.sucesso` (fecha EXC-AUD-002)

A janela de deduplicacao da fase 1 foi **generalizada em fabrica**
(`janela-deduplicacao-trilha.ts`) em vez de copiada: o proprio
`auditoria-autorizacao.ts` ja argumentava que duas copias divergiriam e que a
divergente seria a nao testada, e o argumento valia igual para a terceira.

Teto de uma escrita por `(tenant, usuario, estado de MFA)` a cada 60 s, com o
volume colapsado devolvido em `loginsSuprimidos` na proxima linha daquela chave.
Sem essa contagem o teto compraria volume com sub-reporte silencioso.

### 3.3 Correlacao web-backend (fecha EXC-AUD-004)

O middleware do `octaclin-web` emite um UUID proprio e **sobrescreve**
`x-request-id` em toda rota de `app/api`. Aceitar o id do cliente daria ao
remetente a escolha do identificador gravado numa tabela que esta fase acabou de
tornar append-only -- inclusive colidir de proposito com o id de outra
investigacao.

Cobertura: os 3 caminhos server-side (`requisitarBackendAutenticado`,
`renovarSessao`, `revogarSessaoAtual`) e as 15 rotas publicas de `app/api`,
incluindo as seis de auth. Duas delas -- `auth/login` e `auth/mfa/concluir-login`
-- gravam na trilha hoje; as outras quatro foram cobertas assim mesmo, porque se
a propagacao existisse so onde ja ha evento, o dia em que uma delas passasse a
auditar nasceria sem correlacao, que e literalmente a lacuna da EXC-AUD-004.

### 3.4 `/health/detalhado` sem mensagem crua do driver

`mensagemErro` eliminada. O payload publico passa a usar vocabulario fechado, e o
detalhe vai para log estruturado limitado ao **nome da classe** do erro -- mesma
regra da secao 7 da norma.

O endpoint **continua publico e sem guarda**, deliberadamente: os consumidores
reais (`scripts/monitor-producao.mjs`, o workflow de staging e o smoke do
`octaclin-web`) chamam sem token, e o momento em que o detalhe importa e quando o
banco esta fora -- quando emitir JWT provavelmente tambem falha. Detalhe que so
aparece com o sistema saudavel nao diagnostica indisponibilidade. Nenhum dos seis
consumidores mapeados le o campo `mensagem`, entao o contrato ficou intacto.

## 4. Correcoes aplicadas apos revisao adversarial

| Achado | Severidade | O que era | Saida escolhida |
| --- | --- | --- | --- |
| Janela de modulo sem prova | CORRIGIR | os 10 testes novos nao discriminavam entre janela de modulo e de instancia | codigo ja cumpria; escrito o teste que faltava, com mutacao provando que ele morde |
| Garantia falsa em `correlacao-bff.ts` | BLOQUEIA | "nenhum valor externo vira id" era falso para UUID v4 | promessa corrigida; fixar a origem por nonce foi descartado por ser **incorreto** (middleware roda em Edge, rotas em processos distintos) |
| Residual perdido em silencio | CORRIGIR | `liberar`, eviction e restart descartavam a contagem | as duas: `liberar` passou a preservar; eviction e restart viraram limite escrito (EXC-AUD-006) |
| Segunda barreira ausente | CORRIGIR | chamadas da janela fora de `try/catch` em `emitirSessaoUsuario` | codigo cumpre; testado com `obterTotalFalhas` lancando na leitura posterior a escrita |
| Colisao por caixa em `sessao-bff.ts` | CORRIGIR | spread de objeto e case-sensitive e `Headers` nao: `{'X-Request-Id':'HOSTIL','x-request-id':'uuid'}` vira `"HOSTIL, uuid"` e chegaria a trilha | codigo cumpre; construcao por `Headers`, `set` por ultimo |
| Matcher sem guarda | CORRIGIR | toda a garantia repousa no matcher, e nada o testava | teste avalia o `config.matcher` real com o conversor do proprio Next |
| Regra do backend replicada | CORRIGIR | o spec web redigitava a regex, entao drift nao reprovava em lugar nenhum | assercao criada no backend; comentario do lado web aponta para ela |
| `reportarFalha` nao era ponto unico | NOTA | `catch` de Redis descartava o erro sem destino | as duas: Redis roteado; frase corrigida onde nao ha erro a rotear |
| Compensacao superdeclarada | NOTA | `sessoes_usuario` descrita como evidencia do login suprimido | promessa corrigida: prova a contagem, nao a origem |

## 5. Validacoes (executadas neste ciclo)

| Comando | Resultado |
| --- | --- |
| `pnpm --dir octaclin-backend typecheck` | PASS |
| `pnpm --dir octaclin-backend test` | 176 suites PASS / 3 SKIPPED; 1576 testes PASS / 31 SKIPPED |
| `pnpm --dir octaclin-web typecheck` | PASS |
| `pnpm --dir octaclin-web lint` | 52 warnings, 0 errors -- identico a linha de base |
| `pnpm --dir octaclin-web test:correlacao:bff` | 57 PASS / 0 FAIL |
| `pnpm --dir octaclin-web test:authz` | 149 PASS / 0 FAIL |
| `pnpm --dir octaclin-web test:seguranca-operacional` | 10 PASS |
| `pnpm --dir octaclin-web test:apis-dinamicas` | 100 arquivos validados |
| `pnpm audit:redacao-auditoria` | 182 chaves / 148 call sites |
| `pnpm test:redacao-auditoria` | 24 PASS |
| `pnpm test:confiabilidade` | 28 referencias criticas |
| `pnpm security:secrets` | nenhum secret |
| `node --test scripts/test-runbook-suporte.mjs scripts/test-backup-producao.mjs scripts/test-producao-isolada.mjs` | 3 PASS |
| `node --test scripts/validar-triagem-seguranca.spec.mjs` | 5 PASS |
| `git diff --check` | limpo |

### 5.1 Prova de comportamento: onde ela existe e onde nao existe

**A rejeicao real de `UPDATE`, `DELETE` e `TRUNCATE` nao rodou na maquina de
desenvolvimento.** Nao ha Docker nela; os 5 casos escritos em
`rls-isolamento-tenant.integracao.spec.ts` entram entre os 31 `SKIPPED`. Eles
executam no CI, no passo `Provar RLS com Testcontainers descartavel`
(`.github/workflows/ci.yml`). O que a maquina de desenvolvimento prova sozinha e
o DDL emitido, pelo `.spec.ts` que roda sempre.

**Verificado em staging, no Neon, em 2026-09-03, pelo proprietario**, seguindo o
procedimento do `RUNBOOK_PRODUCAO.md`:

| Verificacao | Resultado |
| --- | --- |
| `migration:show` antes | `[ ] TornarTrilhaAuditoriaImutavel1720000001038`, unica pendente |
| `migration:run` com `neondb_owner` | aplicada |
| `pg_trigger` (catalogo) | os dois gatilhos presentes, `tgenabled = 'A'` |
| `update` dentro de `begin`/`rollback` | `ERROR ... append-only: UPDATE rejeitado`, `SQLSTATE 42501` |
| login real apos o deploy | `auth.login.sucesso` gravado |
| segundo login dentro da janela | `loginsSuprimidos` presente na linha seguinte da mesma chave |

As duas ultimas linhas provam coisas diferentes e as duas importavam. O login
gravado prova que **`INSERT` continua livre com os gatilhos ativos** -- o risco
real desta migration nunca foi barrar de menos, e sim barrar a propria escrita
legitima da trilha, que so apareceria em runtime. E `loginsSuprimidos` prova o
teto da EXC-AUD-002 com a contagem do volume colapsado, e nao apenas a supressao.

Isso e mais forte que o job de testcontainers, porque exercita o Postgres do
provedor e nao um container descartavel. **EXC-AUD-003 esta provada em
comportamento em staging.** Continua **nao** provada em producao: producao exige
evidencia de producao, e a aplicacao la e uma janela deliberada e separada.

Duas coisas que o teste de `update` sozinho **nao** prova, e por isso a
verificacao de catalogo nao e redundante: a sessao do SQL Editor nao esta em
`session_replication_role = 'replica'`, entao um gatilho comum passaria no mesmo
teste -- so `tgenabled = 'A'` distingue `ENABLE ALWAYS` de `ENABLE`. E o
`TRUNCATE` nao foi exercitado manualmente; ele depende do gatilho de statement,
cuja existencia foi confirmada pelo catalogo.

`SKIPPED` nao e aprovado -- e a mesma regra que o `AGENTS.md` impoe.

Um dos cinco casos merece registro porque foi desenhado para nao ser tautologico:
a role de prova do CI (`octaclin_rls_prova`) **tem** `UPDATE` concedido e **nao**
esta na lista do `REVOKE`, entao um `42501` ali so pode ter vindo do trigger.

A propagacao do `x-request-id` tambem foi provada com `fetch` espionado em teste,
e nao contra backend real com leitura da linha gravada em `user_action_logs`
(EXC-AUD-010).

## 6. O que esta fase **nao** entrega

| Item | Fase |
| --- | --- |
| Alertas sobre o contador de falhas e sobre volume de negativa de autorizacao | 3 |
| Runbook de resposta a incidentes, escalonamento e preservacao de evidencia | 3 |
| Tabletop sintetico documentado | 3 |
| Teto para `auth.token.renovado`; origem da requisicao na identidade do teto de login | 3 (EXC-AUD-007) |
| Correlacao no mobile, em jobs, cron e webhooks | 3 (EXC-AUD-009) |
| Residuo publico de `/health/detalhado`: saturacao do pool, contagem de migrations, `NODE_ENV`, versao da API do WhatsApp | 3 |
| Imutabilidade contra o administrador do banco; hash-chain; WORM | PR 53 ou posterior (EXC-AUD-008) |

## 7. Riscos residuais

- O trigger e removivel por quem tem catalogo: `alter table ... disable trigger`
  e `drop trigger` continuam possiveis, e uma migracao futura pode remover o
  controle. A verificacao (`pg_trigger.tgenabled = 'A'`) esta no
  `RUNBOOK_PRODUCAO.md`, mas nada a executa automaticamente hoje.
- Apagar linha da trilha passou a exigir procedimento fora de banda com role
  administrativa. Isso e o objetivo do controle, mas e uma mudanca operacional
  real: pedido de eliminacao LGPD nao se resolve mais por `DELETE`. O que mantem
  dado pessoal fora da trilha continua sendo a redacao.
- `loginsSuprimidos` e piso, nao total exato: a contagem some sem marcador em
  pressao de teto e em restart. A assimetria forte -- evento **distinto** nunca
  deixa de ser gravado -- continua valendo.
- O teto de login e a janela de dedup sao por processo e em memoria. Com N
  replicas o teto real e N escritas por janela.
- Dois logins simultaneos do mesmo usuario em dispositivos diferentes colapsam
  numa linha, porque IP e user agent nao chegam a camada de servico.
  `sessoes_usuario` compensa parcialmente: prova a contagem, nao a origem, e ela
  propria aceita `UPDATE`.
- A garantia de correlacao tem **um** ponto de sustentacao, o middleware, e nao
  dois. A recusa de valor externo dentro do BFF e limite de formato, nao segunda
  barreira. Por isso o teste do matcher e o controle, e nao um detalhe.

## 8. Rollback

Reverter a migracao `1720000001038` (o `down()` derruba os dois triggers e a
funcao e devolve `update, delete` as roles nomeadas) devolve a trilha ao estado
"append-only por convencao" da fase 1 -- sem perda de dado e sem quebrar os
caminhos de escrita. Reverter o commit da fase 2 devolve tambem o teto de login,
a correlacao e o vocabulario fechado de `/health/detalhado`, e reabre EXC-AUD-002,
003 e 004.

Nenhum item desta fase altera contrato HTTP existente, conexao, RLS ou
`ExecutorTenant`.

## 9. Operacoes externas

Esta fase **nao** aplicou DDL, nao executou migracao contra banco algum, nao tocou
configuracao de provedor e nao acessou ambiente real.

Mas ela **exige uma operacao externa antes do merge**, e a primeira versao deste
relatorio errou ao dizer o contrario. O texto anterior afirmava que "a migracao
entra em producao pelo fluxo normal de deploy, governado por
`BANCO_EXECUTAR_MIGRACOES`". Isso esta errado, e o erro tem a mesma forma do
achado central desta fase: uma frase confortavel que ninguem tinha checado contra
o mecanismo.

O que o `RUNBOOK_PRODUCAO.md` ja dizia, e que continua valendo: a role de runtime
`octaclin_app_producao` **nao tem `CREATE` no schema `public`** -- por decisao do
PR 51, e devolver esse privilegio desfaz aquela separacao. A migracao
`1720000001038` cria uma funcao de trigger, entao ela e DDL que a role de runtime
nao pode executar. Toda migration com DDL precisa ser aplicada **fora de banda,
com `neondb_owner`, antes do merge**.

Se `BANCO_EXECUTAR_MIGRACOES` estiver `true` no runtime, o boot novo falha com:

```
Migration "TornarTrilhaAuditoriaImutavel1720000001038" failed, error: permission denied for schema public
```

Isso **e o controle do PR 51 funcionando**, e nao um defeito da migracao. O Render
mantem a instancia anterior servindo, entao nao ha indisponibilidade -- o deploy
entra em loop de falha e o sintoma so aparece no painel, nunca no CI.

Procedimento obrigatorio, detalhado em `RUNBOOK_PRODUCAO.md` na secao
"Trilha de auditoria append-only": branch de backup no Neon, confirmacao de
projeto/branch/banco/role, `BANCO_EXECUTAR_MIGRACOES=false` no servico,
`migration:run` com `DATABASE_URL` de `neondb_owner` somente na sessao local, e
verificacao de `pg_trigger.tgenabled = 'A'` depois.

**Achado operacional do ciclo, alheio a esta fase mas descoberto por ela.** O
servico web de staging nao tinha `OCTACLIN_BACKEND_URL` nem
`OCTACLIN_TENANT_SLUG`, ambas marcadas `Sim` no `VARIAVEIS_AMBIENTE.md`. O login
falhava com "O servico de acesso do OctaClin esta configurado incorretamente",
enquanto as rotas publicas continuavam funcionando -- elas caem em
`OCTACLIN_BACKEND_URL ?? NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`, e a
variavel publica legada mascarava a ausencia da correta em nove rotas.
`configuracao-acesso-bff.ts`, usado pelo login, nao tem esse fallback e por isso
foi o unico a falhar.

Nao e regressao desta fase, e sim desvio de configuracao anterior que a
validacao pos-deploy revelou. Duas consequencias: **conferir as mesmas duas
variaveis no web de producao antes do deploy de la**, e registrar que uma
variavel `NEXT_PUBLIC_*` -- publica, embarcada no bundle do navegador -- decide
origem de backend em rota server-side. Funciona, e e a fonte errada para essa
decisao; o fallback silencioso e da mesma familia que este PR vem eliminando.
Candidato a fase 3.

**Lacuna registrada:** nada no CI detecta que um PR carrega migration com DDL e
portanto exige aplicacao fora de banda. E a segunda vez que esta classe de falha
aparece -- a primeira esta registrada na secao 3 da
`POLITICA_PROVIDERS_MENOR_PRIVILEGIO.md`. Um gate que reprove PR com migration
nova sem checklist de aplicacao fora de banda cabe na fase 3.
