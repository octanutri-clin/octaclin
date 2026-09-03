# Relatorio de seguranca - PR 52 da governanca: Observabilidade, auditoria e resposta (fase 1)

Data: 2026-09-02. Risco: R4 - bloqueador. Escopo: exclusivamente a **fase 1** do
PR 52 do `docs/governance/PROGRAMA_HARDENING_SEGURANCA_PRS_36_56.md`. Nao avanca
ao PR 53.

Norma duravel produzida:
`docs/governance/POLITICA_TRILHA_AUDITORIA_E_REDACAO.md`.

**O gate minimo do PR 52 tem tres metades, e esta fase fecha duas.** O gate diz
"eventos criticos detectados; secrets/PHI ausentes dos logs; teste de alerta e
tabletop sintetico documentados". As duas primeiras estao cobertas e provadas
por teste; alertas, runbook de resposta a incidentes e tabletop sintetico ficam
para a fase 3. O fatiamento segue o espirito do PR 51, que entrou medindo antes
de bloquear: um controle de deteccao declarado sem evidencia executavel e
exatamente o defeito que este PR encontrou.

## 1. Baseline (hard gate)

O PR 52 vem depois do PR 51 (Providers e menor privilegio).

- GitHub PR da medicao do PR 51: `#189` - estado `MERGED` (`43e7ee0`).
- GitHub PR da falha fechada do PR 51: `#190` - estado `MERGED`.
- Merge commit do PR 51 (falha fechada):
  `894567748aa83bed7cdcba6b1e17df3316fe95a5` (2026-09-02T12:54:33-03:00), base `main`.
- `git merge-base --is-ancestor 8945677 origin/main` -> exit 0 (ancestral de `main`).
- HEAD inicial do PR 52 (= `origin/main`): `894567748aa83bed7cdcba6b1e17df3316fe95a5`.

Nenhum controle dos PRs 49, 50 e 51 foi enfraquecido: instalacao congelada,
lockfiles, ledger de excecoes, SBOM, digests imutaveis, runtime non-root,
Actions por SHA e a falha fechada de menor privilegio de providers permanecem
intactos. O redator novo nao toca conexao, RLS, `ExecutorTenant` nem contrato
HTTP existente.

Continua pendente do PR 51, para o proprietario: a evidencia redigida dos
paineis de Neon, Redis, Backblaze e Render (secoes 6.2 a 6.6 da norma daquele
ciclo). Esta fase nao a substitui.

## 2. Achado central

**O repositorio declarava trilha de auditoria e nao media a propria cobertura.**

`user_action_logs.metadados` e uma coluna `jsonb` sem schema, alimentada por
dezenas de call sites espalhados. Cada um escolhe suas proprias chaves, e nada
-- nem tipo, nem migration, nem revisao -- impedia que uma delas passasse
adiante o termo de busca digitado pela recepcao, o humor autorrelatado de um
paciente ou o motivo clinico de um cancelamento.

Medicao no baseline `8945677`, com o extrator deste PR:

| Medida | Valor |
| --- | --- |
| Chaves distintas de `metadados` alcancadas pelo extrator | 88 |
| Call sites de auditoria com `metadados` literal | 76 |
| Redacao aplicada no caminho de escrita | **nenhuma** |

O numero de chaves e piso, e nao teto: as quatro escritas diretas de
`planos-alimentares` (secao 3, SEC-PR52-008) nao passavam por nenhuma ancora
reconhecivel naquele commit, entao suas chaves nem entram nessa contagem.

A revisao adversarial mediu o **primeiro rascunho do redator desta fase** contra
as chaves reais e encontrou o resultado que motiva a norma inteira: ele
alcancava **duas** delas, e as duas eram falso positivo. A suite ficava verde
porque os testes do redator alimentavam chaves inventadas pelo proprio teste --
nenhum deles atravessava a distancia entre o que o modulo cobria e o que os call
sites escreviam.

Quatro campos vazavam em claro na tabela imutavel:

