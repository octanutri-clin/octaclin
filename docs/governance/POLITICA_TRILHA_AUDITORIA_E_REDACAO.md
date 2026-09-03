# Politica da trilha de auditoria e da redacao de metadados do OctaClin

> Norma duravel. Estado observado fica em `STATUS_ATUAL_PROJETO.md` e a
> evidencia do ciclo em `docs/governance/RELATORIO_SEGURANCA_PR52_2026-09-02.md`.

Esta politica cobre `user_action_logs` -- a trilha de auditoria do OctaClin --
e o payload livre que os call sites gravam nela. Ela define o que a trilha
precisa registrar, o que nunca pode entrar em `metadados`, quem escreve, quanto
pode ser escrito e o que serve como prova de que a regra esta valendo.

Principio: **garantia declarada nao e cobertura verificada**. O repositorio ja
dizia, no proprio codigo, que os metadados da auditoria passavam por um redator
de dados sensiveis. Ate o PR 52 nada media a distancia entre o vocabulario do
redator e as chaves que os call sites de fato escreviam -- e essa distancia era
quase total. E a mesma licao que a norma do PR 51 registra sobre `BYPASSRLS`:
um controle que nao inspecionou o caso nao pode ser lido como carimbo de que o
caso esta certo.

---

## 1. O que a trilha e, e por que ela e diferente de um log

`user_action_logs` nao e observabilidade. Ela e a evidencia de quem fez o que,
em qual recurso, e quando. Tres propriedades a separam de um log de aplicacao,
e as tres explicam todas as regras deste documento:

| Propriedade | Consequencia |
| --- | --- |
| E lida por muita gente | operacao, suporte e auditoria externa leem a trilha; elas tem direito de saber que um prontuario foi aberto, e nao de ler o prontuario |
| E imutavel e sobrevive ao expurgo | dado sensivel que caia aqui continua vazado depois que o titular pediu exclusao; nao ha `UPDATE` corretivo previsto |
| Sai do sistema | entra em backup, em dump de suporte e em exportacao operacional |

Por isso a assimetria que atravessa a norma: **perder o valor de um campo de
auditoria e um incomodo reversivel; gravar PHI, PII ou credencial na trilha nao
e**.

---

## 2. Familias de evento obrigatorias

Um evento de uma destas familias sem linha na trilha e defeito, e nao lacuna de
produto. A ausencia de registro e indistinguivel da ausencia de acesso --
justamente a evidencia que a auditoria existe para produzir.

| Familia | Exemplos de acao | Por que e obrigatoria |
| --- | --- | --- |
| Ciclo de vida da credencial | `auth.login.sucesso`, `auth.login.falha`, `auth.token.renovado`, `auth.sessao.encerrada` | sem isso um acesso indevido so aparece depois, pelo dado que a sessao tocou |
| Negativa de autorizacao | `auth.autorizacao.negada` | separa "ninguem tentou" de "alguem tentou e foi barrado"; e o primeiro indicio de credencial comprometida ou papel concedido errado |
| Acesso e mutacao de dado clinico | `pacientes.*`, `planos_alimentares.*`, `dashboard.clinico.*` | e a razao de a tabela existir |
| Exportacao em massa | qualquer `*.exportar_csv` | o volume levado e o que permite detectar exfiltracao |
| Operacao administrativa e LGPD | `operacoes.*`, `cliente.*` | acao privilegiada sobre tenant, plano, retencao e direito do titular |
| Integracao externa | `integracoes.*`, `ia.*` | e onde o dado sai do sistema |

Duas regras de cobertura que nao sao obvias:

1. **A exportacao da propria trilha e auditada.** `operacoes.auditoria.exportar_csv`
   existe porque quem leva o arquivo inteiro precisa aparecer dentro dele.
2. **Leitura em massa conta como acesso.** Listagem e exportacao de PHI
   registram volume; abertura de tela que so mostra o que ja foi derivado, nao
   -- auditar cada abertura afogaria o evento que importa.

---

## 3. Doutrina de redacao

Esta e a secao mais importante do documento.

