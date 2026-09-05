# Tabletop sintetico de resposta a incidente de auditoria - PR 52 da governanca, fase 3

Data: 2026-09-04. Risco do escopo exercitado: R4/R5. Escopo: exclusivamente o
procedimento de resposta a incidente de auditoria e seguranca, escrito nesta
fase em `RUNBOOK_PRODUCAO.md`.

Norma aplicavel, referenciada e nao repetida aqui:
`docs/governance/POLITICA_TRILHA_AUDITORIA_E_REDACAO.md`.

## 1. O que este exercicio e, e o criterio que ele precisa cumprir

Um tabletop e um exercicio de mesa: percorrer um incidente hipotetico contra o
procedimento **real**, por escrito, e registrar onde o procedimento falhou.

O criterio que ele precisa cumprir e desconfortavel de proposito: **um tabletop
em que tudo funciona nao e evidencia de prontidao, e sim evidencia de que o
roteiro foi escrito para passar.** E a mesma forma de falha que a fase 1 deste
PR encontrou num modulo que afirmava garantia sem entregar, e que a fase 2
encontrou em tres frases verdadeiras quando escritas e sem nada que as
mantivesse verdadeiras. Um exercicio verde por construcao entra nessa familia.

Por isso a saida deste documento nao e "aprovado". E a lista de defeitos, o que
cada um produziu -- correcao no runbook ou lacuna aberta com owner e prazo -- e
o que continua sem resposta.

## 2. Como o exercicio foi conduzido, e o que ele nao prova

Exercicio de mesa executado nesta sessao, contra o texto do runbook e contra o
codigo do repositorio. **Nao houve acesso a producao, a staging, a provedor, a
painel ou a credencial.** Nenhum comando foi executado contra ambiente real, e
nenhum numero de producao aparece neste documento.