| Campo | Onde | Por que e vazamento |
| --- | --- | --- |
| `filtros.busca` (por `...filtros`) | `controlador-pacientes.ts` | termo digitado na busca de paciente. O proprio repositorio classifica esse campo como PII: `servico-pacientes.ts:163` o passa por `gerarHashesConsultaPii` **justamente para nunca armazena-lo** |
| `humor`, `adesaoPlano` | `controlador-portal-paciente.ts` | check-in clinico gravado ao lado do `pacienteId`, enquanto o mesmo objeto ja reduzia `sintomas` e `observacoes` a booleano por serem clinicos |
| `motivo` | `controlador-agenda.ts` | texto livre de ate 500 caracteres num cancelamento de consulta, com o call site irmao ja fazendo `possuiMotivo: Boolean(...)` |
| `hashConteudo` | `servico-planos-alimentares.ts` | sha256 de conteudo clinico, ao lado do `versaoId` que ja identifica o artefato |

Todos foram corrigidos **no call site**, que e onde estava o defeito.

Por que isso e R4 e nao higiene: a trilha e a tabela que mais gente le, entra em
backup, viaja em dump de suporte e sobrevive ao expurgo do dado de origem. Um
dado clinico que caia aqui vaza para todo mundo que tem leitura de auditoria, e
continua vazado depois que o titular pediu exclusao. Gravar o conteudo do
check-in dentro do log do acesso ao check-in anula exatamente a separacao de
papeis que a trilha existe para sustentar.

### 2.1 A doutrina que ficou registrada no codigo

O erro nao foi a lista estar curta. Foi o modulo **afirmar uma garantia que nao
entrega**, fazendo o proximo revisor confiar nela e parar de olhar o call site.
Um blocklist por nome de chave sobre `metadados` de forma livre nunca sera
completo.

E a mesma licao do PR 51, onde `nao-verificado` e explicitamente distinguido de
aprovacao: um controle que nao inspecionou o caso nao pode ser lido como carimbo
de que o caso esta certo.

Por isso, nesta fase:

1. o redator se declara **rede de ultima instancia**, e nao garantia;
2. a responsabilidade primaria continua sendo **nao coletar o dado na origem**;
3. a cobertura passou a ser **verificavel por gate**, e nao afirmada em
   comentario.

## 3. Achados secundarios corrigidos