**Um blocklist por nome de chave sobre um objeto de forma livre nunca sera
completo.** O defeito que o PR 52 corrigiu nao foi a lista estar curta: foi o
modulo **afirmar uma garantia que nao entrega**, fazendo o proximo revisor
confiar nela e parar de olhar o call site. Foi assim que um espalhamento de
filtros de busca, um humor autorrelatado e um motivo clinico de cancelamento
passaram por revisao humana.

A cobertura vive em tres camadas, em ordem decrescente de forca:

| Camada | O que e | Falso negativo |
| --- | --- | --- |
| 1. Nao coletar | o call site nao escreve o dado: `possuiMotivo: Boolean(motivo)` no lugar de `motivo` | nenhum |
| 2. Gate de cobertura | `scripts/validar-redacao-auditoria.mjs` extrai as chaves reais dos call sites e reprova o CI quando aparece chave que nada cobre | nenhum silencioso: o que ele nao consegue ler reprova (secao 9) |
| 3. Redator | `redacao-auditoria.ts`, rede de ultima instancia sobre o payload | muitos, por construcao |

A responsabilidade primaria e sempre da camada 1. A camada 3 e **reducao de
dano, nao classificacao perfeita**, e nenhum documento, comentario ou revisao
pode trata-la como garantia. A camada 2 e o que torna a cobertura verificavel
em vez de afirmada.

O redator e dominio puro -- sem Nest, sem I/O, sem relogio --, e o gate importa
dele a funcao real (`chaveEhCobertaPorRegra`) em vez de reimplementar o
vocabulario. Nao existe segunda copia da lista para divergir: acrescentar um
termo atualiza os dois no mesmo commit.

---

## 4. Regra para quem for escrever um call site novo

### 4.1 O que **nao** entra em `metadados`

- Credencial e segredo: senha, token, cookie, assinatura, hash de credencial.
- PII direta: nome, CPF, e-mail, telefone, endereco, documento, carteirinha.
- Termo digitado pelo usuario em busca. O repositorio ja trata o campo `busca`
  de pacientes como PII -- `servico-pacientes.ts` o passa por
  `gerarHashesConsultaPii` **justamente para nunca armazena-lo**.
- PHI: diagnostico, evolucao, anamnese, sintoma, medicamento, peso, altura,
  IMC, dieta, caloria, humor e adesao. Ser enum ou escala em vez de texto livre
  muda o formato, nao a natureza.
- Texto livre de qualquer origem: motivo, observacao, relato, queixa.
- Conteudo enviado a provedor externo ou devolvido por ele (prompt, imagem,
  inferencia).
- `hash` de conteudo clinico quando ha outro identificador ao lado: o digest
  nao acrescenta evidencia e acrescenta um oraculo de confirmacao.
- Espalhamento de objeto de origem opaca (`...filtros`, `...dados.extras`,
  `...montarExtras()`). Espalhar um DTO e promessa em aberto: campo novo no DTO
  passa a ser gravado amanha sem revisao nenhuma.

### 4.2 O que entra

- Identificador opaco em formato UUID (`pacienteId`, `versaoId`, `sessaoId`).
  Sem eles a trilha fica tecnicamente limpa e operacionalmente inutil.
- Vocabulario fechado do dominio: enum, papel RBAC, status, tipo, formato.
- Contagem, tamanho, duracao e paginacao. Volume e o que denuncia exfiltracao,
  e e a unica coisa segura de gravar sobre uma exportacao.
- Booleano de presenca (`possuiMotivo`, `possuiSintomas`, `houveTextoLivre`).
  E a forma que os call sites devem usar, e o redator preserva booleano por
  regra de tipo -- um bit nao pode conter CPF.
- Nomes de campos alterados (`Object.keys`), nunca os valores.
- Marca de tempo gerada pelo servidor.

Booleano de presenca so vale a pena quando o campo e opcional. Campo
obrigatorio no DTO produz a constante `true`, que nao carrega informacao.

### 4.3 Onde o literal precisa estar