O que este exercicio prova: que os passos do procedimento existem, se encadeiam
e sao executaveis com os mecanismos que o repositorio de fato tem -- ou que nao
sao, quando nao sao. O que ele **nao** prova: que o alerta dispara (isso e o
procedimento de teste de alerta em `RUNBOOK_PRODUCAO.md`, secao "Teste de alerta
da trilha de auditoria"), nem tempo de resposta real, nem comportamento sob
carga.

Onde o exercicio cita um limiar, o numero vem do codigo do alerta desta mesma
fase (`servico-operacoes.ts`), e nao de escolha deste documento. A justificativa
de cada um esta no proprio codigo e resumida em `RUNBOOK_PRODUCAO.md`, secao
"Teste de alerta da trilha de auditoria".

## 3. Dados

**Todos os dados destes cenarios sao sinteticos.** Nenhum nome, e-mail, CPF,
tenant, identificador, host ou credencial real. Os identificadores usados sao
rotulos de exercicio (`tenant-sintetico-a`, `usuario-sintetico-1`), e nao UUIDs
com forma plausivel, para que nenhum deles possa ser confundido com dado de
ambiente. Os horarios sao relativos (`T+0`, `T+40min`), e nao datas.

---

## 4. Cenario T-01 -- a trilha para de gravar e ninguem percebe por horas

**Gatilho sintetico.** A role de aplicacao perde `INSERT` em `user_action_logs`
depois de uma alteracao de permissao no banco. O produto continua funcionando:
`ServicoAuditoria.registrar` engole o erro de gravacao por contrato (politica,
secao 5), e o unico efeito visivel e o log `auditoria.falha` e o contador de
falhas subindo.

**O que o operador ve primeiro.** Nao e um erro de usuario. E o alerta de falha
de gravacao da trilha em `/operacoes`, `Alertas operacionais`, ja na **primeira**
falha -- o limiar e 1 e a severidade e `critico`, sem degrau abaixo dela.

**Percurso pelo runbook** (`RUNBOOK_PRODUCAO.md`, `## Incidentes` ->
"Incidente de auditoria e seguranca"):

| Passo | Secao | Decisao na bifurcacao |
| --- | --- | --- |
| 1. Reconhecer o sinal | "Deteccao", primeira linha da tabela | piso R4; primeira acao e **nao** reiniciar |
| 2. Classificar | "Triagem e classificacao", pergunta 1 | a trilha parou de gravar -> R4, e o intervalo vira item obrigatorio do encerramento |
| 3. Preservar | "Preservacao de evidencia", o que se preserva, itens 1 a 3 | registrar `metrica`, `valor`, `geradoEm`; correlacao; catalogo com `current_database()` confirmado |
| 4. Investigar causa | "Preservacao de evidencia", caminho de leitura sem evento | rota `GET /api/operacoes/auditoria/paginada` com periodo -- e o que mostra o buraco no periodo |
| 5. Corrigir | fora desta secao: e permissao de banco, pelo procedimento de migration/role | nenhuma acao sobre a trilha |
| 6. Encerrar | "Encerramento", condicoes 1 a 4 | so fecha com causa escrita, controle verificado, sem novo delta e **com o intervalo declarado** |

### Defeitos que o exercicio encontrou

**ACHADO-01 -- o reflexo certo destroi a evidencia.** Na bifurcacao do passo 1,
o movimento natural de quem opera um servico que "travou" e reiniciar o servico
no provedor. O contador de falhas e por processo, monotonico, e **zera no
restart** (politica, secao 7): reiniciar apaga a unica medida do volume de
falhas daquele processo, e um deploy publicado no meio do incidente faz o mesmo
sem que ninguem chame aquilo de restart. Antes deste exercicio, nada no runbook
dizia para ler o contador antes.

*Producao do achado:* correcao aplicada ao runbook. "Preservacao de evidencia"
passou a listar "nao reiniciar o backend, nem publicar deploy, antes de ler o
contador de falhas" entre o que **nao** se faz, com a razao, e "contador e
alertas, antes de qualquer restart" como primeiro item do que se preserva. A
linha de "Deteccao" tambem carrega isso como primeira acao.

**ACHADO-02 -- "sem alerta" nao prova "sem falha".** No passo 6, a condicao de
encerramento le o painel. O contador e por processo e `/operacoes` responde por
**uma** instancia; com mais de uma replica, a leitura prova a instancia que
respondeu, e nao o servico. O exercicio parou aqui: nao ha agregacao entre
replicas, e nao ha como fechar essa distancia dentro desta fase.

*Producao do achado:* limite escrito no runbook, na secao "Teste de alerta da
trilha de auditoria", producao, item 3. **Lacuna aberta** -- ver EXC-AUD-014 na
secao 7.

**ACHADO-03 -- o encerramento tendia a mentir por omissao.** A versao mental do
encerramento era "o alerta sumiu, esta resolvido". Mas os eventos do intervalo em
que a gravacao falhou **nao existem e nao serao reconstruidos**, e ausencia de
registro e indistinguivel de ausencia de acesso (politica, secao 2). Fechar sem
nomear o intervalo transforma a lacuna numa afirmacao falsa de cobertura --
exatamente o defeito que este PR persegue desde a fase 1.

*Producao do achado:* correcao aplicada ao runbook. Condicao 4 de "Encerramento"
exige declarar o intervalo, com a frase de que o encerramento **nomeia** o
intervalo e nao o cobre.

**Resultado do exercicio T-01:** o procedimento e executavel do inicio ao fim,
com **duas correcoes** que o exercicio produziu (ACHADO-01 e ACHADO-03) e **uma
lacuna aberta** (ACHADO-02). Sem a correcao do ACHADO-01, o primeiro passo do
operador teria destruido a medida do proprio incidente.

---

## 5. Cenario T-02 -- volume anomalo de negativa de autorizacao

**Gatilho sintetico.** Em `tenant-sintetico-a`, a sessao valida de
`usuario-sintetico-1` (papel restrito) passa a receber `403` em rota de leitura
de paciente, contra muitos alvos distintos, em poucos minutos. As duas hipoteses
sao credencial comprometida e papel concedido errado, e o procedimento nao pode
escolher uma antes de conter.

**O que o operador ve primeiro.** O alerta de volume de negativa de autorizacao
em `/operacoes`, como `atencao` a partir de 50 negativas observadas e como
`critico` a partir de 500 -- por total desde o boot ou por taxa por hora de
uptime.

**Percurso pelo runbook:**

| Passo | Secao | Decisao na bifurcacao |
| --- | --- | --- |
| 1. Reconhecer o sinal | "Deteccao", segunda linha | piso R4; identificar tenant, usuario e rota **antes** de mexer em papel |
| 2. Classificar | "Triagem e classificacao", pergunta 3 | suspeita de credencial valida em uso indevido -> R5, e o eixo passa a ser contencao |
| 3. Conter | "Contencao de credencial suspeita" | e aqui que o exercicio quebrou -- ver ACHADO-05 |
| 4. Preservar e investigar | "Preservacao de evidencia" | leitura paginada por `acao=auth.autorizacao.negada` e periodo; exportacao CSV so para o artefato de evidencia |
| 5. Comunicar | "Comunicacao e registro" | canal privado do `SECURITY.md`; nada de detalhe em issue publica |
| 6. Encerrar | "Encerramento" | causa escrita: comprometimento ou concessao errada de papel |

### Defeitos que o exercicio encontrou

**ACHADO-04 -- o alerta e a trilha nao contam a mesma coisa, e a triagem
tropeca nisso.** O exercicio partiu da suposicao de que o alerta le linhas da
trilha. Ele nao le: a fonte e um contador de processo incrementado na primeira
instrucao de `registrarAutorizacaoNegada`, portanto **antes** da janela de
deduplicacao da secao 6.2 e antes da checagem de tenant. A consequencia so
aparece quando os dois numeros sao postos lado a lado no passo 4 do percurso:

- quem martela **um** alvo aparece inteiro no contador e como cerca de **uma
  linha por minuto** na trilha, porque a janela colapsa as repeticoes;
- uma negativa sem tenant resolvido conta no alerta e nao existe na trilha.

O alerta, portanto, **detecta** o martelo em alvo unico -- ao contrario do que
o exercicio supos. O defeito e de **leitura na investigacao**: quem abrir a
trilha para dimensionar o volume que disparou o alerta vai encontrar menos
linhas do que o `valor` do alerta e concluir que um dos dois esta errado.
Nenhum esta.

*Producao do achado:* escrito no runbook, na secao do alerta de volume, com a
divergencia declarada nas duas direcoes, e no passo 3 do procedimento de teste,
que agora manda conferir os dois lados e registrar a diferenca. **Lacuna
aberta** sobre o dimensionamento na trilha -- ver EXC-AUD-011.

**ACHADO-05 -- a contencao nao e executavel, e o passo 3 nao existia.** O
exercicio chegou em "revogar a sessao comprometida" e nao encontrou caminho. O
que o repositorio tem hoje:

- as rotas de `/auth/sessoes` agem sempre sobre as sessoes de **quem chamou**;
  nao ha caminho de SuperAdmin para derrubar sessao de terceiro;
- redefinicao de senha revoga todas as sessoes do usuario, mas depende de o
  proprio usuario concluir o fluxo, entao nao e contencao imediata;
- arquivar um profissional marca o usuario como inativo e revoga os refresh
  tokens, mas **nao** encerra a sessao corrente: o guarda de JWT consulta
  `sessoes_usuario`, que o arquivamento nao toca, e o access token ja emitido
  continua valido ate expirar;
- para papel que nao seja `Professional`, nem esse caminho existe.

Este e o achado mais grave do exercicio, e ele so apareceu porque o roteiro foi
percorrido contra o codigo em vez de contra a intencao. Um runbook que mandasse
"revogar a sessao" seria pior que um runbook vazio: ele produziria confianca num
passo que nao roda.

*Producao do achado:* subsecao nova no runbook -- "Contencao de credencial
suspeita" -- que descreve o estado real, nomeia a janela residual do access token
e proibe o atalho de `UPDATE` manual em `sessoes_usuario` durante a
investigacao. **Lacuna aberta** -- ver EXC-AUD-012.

**ACHADO-06 -- ausencia de alvo nao e ausencia de enumeracao.** No passo 4, ao
ler as linhas de negativa, o alvo aparece somente quando o parametro de rota e
UUID canonico; o que nao e UUID vira chave opaca e **nunca** entra na trilha,
com `alvoOpaco` marcando a linha (politica, secao 6.2). Uma enumeracao por slug
produziria linhas sem alvo, e a leitura ingenua concluiria que a rota nao tinha
parametro.

*Producao do achado:* escrito no runbook, na secao do alerta de volume.

**ACHADO-07 -- o passo de leitura apontava para uma tela que nao existe.** A
formulacao natural do passo 4 seria "abrir `/operacoes` e filtrar a trilha". O
console **nao tem tela da trilha de auditoria**: existem as rotas de BFF
(`/api/operacoes/auditoria`, `.../paginada`, `.../exportar.csv`) e nenhuma pagina
que as consuma. O passo teria sido nao executavel.

*Producao do achado:* correcao aplicada. O runbook nomeia a rota do BFF como o
caminho executavel, com sessao SuperAdmin autenticada no navegador, e separa a
leitura paginada (nao gera evento) da exportacao CSV (gera
`operacoes.auditoria.exportar_csv`, e e para artefato de evidencia).

**Resultado do exercicio T-02:** o procedimento **falhou** no passo de contencao,
e a falha era invisivel enquanto o roteiro nao foi confrontado com o codigo. Duas
correcoes de execucao (ACHADO-06, ACHADO-07), uma subsecao nova que so existe
por causa deste exercicio (ACHADO-05) e duas lacunas abertas.

---

## 6. Cenario T-03 -- pedido de eliminacao LGPD alcanca a trilha

**Gatilho sintetico.** Uma solicitacao LGPD de eliminacao chega por protocolo
para um titular de `tenant-sintetico-a`. Ao percorrer os lugares onde o dado do
titular aparece, o operador chega em `user_action_logs` e tenta remover as linhas
que citam o identificador dele.

**O que o operador ve primeiro.** Nao ha alerta: este cenario comeca por um
pedido legitimo, e nao por deteccao. O primeiro sinal e o erro `42501` na
tentativa de `DELETE`.

**Percurso pelo runbook:**

| Passo | Secao | Decisao na bifurcacao |
| --- | --- | --- |
| 1. `DELETE` recusado | "Deteccao", linha do `42501` | **nao** e incidente: e um dos caminhos previstos? Nao -- ver ACHADO-09 |
| 2. Reler a regra | "Preservacao de evidencia", custo operacional | eliminacao LGPD nao se resolve por `DELETE`; o que mantem dado pessoal fora da trilha e a redacao na escrita |
| 3. Avaliar a excecao | "Trilha de auditoria append-only" (secao de banco) | procedimento fora de banda, role administrativa, **dois responsaveis**, janela registrada, reativacao verificada |
| 4. Decidir | "Escalonamento", item 3 | o projeto tem um responsavel; a operacao nao e executavel |
| 5. Responder ao titular | "Preservacao de evidencia", custo operacional | descrever o que o sistema faz, sem prometer o que ele nao faz |

### Defeitos que o exercicio encontrou

**ACHADO-08 -- o runbook exigia uma organizacao que nao existe.** A secao
"Trilha de auditoria append-only", escrita na fase 2, exige "dois responsaveis"
para a remocao fora de banda. O projeto tem **um** responsavel, e a secao de
escalonamento do suporte nunca descreveu um segundo. O procedimento portanto nao
e executavel hoje, e o exercicio encontrou o runbook prometendo um controle de
segregacao que a operacao real nao tem.

Duas saidas erradas foram consideradas e descartadas. Afrouxar a exigencia para
"um responsavel com registro" trocaria segregacao de funcao por prosa, e a
remocao de linha da trilha e justamente a operacao em que uma pessoa sozinha nao
deveria decidir e executar. Fingir um segundo responsavel inventaria o time
ficticio que este documento existe para nao inventar.

*Producao do achado:* o runbook passou a dizer explicitamente que a operacao
**nao e executavel hoje** -- no "Escalonamento", item 3, e no custo operacional
de "Preservacao de evidencia" -- e que a resposta ao titular descreve o que o
sistema faz. **Lacuna aberta** -- ver EXC-AUD-013.

**ACHADO-09 -- a remocao legitima e indistinguivel do ataque.** O passo 3 exige
desabilitar temporariamente o gatilho. Isso derruba `pg_trigger.tgenabled` de
`'A'`, que e exatamente o sinal que a tabela de "Deteccao" classifica como R5,
"o controle de imutabilidade caiu". Sem uma janela registrada **antes**, quem
consultar o catalogo durante a operacao legitima le um incidente de integridade
-- e, no sentido inverso, um ataque real durante uma janela declarada passaria
como operacao autorizada.

*Producao do achado:* correcao aplicada. "Preservacao de evidencia" lista
"nao desabilitar o gatilho para consertar uma linha" entre o que **nao** se faz,
com essa razao escrita; e a exigencia de janela registrada e reativacao
verificada continua na secao de banco, agora com o motivo explicito. O gatilho
so cai por decisao registrada antes, nunca durante.

**Resultado do exercicio T-03:** o procedimento **para** no passo 4, por
impossibilidade organizacional, e o exercicio considera isso o desfecho correto
-- e melhor um procedimento que declara que nao pode ser executado do que um que
convida a executa-lo sozinho. Uma correcao (ACHADO-09) e uma lacuna aberta
(ACHADO-08).

---

## 7. Consolidacao

| Achado | Cenario | O que produziu |
| --- | --- | --- |
| ACHADO-01 restart apaga o contador | T-01 | correcao no runbook |
| ACHADO-02 contador por processo, painel por instancia | T-01 | limite escrito + lacuna aberta (EXC-AUD-014) |
| ACHADO-03 encerramento sem declarar o intervalo | T-01 | correcao no runbook |
| ACHADO-04 contador e trilha nao contam a mesma coisa | T-02 | correcao no runbook e no teste de alerta + lacuna aberta (EXC-AUD-011) |
| ACHADO-05 contencao de sessao nao executavel | T-02 | subsecao nova + lacuna aberta (EXC-AUD-012) |
| ACHADO-06 `alvoOpaco` na leitura da trilha | T-02 | correcao no runbook |
| ACHADO-07 nao ha tela da trilha no console | T-02 | correcao no runbook |
| ACHADO-08 dois responsaveis vs. um | T-03 | limite escrito + lacuna aberta (EXC-AUD-013) |
| ACHADO-09 janela legitima confundivel com ataque | T-03 | correcao no runbook |

Cinco correcoes no procedimento e quatro lacunas que esta fase nao fecha. As
quatro precisam de entrada datada com owner e prazo na secao 10 da politica da
trilha, no formato `EXC-AUD-0NN` que aquela secao usa. **Este documento propoe o
texto; ele nao edita a politica** -- a atualizacao da norma e passagem propria,
pelo mesmo motivo pelo qual esta fase nao mexe na matriz de confiabilidade.

Texto proposto:

| Id | Divergencia | Owner | Prazo | Compensacao |
| --- | --- | --- | --- | --- |
| EXC-AUD-011 | O alerta conta negativa observada, mas a **trilha** sub-reporta o martelo persistente em alvo unico: a janela de 60 s da secao 6.2 colapsa as repeticoes em cerca de uma linha por minuto, entao a evidencia que sustenta a investigacao nao dimensiona o volume que disparou o alerta | proprietario | PR 53 ou posterior; exige decisao sobre gravar volume colapsado na linha da negativa, como `loginsSuprimidos` ja faz para o login | o alerta **detecta** o caso, porque o contador incrementa antes da dedup; e a divergencia entre contador e numero de linhas esta escrita no `RUNBOOK_PRODUCAO.md`, secao do alerta de volume, para nao ser lida como defeito de um dos dois |
| EXC-AUD-012 | Nao ha contencao operacional de sessao comprometida: nenhuma rota permite a um SuperAdmin revogar a sessao de terceiro, e arquivar um profissional revoga refresh tokens sem encerrar a sessao corrente | proprietario | PR 53 ou posterior; exige rota nova com auditoria propria | o guarda de JWT consulta `sessoes_usuario` a cada requisicao, entao qualquer revogacao que chegue aquela tabela tem efeito imediato; a janela residual e a validade do access token (`JWT_EXPIRA_EM`), e esta escrita no runbook |
| EXC-AUD-013 | A remocao de linha da trilha exige dois responsaveis e o projeto tem um: o procedimento fora de banda da secao 5.1 nao e executavel hoje | proprietario | permanente enquanto houver um unico responsavel; revisar quando houver segundo | a redacao de `metadados` mantem dado pessoal fora da trilha na escrita, que e a camada 1 da secao 3; o runbook declara a nao executabilidade em vez de convidar a execucao solitaria |
| EXC-AUD-014 | O contador de falhas de gravacao e por processo e `/operacoes` responde por uma instancia: com N replicas, ausencia de alerta prova a instancia que respondeu, e nao o servico | proprietario | PR 53 ou posterior; exige agregacao externa | mesma limitacao por processo ja registrada para a janela de deduplicacao e para o teto de login; o log `auditoria.falha` continua chegando de todas as instancias no provedor |

## 8. O que este exercicio deliberadamente nao fez

- **Nao executou nada.** Nenhum comando contra producao, staging, provedor ou
  banco. Todo passo que exige execucao humana esta escrito como procedimento a
  executar, e nao como resultado obtido.
- **Nao inventou limiar.** Os numeros citados nos cenarios sao os que o codigo
  do alerta define; este documento nao escolheu nenhum deles.
- **Nao exercitou o cenario de adulteracao deliberada por quem tem catalogo.**
  Ele esta fora de alcance desde a fase 2 (EXC-AUD-008): o controle impede a
  mutacao por SQL, nao prova ausencia de adulteracao. Um tabletop sobre isso
  descreveria uma resposta que nao existe.
- **Nao mediu tempo de resposta.** Nao ha base para prazo medido; o criterio de
  prazo continua sendo o `SLA_SUPORTE.md`.
- **Nao substitui o teste de alerta.** Que o alerta dispare e prova separada, em
  `RUNBOOK_PRODUCAO.md`, secao "Teste de alerta da trilha de auditoria".