| # | Achado | Onde | Consequencia |
| --- | --- | --- | --- |
| SEC-PR52-001 | Espalhamento `...filtros` grava o termo de busca (PII) na trilha imutavel | `controlador-pacientes.ts` | PII em claro; e promessa em aberto: campo novo no DTO passaria a ser gravado sem revisao |
| SEC-PR52-002 | `humor` e `adesaoPlano` do check-in gravados ao lado do `pacienteId` | `controlador-portal-paciente.ts` | PHI legivel por quem so tem direito ao rastro |
| SEC-PR52-003 | `motivo` de cancelamento, texto livre de 500 caracteres | `controlador-agenda.ts` | PHI rotineiro ("internada", "quimio na quinta") em campo sem controle de acesso clinico |
| SEC-PR52-004 | `hashConteudo` de plano alimentar gravado ao lado do `versaoId` | `servico-planos-alimentares.ts` | oraculo de confirmacao sobre conteudo clinico, sem acrescentar evidencia |
| SEC-PR52-005 | Login, falha de login, logout e refresh nao deixavam rastro nenhum | `servico-auth.ts` (nao injetava auditoria) | o ciclo de vida da credencial era o unico ponto do sistema sem evidencia de quem entrou |
| SEC-PR52-006 | Negativa de autorizacao invisivel: as guardas lancavam `ForbiddenException` mudas | `guarda-papeis.ts`, `guarda-permissoes.ts` | 403 indistinguivel de requisicao que nunca aconteceu; enumeracao e credencial comprometida sem sinal |
| SEC-PR52-007 | A exportacao da propria trilha nao era auditada | `controlador-operacoes.ts` | quem levava o arquivo inteiro nao aparecia nele |
| SEC-PR52-008 | Quatro escritas diretas em `UserActionLogOrm` fora do servico, enquanto o comentario do modulo afirmava exclusividade | `planos-alimentares` | payload livre gravado por um caminho que nenhum filtro cobria, e cuja existencia a documentacao negava |
| SEC-PR52-009 | Falha de gravacao da trilha so produzia `warn`, sem contador | `servico-auditoria.ts` | a trilha podia parar de gravar por horas sem alarme; ausencia de registro e indistinguivel de ausencia de acesso |
| SEC-PR52-010 | Falha de assinatura HMAC do webhook publico do WhatsApp era invisivel | `controlador-webhook-whatsapp.ts` | tentativa de forjar webhook nao deixava rastro em canal nenhum |
| SEC-PR52-011 | `phone_number_id` concatenado em log de string livre e `erro.message` cru do provedor | `controlador-webhook-whatsapp.ts` | numero de atendimento da clinica e SQL/telefone/URL assinada em log que sai do sistema |
| SEC-PR52-012 | Mensagem crua do erro de banco no log de falha da trilha | `servico-auditoria.ts` | vazaria pelo log de falha exatamente o que a redacao acabara de tirar da trilha |
| SEC-PR52-013 | **O proprio gate pulava escrita opaca em silencio**, e nao reconhecia a familia de envoltorios privados de auditoria | `scripts/validar-redacao-auditoria.mjs` | o mesmo defeito que o PR existe para eliminar, dentro do controle: escrita sem literal a vista era `continue`, e as chaves de `metadados` de 14 arquivos -- rotas clinicas inteiras -- nunca entraram no inventario |
| SEC-PR52-014 | `contato` -- telefone WhatsApp do paciente -- gravado **em claro** na trilha imutavel | `controlador-comunicacoes.ts` (2 call sites) | o mesmo servico guarda esse telefone cifrado (`paciente.contatoCriptografado`); a trilha entregava em claro o valor que a cifra protege no banco, e nenhum padrao do redator o alcancava |
| SEC-PR52-015 | `alertaDisparado` -- classificacao de risco derivada de `frustracaoScore >= 70` -- gravado ao lado do `pacienteId` | `controlador-ia.ts` | e o **resultado** da inferencia clinica, e nao o rastro de que ela aconteceu; mesma classe de `humor` e `adesaoPlano` (SEC-PR52-002) |
| SEC-PR52-016 | `iconeSvg` -- markup livre, sem `@MaxLength` no DTO -- copiado para `metadados` | `controlador-gamificacao.ts` | payload arbitrario do cliente virando conteudo permanente de `user_action_logs` |
| SEC-PR52-017 | `...dados` (DTO de configuracao) espalhado dentro de `metadados` | `controlador-gamificacao.ts` | mesma promessa em aberto do SEC-PR52-001: campo novo no DTO passaria a ser gravado sem revisao |
| SEC-PR52-018 | Chave chamada `motivo` reintroduzida por dois call sites de enum fechado | `servico-auth.ts`, `controlador-documentos-clinicos.ts` | aprovar o nome `motivo` em `CHAVES_SEGURAS` reabriria a porta que o SEC-PR52-003 fechou: o proximo `motivo: dados.motivo` passaria em silencio |

Sobre o SEC-PR52-005: o desenho ficou restrito pela propria RLS. `tenant_id` e
NOT NULL e a escrita passa por `ExecutorTenant`, entao falha de login com tenant
ou usuario inexistente **fica fora da trilha** -- so log estruturado, sem
e-mail, sem slug e sem hash de nenhum dos dois. Duas razoes independentes:
inventar um tenant sintetico criaria um balde de linhas fora de qualquer escopo
real, e escrever fora do `ExecutorTenant` seria escrita sem RLS no caminho
anonimo do login; alem disso, nesses dois caminhos o atacante escolhe livremente
o valor que decide a chave de protecao de abuso, o que tornaria o teto por chave
inutil como limite total. Com tenant e usuario resolvidos, a falha vai para a
trilha, com o teto de 5 por (tenantSlug, e-mail) em 15 minutos que o
`ProtecaoAbuso` ja aplica.