O gate le `metadados` quando o valor e literal de objeto **a vista**. Ha duas
formas de satisfazer isso, e as duas sao normais:

1. **Literal direto na chamada de auditoria.** E o caso da maioria dos call
   sites.
2. **Literal no call site de um envoltorio declarado.** Um controlador pode ter
   um metodo privado que monta `tenantId`, `ip` e `userAgent` uma vez so
   (`this.auditar(usuario, requisicao, acao, pacienteId, { ... })`). O
   envoltorio e entao declarado em `ENVOLTORIOS_DECLARADOS` do gate, com o
   arquivo, o nome, o indice do argumento que carrega o payload, o identificador
   que ele repassa por dentro e a justificativa escrita. O gate passa a ler os
   literais dos call sites dele e a silenciar **apenas** aquele salto interno,
   pelo nome exato do identificador.

Payload montado em variavel, recebido por parametro ou repassado por um helper
**nao declarado** e contado como opaco -- nao como aprovado -- e reprova o CI.
Ver secao 9.

### 4.4 Quando o gate reprovar

`pnpm test:redacao-auditoria` reprova com arquivo, linha, chave e a decisao a
tomar. Sao tres saidas legitimas, nesta ordem de preferencia:

1. **O call site nao deveria gravar aquilo.** Troque por booleano de presenca,
   contagem ou identificador. E a correcao certa na maioria dos casos.
2. **Falta termo sensivel no redator.** Acrescente em `redacao-auditoria.ts`,
   com a analise de colisao feita antes -- termo de tres letras casa por
   segmento, e nao por substring, para nao destruir chave legitima.
3. **A chave e operacional.** Entre em `CHAVES_SEGURAS` do gate com
   justificativa escrita ao lado.

A pergunta que decide entre 1 e 3 e sempre a mesma: *se este valor aparecer num
dump de suporte, alguem se incomoda?* Se sim, a correcao e no call site.

`CHAVES_SEGURAS` nao e o lugar de acomodar um call site que nao deveria estar
gravando aquilo. Entrada sem justificativa util e a mesma divida que o ledger
de excecoes de supply chain proibe.

---

## 5. Caminhos de escrita

Existem **dois**, e nao pode existir um terceiro:

| Caminho | Quando | Falha de gravacao |
| --- | --- | --- |
| `ServicoAuditoria.registrar` | fora de transacao; e o caso de quase todos os controladores | **engolida**, com contador e log `warn` |
| `registrarAuditoriaNaTransacao` | dentro de um `ExecutorTenant.executar` ja aberto | **propagada** |

O segundo existe porque as escritas de `planos-alimentares` rodam dentro de uma
transacao que ja segura `pessimistic_write` sobre o plano e a versao. Rotea-las
pelo primeiro pediria segunda conexao do pool -- risco de auto-deadlock sob
pressao -- e quebraria a atomicidade: a linha de auditoria comitaria
independentemente do negocio, deixando registro de publicacao para uma
publicacao que rolou de volta.

A diferenca de tratamento do erro e deliberada e nao deve ser uniformizada. Em
`registrar` a trilha e efeito colateral, e registrar o acesso nao pode impedir o
atendimento. Em `registrarAuditoriaNaTransacao` a trilha e parte do fato
registrado, e engolir a falha produziria publicacao comitada sem trilha.

**Os dois aplicam a mesma redacao.** O gate reprova qualquer
`getRepository(UserActionLogOrm).save` fora de `servico-auditoria.ts`: a
afirmacao de exclusividade e teste, e nao frase de comentario.

Um envoltorio privado de modulo (`this.auditar`, `this.registrarAuditoria`) nao
e um terceiro caminho: ele desemboca em um destes dois. O que ele exige e
declaracao no gate, pela secao 9.1.

---

## 6. Teto de escrita e amplificacao

A trilha e append-only e entra em backup. Escrita ilimitada nela nao e so custo
de banco: e permanente. Tres regras derivam disso.

### 6.1 Anonimo nao escreve na trilha