Sobre o SEC-PR52-006: a deduplicacao usa janela de 60 s por chave, com o **alvo
concreto** dentro da identidade do evento. Sem isso a dedup usaria so o template
da rota, e sondar 500 pacientes distintos produziria uma linha por minuto --
apagando exatamente o sinal de enumeracao que auditar o 403 existe para
detectar. Parametro em formato UUID canonico vai cru para `recurso_id`; qualquer
outro vira `op:<sha256 truncado>`, que entra na chave e **nunca** na trilha, com
`alvoOpaco: true` na linha. Duas razoes concretas para essa regra: `recurso_id`
e coluna `uuid` no Postgres, entao gravar slug derrubaria o `INSERT` e perderia
a linha inteira; e as guardas rodam **antes** dos pipes do Nest, entao
`ParseUUIDPipe` ainda nao validou nada quando o registro acontece.

Sobre o SEC-PR52-013: as ancoras do gate exigiam ver o literal `{` na propria
chamada. Escrita que nao exibia literal era pulada -- nao reprovada --, e um
envoltorio privado (`this.auditar(...)`, `this.registrar(...)`,
`this.registrarAuditoria(...)`) escondia duas coisas ao mesmo tempo: o salto
interno, que passa a variavel, e o literal de verdade, que esta no call site
externo e nao era lido porque o nome do envoltorio nao casava com ancora
nenhuma. O gate reportava 97 chaves em 90 call sites e afirmava cobertura sobre
um recorte do backend. Corrigido no mesmo ciclo: escrita opaca virou reprovacao,
e os envoltorios passaram a ser declarados (secao 4.5). O inventario real e de
**181 chaves em 148 call sites**, e foi nesse lote que apareceram os
SEC-PR52-014 a SEC-PR52-017.

Sobre o SEC-PR52-014: o achado mais grave desta fase. `AssociarContatoWhatsappDto`
e `RegistrarNotaWhatsappDto` carregam `contato: string`, que
`servico-comunicacoes.ts` normaliza como telefone e cifra antes de guardar no
paciente. Os dois call sites de auditoria gravavam `contato: dados.contato` sem
passar por cifra nenhuma. O redator nao o alcancava: `contato` nao esta no
vocabulario de PII (que tem `telefone` e `celular`), e o padrao de valor de 11
digitos nao casa com um telefone de 13 digitos com DDI. A correcao foi no call
site -- o telefone saiu dos dois; `pacienteId` e o `recursoId` da nota continuam
dizendo de quem e o registro.

Sobre o SEC-PR52-018: a saida escolhida foi **renomear a chave**, e nao aprovar
o nome. Os dois call sites gravam vocabulario fechado emitido pelo backend
(`credencial_invalida`, `contato_ausente`, `canal_ausente`, `template_ausente`),
entao o valor e inofensivo; o problema e que `CHAVES_SEGURAS` aprova por nome, e
`motivo` e exatamente o nome que um call site usa quando vai gravar o texto que
uma pessoa escreveu. Os dois passaram a gravar `motivoTecnico`, e a forma para
motivo livre continua sendo `possuiMotivo`.

Sobre o SEC-PR52-009: o contador passou a ser variavel de modulo, e nao campo de
instancia. `ServicoAuditoria` esta em `providers` de 15 modulos Nest, e o
container cria uma instancia por modulo -- um campo de instancia daria 15
contadores independentes, e o alarme da fase 3 leria cerca de um quinze avos das
falhas, abaixo de qualquer limiar util.

## 4. Correcao aplicada

### 4.1 Redator

`octaclin-backend/src/infraestrutura/auditoria/redacao-auditoria.ts` -- dominio
puro, sem Nest, sem I/O e sem relogio, no mesmo padrao de
`seguranca/menor-privilegio-providers.ts`. Tres grupos de termo (credencial,
PII, PHI), casamento por substring com normalizacao que dobra plural, termos de
tres letras (`rg`, `cep`, `imc`) apenas por segmento, padroes de valor para o
caso em que a chave nao denuncia nada, limites de profundidade, de chaves e de
caracteres, e resumo opaco para binario.

Duas excecoes nomeadas preservam **evidencia, e nao dado**: `hashIntegridade`
(prova de qual artefato foi entregue ao titular numa exportacao LGPD, sem outro
identificador ao lado) e `documentoLegal` (o tipo do consentimento aceito). Os
booleanos de `preferenciasContato` sobrevivem pela regra de tipo -- sao a unica
prova de a quais canais o titular consentiu, e a trilha e imutavel.

### 4.2 Gate de cobertura

`scripts/validar-redacao-auditoria.mjs` importa `chaveEhCobertaPorRegra` do
`.ts` real, sem copia paralela do vocabulario, e reprova quatro coisas -- cada
uma com arquivo, chave e o que fazer:

| Reprovacao | Regra |
| --- | --- |
| Chave descoberta | nao casa com regra, nao e excecao de evidencia e nao esta em `CHAVES_SEGURAS` (166 entradas, cada uma com justificativa escrita) |
| Espalhamento opaco | `...filtros`, `...dados.x`, `...f()` dentro de `metadados`; campo condicional com literal a vista continua aceito; espalhamento do identificador que um envoltorio declarado repassa e o proprio salto declarado |
| Escrita opaca | `metadados` que nao e literal (variavel, parametro tipado, campo de interface). Antes era pulada em silencio -- ver SEC-PR52-013 |
| Terceiro caminho de escrita | `getRepository(UserActionLogOrm).save` fora de `servico-auditoria.ts` -- a afirmacao de exclusividade virou teste |
| Piso de sanidade | mais de 150 chaves e mais de 120 call sites, para o gate nao ficar verde por ter parado de olhar |

Verificacao negativa registrada: contra o codigo pre-correcao, o gate produz 3
reprovacoes.

O extrator percorre caractere a caractere com pilha de containers, e nao linha a
linha. A primeira versao era por linha e perdia em silencio todo literal escrito
numa unica linha -- que e a forma mais comum nos call sites. Um gate que perde
call site em silencio e pior do que gate nenhum: produz a mesma confianca
infundada que este PR existe para desfazer.

### 4.3 Envoltorios declarados

O gate le `metadados` quando ha literal a vista. Um envoltorio privado de
auditoria parte essa leitura em duas metades -- o salto interno, opaco, e o
literal do call site externo, que so e alcancado se o gate souber o nome do
envoltorio. `ENVOLTORIOS_DECLARADOS` declara as duas de uma vez: arquivo, nome
do envoltorio, indice do argumento que carrega o payload, identificador
repassado no salto interno e justificativa escrita.

16 envoltorios declarados, em 15 arquivos:

| Arquivo | Envoltorio | Repassa |
| --- | --- | --- |
| `servico-auth.ts` | `registrarTrilha` | `entrada` |
| `controlador-financeiro-agenda.ts` | `registrar` | `metadados` |
| `controlador-automacoes.ts` | `registrarAuditoria` | `metadados` |
| `controlador-comunicacoes.ts` | `registrarAuditoria` | `metadados` |
| `controlador-gamificacao.ts` | `registrarAuditoria` | `metadados` |
| `controlador-ia.ts` | `registrarAuditoria` | `metadados` |
| `controlador-materiais.ts` | `registrarAuditoria` | `metadados` |
| `controlador-mobile.ts` | `registrarAuditoria` | `metadados` |
| `controlador-operacoes.ts` | `registrarAuditoria` | `metadados` |
| `controlador-operacoes.ts` | `registrarExportacao` | `filtros` |
| `controlador-questionarios.ts` | `registrarAuditoria` | `metadados` |
| `controlador-condutas-terapeuticas.ts` | `auditar` | `metadados` |
| `controlador-consentimentos-evolucao-fotografica.ts` | `auditar` | `metadados` |
| `controlador-documentos-clinicos.ts` | `registrar` | `metadados` |
| `controlador-evolucoes-fotograficas.ts` | `auditar` | `metadados` |
| `servico-modelos-plano-alimentar.ts` | `registrarAuditoria` | `entrada.metadados` |
| `servico-receitas-nutricionais.ts` | `registrarAuditoria` | `entrada.metadados` |