`user_action_logs.tenant_id` e NOT NULL e a escrita passa por RLS. Falha de
login cujo tenant ou usuario nao existe fica **fora** da trilha: so log
estruturado, com motivo de vocabulario fechado, sem e-mail, sem slug enviado
pelo cliente e sem hash de nenhum dos dois -- o par (e-mail, resultado) e por
si so um oraculo de enumeracao de contas.

Duas razoes, e as duas bastam sozinhas:

- **Isolamento.** Inventar um tenant sintetico para caber na coluna criaria um
  balde de linhas fora de qualquer escopo real; escrever fora do
  `ExecutorTenant` seria escrita sem RLS no caminho anonimo do login --
  exatamente a excecao que o PR 51 fechou.
- **Amplificacao.** Nesses dois caminhos o atacante escolhe livremente o valor
  que decide a chave de protecao de abuso, entao o teto por chave nao limita o
  total de escritas.

Com tenant e usuario resolvidos, a falha vai para a trilha, e o teto e o proprio
`ProtecaoAbuso`: 5 falhas por (tenantSlug, e-mail) em 15 minutos, depois das
quais a requisicao morre antes de qualquer consulta. Nao se cria contador novo
para o mesmo limite -- duas fontes de verdade sobre o mesmo teto divergem.

O mesmo raciocinio vale para o webhook publico do WhatsApp: falha de assinatura
HMAC e log estruturado, e nao trilha. Nao ha tenant, e derivar tenant de payload
nao autenticado daria ao atacante o poder de escolher em qual trilha escrever --
uma trilha que o atacante escreve nao e evidencia, e poluicao. O log tem teto
por janela, contador de supressao e residual emitido no encerramento, e nao
carrega corpo, `phone_number_id` nem a assinatura recebida.

### 6.2 Negativa de autorizacao deduplica, mas nao colapsa alvo

Uma sessao valida pode martelar rota proibida em laco. A janela de 60 s colapsa
repeticoes da **mesma** negativa -- mesmo tenant, mesmo usuario, mesma
exigencia, mesma rota e **mesmo alvo concreto**.

O alvo concreto entra na identidade do evento porque sem ele a dedup usaria so o
template da rota, e sondar 500 pacientes distintos produziria uma linha por
minuto: apagaria exatamente o sinal de enumeracao que auditar o 403 existe para
detectar.

O parametro de rota e entrada do atacante, e entra sob duas regras:

- **UUID canonico vai cru** para `recurso_id`. A coluna e `uuid` no Postgres;
  gravar slug derrubaria o `INSERT` e perderia a linha inteira, que e pior que
  perder o identificador. As guardas rodam **antes** dos pipes do Nest, entao
  `ParseUUIDPipe` ainda nao validou nada: o formato e conferido no proprio
  modulo de auditoria.
- **O que nao e UUID vira `op:<sha256 truncado>`**, que entra na chave de
  deduplicacao e **nunca** na trilha. A linha recebe `alvoOpaco: true` para o
  leitor nao concluir que a rota era sem parametro.

O estado da janela e por processo e em memoria: e otimizacao de volume, nao
controle de seguranca. A janela so e marcada no **sucesso** da escrita -- uma
falha nao pode silenciar aquela chave por 60 s. Eviction e LRU, a poda e
amortizada e o teto de chaves e fixo, porque a chave carrega rota e alvo que o
cliente influencia: sem teto, a defesa contra amplificacao na trilha viraria
amplificacao de memoria no processo.

A negativa nunca pode alterar o desfecho HTTP. Falha de auditoria nao
transforma 403 em 500, nem em 200.

### 6.3 Volume de exportacao e contado, nunca copiado

A evidencia de uma exportacao e o numero de registros levados. Copiar as linhas
para `metadados` faria o registro do acesso conter o dado acessado,
transformando a trilha na segunda copia do vazamento que ela deveria denunciar.

A contagem respeita citacao de CSV: contar quebra de linha crua infla o numero
quando ha celula multilinha, e evidencia errada de volume nao e evidencia.

---

## 7. Falha de gravacao nao pode ser invisivel