O mecanismo e fail-closed nas duas pontas, e e isso que o torna aceitavel:
envoltorio nao declarado nao tem os call sites lidos **e** nao tem o salto
interno perdoado -- ele reprova. Declarar e a unica forma de ficar verde, e
declarar obriga a expor as chaves dos call sites ao inventario. Trocar o
argumento por outra coisa volta a reprovar, e outra escrita opaca no mesmo
arquivo continua reprovando. A ancora exige `this.`, entao a assinatura do
proprio envoltorio nao e contada como call site.

Dois nao-envoltorios, para o registro: `registrarAuditoriaNaTransacao` de
`servico-auditoria.ts` e caminho de escrita (aplica a redacao), e a declaracao
de uma funcao nao e chamada dela.

### 4.4 Cobertura de eventos

15 acoes novas:

| Familia | Acoes |
| --- | --- |
| Autenticacao e autorizacao | `auth.login.sucesso`, `auth.login.falha`, `auth.token.renovado`, `auth.sessao.encerrada`, `auth.autorizacao.negada` |
| Operacao e LGPD | `operacoes.outbox.reprocessar`, `operacoes.comunicacoes_falha.reprocessar`, `operacoes.assinatura.aplicar_plano`, `operacoes.lgpd_retencao.programar`, `operacoes.lgpd_solicitacao.atualizar_status`, `operacoes.lgpd_solicitacao.preparar_resposta` |
| Exportacao | `operacoes.auditoria.exportar_csv`, `operacoes.outbox_falhas.exportar_csv`, `operacoes.lgpd_solicitacao.exportar_csv`, `cliente.convites_historico.exportar_csv` |

As exportacoes gravam volume por `contarLinhasCsv`, que respeita citacao de CSV:
contar quebra de linha crua inflaria o numero quando ha celula multilinha, e
evidencia errada de volume nao e evidencia. As linhas em si nunca entram --
copia-las faria o registro do acesso conter o dado acessado.

Nota de escopo: `auth.login.sucesso` tambem e emitido na ativacao de convite de
paciente, porque `servico-convites-paciente.ts` chama `emitirSessaoUsuario`. A
acao cobre "sessao emitida", e nao apenas "passou pelo endpoint de login"; quem
for triar por ela precisa saber disso.

### 4.5 Dois caminhos de escrita, os dois redigem

`ServicoAuditoria.registrar` e `registrarAuditoriaNaTransacao`. O segundo existe
porque as quatro escritas de `planos-alimentares` rodam dentro de um
`ExecutorTenant.executar` que ja abriu transacao com `pessimistic_write`:
rotea-las pelo primeiro pediria segunda conexao do pool -- risco de auto-deadlock
sob pressao -- e quebraria a atomicidade, deixando registro de publicacao para
uma publicacao que rolou de volta.

A diferenca de tratamento do erro e deliberada: o caminho da transacao
**propaga** (engolir produziria publicacao comitada sem trilha), o outro
continua engolindo para nao derrubar a acao de negocio. Um terceiro caminho e
reprovado pelo gate.

## 5. Validacoes

| Gate | Resultado |
| --- | --- |
| `pnpm --dir octaclin-backend test` | PASS - 174 suites, 1537 testes; 3 suites e 26 testes skipped (testcontainers, sem Docker local) |
| `pnpm --dir octaclin-backend typecheck` | PASS |
| `pnpm test:redacao-auditoria` | PASS - 24 testes |
| `pnpm audit:redacao-auditoria` | PASS - 181 chaves distintas em 148 call sites |
| `pnpm test:confiabilidade` | PASS |
| `pnpm test:triagem-seguranca` | PASS |
| `pnpm test:workflows-seguros` | PASS |
| `pnpm test:tooling-agentes` | PASS |
| `pnpm security:secrets` | PASS |
| `git diff --check` | limpo |

Baseline em `main` (`8945677`): 170 suites, 1391 testes.