`ServicoAuditoria` engole o erro de gravacao de proposito, mas o efeito
colateral disso -- log `warn` e nada mais -- deixava a trilha parar de gravar
por horas sem alarme nenhum.

O contador de falhas e **por processo**, em variavel de modulo, e nao campo de
instancia. `ServicoAuditoria` esta em `providers` de 15 modulos Nest e o
container cria uma instancia por modulo: um campo de instancia daria 15
contadores independentes, e o alarme leria a fatia de um deles. O contador e
monotonico por contrato -- reseta so no restart, nunca decrementa -- para que o
alarme trabalhe com delta por janela.

**So o nome da classe do erro entra no log de falha.** A mensagem de um erro de
banco carrega SQL, valor de parametro e as vezes host ou credencial: seria
vazar pelo log exatamente o que a redacao acabou de tirar da trilha.

---

## 8. Evidencia preservada contra excesso de redacao

Redigir demais tambem destroi. Duas classes de campo sao **evidencia, e nao
dado**, e sobrevivem por excecao nomeada:

- `hashIntegridade` de uma exportacao LGPD -- e a prova de **qual** artefato foi
  entregue ao titular, e o registro nao guarda id nenhum do arquivo. Contraste
  deliberado com `hashConteudo` de plano alimentar, que continua redigido: la o
  `versaoId` gravado ao lado ja identifica o artefato, entao o digest nao
  acrescenta evidencia e so acrescenta um oraculo de confirmacao sobre conteudo
  clinico.
- Booleanos de consentimento de `preferenciasContato` -- sao a unica prova de a
  quais canais o titular consentiu.

A trilha e imutavel: apagar evidencia aqui e definitivo. A lista de excecoes e
curta de proposito, cada entrada custa justificativa escrita e e conferida pelo
gate.

---

## 9. O que e verificado automaticamente

| Gate | Comando | O que reprova |
| --- | --- | --- |
| Cobertura de redacao | `pnpm test:redacao-auditoria` | chave sem regra, sem excecao e sem entrada em `CHAVES_SEGURAS`; espalhamento de origem opaca; escrita opaca sem envoltorio declarado; terceiro caminho de escrita; piso de sanidade do proprio extrator |
| Inventario | `pnpm audit:redacao-auditoria` | nada; lista chave a chave, com origem e classificacao |
| Redator | `pnpm --dir octaclin-backend test --runInBand` | regressao do vocabulario, dos limites e dos casos negativos |

O gate roda no job `governanca` do CI, ao lado de `pnpm test:confiabilidade`.

O piso de sanidade existe para o gate nao ficar verde por ter parado de olhar:
se o extrator quebrar e passar a achar quase nada, o teste reprova em vez de
aprovar o vazio. E a mesma disciplina do `nao-verificado` da norma do PR 51.

### 9.1 Envoltorio declarado

Um envoltorio privado que so repassa o payload para um dos dois caminhos de
escrita parte a leitura do gate em duas metades, e as duas precisam ser
costuradas de volta:

- **o salto interno** e opaco -- a chamada de dentro passa `metadados`,
  `entrada` ou `entrada.metadados`, nunca um literal;
- **o literal de verdade** esta nos call sites do envoltorio, e o gate so chega
  la se souber o nome dele.

`ENVOLTORIOS_DECLARADOS`, no proprio gate, resolve as duas com uma declaracao
so: arquivo, nome do envoltorio, indice do argumento que carrega o payload,
identificador repassado no salto interno e justificativa escrita.

O mecanismo e **fail-closed nas duas pontas**, e e isso que o torna aceitavel:

| Situacao | Resultado |
| --- | --- |
| Envoltorio nao declarado | o salto interno reprova; seus call sites nao sao lidos |
| Envoltorio declarado | o salto interno e silenciado **pelo nome exato**; os literais dos call sites entram no inventario e passam pela mesma classificacao de qualquer outra chave |
| Argumento trocado por outra coisa | volta a reprovar |
| Outra escrita opaca no mesmo arquivo | continua reprovando |
| Assinatura do envoltorio | nao conta como call site: a ancora exige `this.` |