Especificos desta fase: `redacao-auditoria.spec.ts`,
`auditoria-autorizacao.spec.ts`, `guarda-papeis.spec.ts`,
`guarda-permissoes.spec.ts`, `controlador-portal-paciente.spec.ts`,
`servico-auditoria.spec.ts`, `servico-auth.spec.ts`, `csv.spec.ts`,
`contexto-requisicao.spec.ts`, `controlador-webhook-whatsapp.spec.ts`,
`controlador-operacoes.spec.ts`, `controlador-ia.spec.ts` e
`scripts/validar-redacao-auditoria.spec.mjs`.

Cobertura do mecanismo de envoltorio (em `validar-redacao-auditoria.spec.mjs`):
escrita opaca sem declaracao reprova; envoltorio declarado nao reprova e tem os
literais dos call sites lidos; trocar o identificador repassado volta a
reprovar; declarar um envoltorio nao perdoa outra escrita opaca do mesmo
arquivo; a assinatura do envoltorio nao conta como call site; a declaracao de
`registrarAuditoriaNaTransacao` nao conta como escrita; espalhamento do
identificador declarado e o salto, espalhamento de outra origem no mesmo literal
continua reprovando; comentario antes do literal nao transforma o call site em
opaco.

Cobertura negativa especifica: credencial, PII e PHI redigidos por nome;
identificador opaco preservado apenas quando o valor tem forma de UUID
(`senhaId: 'hunter2'` volta a ser redigido); booleano de presenca preservado;
`motivo` e `relato` preservados **por teste que afirma isso**, para que ninguem
os "conserte" acrescentando o termo ao redator; binario resumido em vez de
serializado byte a byte; getter que lanca contido na propria chave; ciclo,
profundidade, excesso de chaves e excesso de caracteres.

Cobertura da negativa de autorizacao: dedup por chave completa, alvo concreto
separando recursos distintos, `recurso_id` so com UUID, `alvoOpaco` quando o
parametro nao e UUID, janela marcada so no sucesso da escrita, eviction LRU, e
ausencia de efeito sobre o desfecho HTTP -- falha de auditoria nao transforma
403 em 500 nem em 200.

O gate novo entrou no job `governanca` de `.github/workflows/ci.yml`, ao lado de
`pnpm test:confiabilidade`.

## 6. O que esta fase **nao** entrega

| Item | Fase |
| --- | --- |
| Trilha tecnicamente imutavel: `REVOKE UPDATE/DELETE`, trigger, hash-chain ou WORM | 2 |
| Teto de escrita para `auth.login.sucesso` -- laco de login legitimo grava sem limite | 2 |
| Correlacao `x-request-id` atravessando a fronteira web-backend (o BFF nao propaga) | 2 |
| `GET /health/detalhado` publico propagando mensagem crua do driver Postgres | 2 |
| Alertas sobre o contador de falhas e sobre volume de negativa de autorizacao | 3 |
| Runbook de resposta a incidentes, escalonamento e preservacao de evidencia | 3 |
| Tabletop sintetico documentado | 3 |

As quatro primeiras estao registradas como excecao datada, com owner e prazo, na
secao 10 da norma (EXC-AUD-002 a EXC-AUD-004, mais o item de `/health/detalhado`
que a fase 2 trata junto). As tres ultimas sao a metade restante do gate minimo
do PR 52.

### 6.1 Lacunas de cobertura declaradas

Honestidade e requisito do gate, e nao demerito.

- **Envoltorio privado deixou de ser lacuna: virou declaracao.** A versao
  anterior deste relatorio registrava, como EXC-AUD-001, que as tres chaves de
  `ServicoAuth` (`motivo`, `mfaVerificado`, `rotacao`) ficavam fora do
  inventario por passarem pelo helper `registrarTrilha`. Isso deixou de ser
  verdade: a excecao foi **fechada**, e nao adiada. O gate declara envoltorios
  (secao 4.3), le os literais dos call sites deles e reprova o salto interno nao
  declarado. As tres chaves de auth estao no inventario -- `mfaVerificado` e
  `rotacao` como operacionais, e `motivo` renomeado para `motivoTecnico`
  (SEC-PR52-018). O que a excecao dizia sobre "o gate nao as prova" agora vale
  para o inverso: quem escrever call site novo por envoltorio nao declarado
  reprova o CI.