Declarar e a unica forma de ficar verde, e declarar **obriga** a expor as chaves
dos call sites ao inventario. Foi assim que a fase 1b tirou do escuro os call
sites de rotas clinicas inteiras -- condutas terapeuticas, evolucao fotografica,
consentimentos, documentos clinicos, questionarios, IA, mobile, gamificacao,
comunicacoes, materiais, automacoes, financeiro da agenda e console operacional.
O inventario saiu de 97 chaves em 90 call sites para 181 chaves em 148 call
sites, e foi nesse lote que apareceu o vazamento do telefone WhatsApp do
paciente (`SEC-PR52-014`).

`registrarAuditoriaNaTransacao`, exportado por `servico-auditoria.ts`, **nao** e
envoltorio: e caminho de escrita, e aplica a redacao.

---

## 10. Excecao

Divergencia desta politica precisa de entrada datada, com owner e prazo, no
relatorio do ciclo, e de referencia no PR que a introduz. Excecao sem prazo nao
e excecao: e a politica mudando sem review.

Excecao fechada no proprio ciclo, mantida aqui como registro: **EXC-AUD-001**
dizia que `ServicoAuth` gravava a trilha por um helper privado e que suas tres
chaves de `metadados` ficavam fora do inventario do gate. Isso deixou de ser
verdade -- a excecao foi fechada, e nao adiada. O mecanismo de envoltorio
declarado (secao 9.1) e a norma vigente: o salto interno e declarado com
justificativa, os call sites do envoltorio passam a ser lidos, e o envoltorio
nao declarado reprova o CI. As tres chaves estao no inventario, e `motivo` foi
renomeada para `motivoTecnico` para que o nome carregue a garantia que o valor
tem.

Excecoes vigentes, abertas em 2026-09-02:

| Id | Divergencia | Owner | Prazo | Compensacao |
| --- | --- | --- | --- | --- |
| EXC-AUD-002 | `auth.login.sucesso` nao tem teto de escrita: laco de login legitimo grava sem limite na tabela imutavel | proprietario | fase 2 do PR 52 | o evento exige credencial valida; o volume e observavel pelo proprio inventario da trilha |
| EXC-AUD-003 | A trilha ainda nao e tecnicamente imutavel: nao ha `REVOKE UPDATE/DELETE`, trigger, hash-chain nem WORM | proprietario | fase 2 do PR 52 | role de runtime sem `SUPERUSER`/`BYPASSRLS`, provada em producao pelo PR 51 |
| EXC-AUD-004 | Correlacao quebra na fronteira web-backend: o BFF nao propaga `x-request-id` | proprietario | fase 2 do PR 52 | `requestId` existe e correlaciona dentro do backend |
| EXC-AUD-005 | `motivo` nao entra no vocabulario do redator | proprietario | permanente; revisar se o uso do campo mudar | ver abaixo |

Sobre a EXC-AUD-005: redigir `motivo` destruiria dado operacional para fingir
cobertura, e ha teste que **afirma** que `motivo` e `relato` sobrevivem a
redacao. A protecao esta na disciplina de nome, e nao no redator:

- motivo escrito por uma pessoa vira `possuiMotivo` (booleano de presenca);
- motivo de vocabulario fechado emitido pelo backend vira `motivoTecnico`;
- o nome `motivo` **nao** esta em `CHAVES_SEGURAS`, entao um call site novo que
  o use reprova o CI e volta para esta decisao.

Aprovar o nome `motivo` teria sido o atalho errado: `CHAVES_SEGURAS` aprova por
nome, e `motivo` e exatamente o nome que um call site usa quando vai gravar
texto livre -- foi assim que o motivo clinico de cancelamento passou por revisao
humana antes deste PR.

Falso positivo assumido, registrado aqui para nao ser "consertado" por engano:
`totalRefeicoes` e redigido. Isentar prefixo `total`/`quantidade` com valor
numerico abriria porta para `totalCalorias`, que num produto de nutricao e
prescricao, e a regra nao consegue distinguir os dois.