- **`motivo` nao entrou no vocabulario do redator.** Redigi-lo destruiria dado
  operacional para fingir cobertura, e ha teste que afirma que `motivo` e
  `relato` sobrevivem a redacao. A protecao esta na disciplina de nome: motivo
  livre vira `possuiMotivo`, motivo de vocabulario fechado vira `motivoTecnico`,
  e o nome `motivo` nao esta em `CHAVES_SEGURAS` -- um call site novo que o use
  reprova. EXC-AUD-005.
- **`totalRefeicoes` e falso positivo assumido.** Isentar prefixo
  `total`/`quantidade` com valor numerico abriria porta para `totalCalorias`,
  que num produto de nutricao e prescricao, e a regra nao consegue distinguir os
  dois. Perder uma contagem numa entrada de `modelo_criar` custa menos.
- **O gate mede o repositorio, nao o banco.** Ele prova que os call sites do
  codigo escrevem chave coberta; nao prova que linhas ja gravadas em producao
  estejam limpas. As quatro que vazavam gravaram enquanto existiram, e a trilha
  e imutavel.

## 7. Riscos residuais

- A trilha ganhou volume: negativa de autorizacao, login e refresh passaram a
  gravar. A dedup e o teto do `ProtecaoAbuso` contem o caso hostil; o caso
  legitimo de `auth.login.sucesso` continua sem teto (EXC-AUD-002).
- O estado da janela de deduplicacao e por processo e em memoria. Nao e controle
  de seguranca, e sim otimizacao de volume: no restart o pior caso e gravar de
  novo, nunca deixar de gravar uma negativa distinta. Entre replicas, cada uma
  tem sua propria janela.
- O mesmo vale para o teto de log do webhook WhatsApp: cada processo emite sua
  propria cota, e a contagem de supressao por linha continua correta.
- `GuardaPapeis` e `GuardaPermissoes` passaram a depender de `ServicoAuditoria`.
  Nest resolve a guarda no injetor do modulo que declara o controlador, e nem
  todos os cerca de 25 modulos que usam as guardas declaravam o servico -- por
  isso `ModuloAuth` passou a exporta-lo. Modulo novo que use as guardas sem
  importar `ModuloAuth` quebra no bootstrap, e nao em runtime.
- O contador de falhas e monotonico e por processo. O alarme da fase 3 precisa
  trabalhar com delta por janela, e nao com valor absoluto, e o relatorio de um
  processo nao fala pelos outros -- a mesma limitacao que o PR 51 registra sobre
  `web` e `worker`.
- O gate depende do proprio extrator. O piso de sanidade cobre a quebra grosseira
  (parar de achar call site), mas nao cobre um extrator que passe a achar chave
  demais. A revisao do diff continua sendo necessaria.

## 8. Rollback

Reverter o commit do gate (`pnpm test:redacao-auditoria` no CI e
`scripts/validar-redacao-auditoria.*`) devolve o estado de "redator sem
cobertura verificada", sem perder a redacao nem as correcoes de call site.
Reverter o redator devolve o payload livre a coluna e reabre os quatro
vazamentos -- e a operacao que **nao** deve ser feita sem decisao explicita.

Reverter a cobertura de eventos de auth e autorizacao remove escrita, e nao
altera desfecho: as guardas ja lancavam o 403 antes, e o registro nunca decide o
resultado HTTP. A dependencia nova de `ServicoAuditoria` nas guardas e a unica
mudanca de composicao de modulo; ela e revertida junto.

Nenhuma migration, nenhuma alteracao de schema, nenhum contrato HTTP novo e
nenhuma mudanca de conexao, RLS ou `ExecutorTenant`. O unico acrescimo de
superficie observavel e o conteudo das linhas gravadas.

## 9. Operacoes externas

Nenhuma. Nenhum painel de provider foi acessado, nenhuma credencial foi lida,
criada, rotacionada ou revogada, nenhuma configuracao externa foi alterada e
nenhum dado de producao foi consultado. Toda a evidencia deste relatorio vem do
repositorio e da suite local do mesmo ciclo.
