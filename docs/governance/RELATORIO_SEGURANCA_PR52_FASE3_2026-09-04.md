# Relatorio de seguranca - PR 52 da governanca, fase 3

> Evidencia de ciclo. Norma duravel em
> `docs/governance/POLITICA_TRILHA_AUDITORIA_E_REDACAO.md`; procedimento
> operacional em `RUNBOOK_PRODUCAO.md`; exercicio em
> `docs/governance/TABLETOP_AUDITORIA_PR52_FASE3_2026-09-04.md`.

Data: 2026-09-04. Risco: R4 (trilha de auditoria e autorizacao).

Fase 3 de tres. Ela fecha a **metade restante** do gate minimo do PR 52 --
"teste de alerta e tabletop sintetico documentados" --, que as fases 1 e 2
declaradamente nao fechavam.

## 1. Baseline

Branch `security/governanca-pr52-fase3-alerta-e-resposta`, sobre `a9c6d59`
(merge do PR GitHub #194 no `main`, que integrou a fase 2 e a evidencia de
producao dela). Arvore limpa no inicio do ciclo.

## 2. O defeito que esta fase corrige

O contador de falhas de gravacao da trilha existe desde a fase 1. O comentario
que o acompanha diz, em `servico-auditoria.ts`, que ele existe para "o alarme da
fase 3 -- que le este numero". **Nada em producao lia esse numero.** A secao 7
da politica descrevia a lacuna ("a trilha podia parar de gravar por horas sem que
nenhum alarme tocasse") e, ao mesmo tempo, a documentava como resolvida pela
existencia do contador.

Contador nao lido nao e alarme. Um numero que ninguem consulta tem exatamente o
mesmo efeito operacional do log `warn` que ele veio substituir -- e a mesma forma
de defeito que a fase 1 encontrou no redator e a fase 2 encontrou na correlacao:
uma garantia verdadeira na letra e vazia no mecanismo.

## 3. O que foi entregue

### 3.1 Alerta de falha de gravacao da trilha

Entra no pipeline de alertas operacionais que ja existia (`/operacoes` ->
`Alertas operacionais`), atras de `GuardaJwt` + `SuperAdmin`. **Nao** entra em
`/health/detalhado`: aquele endpoint e publico e nao autenticado, e dizer a um
anonimo que a trilha parou de gravar entrega a janela de oportunidade. E o mesmo
precedente ja escrito em `GET /operacoes/providers` desde o PR 51.

Severidade `critico` a partir da **primeira** falha, sem degrau abaixo dela. O
limiar nao foi derivado de medicao porque nao ha medicao a fazer: a secao 1 da
politica diz que ausencia de registro e indistinguivel de ausencia de acesso, e
nao existe volume de perda de evidencia que seja aceitavel.

### 3.2 Alerta de volume de negativa de autorizacao

Contador novo, no mesmo padrao do de falhas: variavel de modulo, monotonico, com
funcao de leitura exportada e reset restrito ao teste. Nao e campo de instancia,
e ha teste que reprova essa regressao especificamente -- `ServicoAuditoria` esta
em `providers` de 15 modulos Nest e um campo de instancia daria 15 contadores
independentes, com o alarme lendo a fatia de um deles.

`atencao` a partir de 50, `critico` a partir de 500. O 500 nao foi escolhido no
codigo do alerta: e a magnitude que a secao 6.2 da politica ja usa para descrever
enumeracao ("sondar 500 pacientes distintos"). O 50 e uma ordem de grandeza
abaixo. **Nao ha linha de base medida em producao** -- os dois numeros sao
escolha, e nao medida, e isso esta escrito no codigo e no runbook em vez de
ficar implicito.

**Onde o contador incrementa, e por que.** Na primeira instrucao de
`registrarAutorizacaoNegada`, portanto **antes** da janela de deduplicacao e
antes da checagem de tenant. A alternativa -- contar linhas gravadas -- faria uma
sessao martelando a mesma rota em laco aparecer como uma negativa por minuto,
apagando exatamente o volume que o alerta existe para detectar. O custo que a
janela evita e permanente (linha em tabela append-only que entra em backup); o
custo do contador e um inteiro em memoria.

### 3.3 Forma do limiar

Os dois alertas usam **total desde o boot** e **taxa por hora de uptime**, e nao
delta entre leituras. A razao e do mecanismo: o painel e aberto sob demanda por
uma pessoa, entao nao existe janela de leitura confiavel, e um delta seria
corrompido pelo segundo leitor -- dois operadores abrindo `/operacoes` roubariam o
delta um do outro e o segundo veria zero. A taxa so vale depois de 15 minutos de
uptime, reusando o horizonte que `MINUTOS_OUTBOX_ATRASADO` ja define no mesmo
arquivo; abaixo disso 13 eventos em 10 s dariam 4.680/h e todo boot viraria
alarme.

O payload carrega `total`, `uptimeSegundos`, `porHora` e os limiares, para que a
conta possa ser refeita por quem opera. Nao carrega identificador algum -- nem
tenant, nem usuario, nem rota, nem alvo --, e ha teste negativo sobre o conjunto
exato de chaves do payload.

### 3.4 Procedimento de resposta a incidente de auditoria

Secao nova em `RUNBOOK_PRODUCAO.md`, dentro de `## Incidentes`: deteccao por
sinal, triagem na escala R0-R5 do `AGENTS.md`, escalonamento, contencao,
preservacao de evidencia, comunicacao e encerramento. Ela nao repete a norma;
referencia a politica.

Duas coisas que este procedimento declara em vez de fingir:

- **Escalonamento com um responsavel.** O projeto tem um. O runbook nao descreve
  plantao, rodizio nem segunda linha, porque um procedimento que aciona um time
  inexistente falha exatamente na hora em que seria usado. A compensacao adotada
  e registro escrito antes de toda acao irreversivel.
- **Contencao imediata de sessao comprometida nao e executavel hoje.** Nao ha
  rota para um SuperAdmin revogar a sessao de terceiro; arquivar um profissional
  revoga refresh tokens mas nao encerra a sessao corrente. A janela residual e a
  validade do access token, e ela entra no registro do incidente em vez de ser
  presumida como zero.

### 3.5 Teste de alerta

Secao nova em `## Alertas operacionais`, partida por ambiente. A dificuldade e
propria deste par de alertas: provar que eles disparam exige produzir o evento
que eles existem para denunciar. Banco descartavel prova o disparo; staging prova
so o alerta de negativa, com dado sintetico e aceitando que as linhas ficam;
producao e **somente leitura**. A regra que a fase 2 ja escrevia continua sem
excecao: em producao nao se insere linha sintetica na trilha para testar.

### 3.6 Tabletop sintetico

`docs/governance/TABLETOP_AUDITORIA_PR52_FASE3_2026-09-04.md`. Tres cenarios,
dados sinteticos, nenhum comando executado contra ambiente real.

O exercicio produziu **nove achados**, cinco deles corrigidos no proprio runbook
dentro desta fase. Um tabletop em que tudo funciona nao e evidencia de prontidao,
e sim evidencia de que o roteiro foi escrito para passar.

### 3.7 Gate do procedimento

`scripts/test-runbook-resposta-auditoria.mjs`, ligado como
`pnpm test:resposta-auditoria` no job `governanca` do CI.

As proibicoes desta secao do runbook **sao** o controle -- "nao desabilitar o
gatilho", "nao rodar `migration:revert`", "nao reiniciar antes de ler o
contador", "nao inserir linha sintetica na trilha em producao". Nenhuma delas
tem representacao em codigo: elas so existem como texto, e texto se perde numa
reescrita bem-intencionada sem que nada reprove. O gate reprova a remocao
silenciosa de qualquer uma, a perda da condicao de encerramento sobre o intervalo
sem trilha, a citacao de comando ou documento que deixou de existir, e a
degradacao do tabletop em exercicio sem achado.

## 4. Correcao aplicada apos revisao

Uma unica, e ela vale registro porque foi encontrada por confronto entre as duas
metades do trabalho, e nao por leitura isolada de nenhuma delas.

A documentacao foi escrita descrevendo um alerta que le **linhas da trilha** e
dispara por **delta em janela**. O codigo entregue faz as duas coisas de outro
jeito: le um contador de processo, incrementado antes da deduplicacao, e dispara
por total absoluto. Nenhuma das duas metades estava errada por si; o texto e que
descrevia um mecanismo que nao era o implementado.

A consequencia era invertida e teria enganado a triagem. O texto afirmava que o
alerta **nao** detecta martelo persistente em alvo unico -- e ele detecta,
precisamente porque conta antes da dedup. O que de fato falha nesse caso e a
**investigacao** na trilha, que guarda cerca de uma linha por minuto: quem
abrisse a trilha para dimensionar o volume encontraria menos linhas que o `valor`
do alerta e concluiria que um dos dois esta errado. Nenhum esta. A divergencia
passou a estar escrita nas duas direcoes no runbook, o passo 3 do procedimento de
teste manda conferir os dois lados e registrar a diferenca, e a lacuna virou
EXC-AUD-011 com o texto correto.

## 5. Validacoes (executadas neste ciclo)

| Gate | Comando | Resultado |
| --- | --- | --- |
| Typecheck do backend | `pnpm --dir octaclin-backend typecheck` | PASS |
| Suite do backend | `pnpm --dir octaclin-backend test --runInBand` | PASS -- 176 suites, 1594 testes; 3 suites e 31 testes `SKIPPED` (Testcontainers sem Docker neste ambiente) |
| Cobertura de redacao | `pnpm test:redacao-auditoria` | PASS -- 24 testes |
| Procedimento de resposta e tabletop | `pnpm test:resposta-auditoria` | PASS -- 9 achados, 5 lacunas |
| Matriz de confiabilidade | `pnpm test:confiabilidade` | PASS -- 30 referencias criticas |
| Scanner de secrets | `pnpm security:secrets` | PASS |
| Higiene do diff | `git diff --check` | PASS |

`SKIPPED` nao e aprovado: os tres casos pulados sao os de imutabilidade em
Postgres real, que rodam no job do backend do CI com Docker. Esta fase nao os
altera.

### 5.1 Prova por mutacao

Dez testes da fase 2 passariam identicos com a implementacao errada, e esse foi o
achado central daquela fase. Esta fase quebrou a implementacao de proposito, uma
mutacao por vez, e conferiu que algum teste reprova:

| Mutacao | Reprovou |
| --- | --- |
| Remover o incremento do contador de negativas | sim -- 10 testes |
| Mover o incremento para **depois** da supressao da janela | sim -- 3 testes |
| Limiar de falha da trilha de 1 para 2 | sim -- 3 testes |
| Limiar de atencao de 50 para 51 | sim -- 1 teste |
| Remover o piso de uptime da taxa | sim -- 1 teste |
| Vazar rota no texto do alerta | sim -- 1 teste |
| Campo extra com identificador no payload | sim -- reprova ainda no `typecheck`, por excesso de propriedade |

O gate do procedimento passou pela mesma prova:

| Mutacao | Reprovou |
| --- | --- |
| Remover a proibicao de desabilitar o gatilho | sim |
| Remover a condicao de encerramento sobre o intervalo sem trilha | sim |
| Degradar o tabletop em exercicio sem achado | sim |

## 6. O que esta fase **nao** entrega

- **Nenhuma prova em ambiente real.** Nao houve acesso a producao, staging,
  provedor, painel ou credencial neste ciclo. O procedimento de teste de alerta
  esta escrito como procedimento a executar, e nao como resultado obtido.
  Executa-lo em banco descartavel e o proximo passo humano.
- **Nenhum alerta externo.** Os dois alertas aparecem no painel `/operacoes`,
  que e leitura sob demanda. Eles **nao** abrem issue, nao enviam e-mail e nao
  entram no workflow `Monitor producao` -- aquele monitor chama apenas endpoints
  publicos sem token, e levar estes contadores para la exigiria expor a
  informacao publicamente ou colocar credencial no workflow. As duas opcoes
  foram recusadas nesta fase.
- **Nenhuma agregacao entre replicas.** Os contadores sao por processo.
- **Nenhuma migration, nenhuma DDL, nenhuma alteracao de contrato HTTP, de RLS,
  de `ExecutorTenant` ou de conexao.**
- **Nenhuma das quatro excecoes datadas para esta fase.** Ver a secao 7.

## 7. As excecoes que diziam "fase 3"

EXC-AUD-006, 007, 009 e 010 tinham `fase 3 do PR 52` como prazo, e **nenhuma foi
fechada por ela**. Isso nao e atraso: o prazo foi escrito na fase 2 sem ser
conferido contra o escopo que a fase 3 ja tinha definido na tabela de fases do
programa -- alerta, runbook, escalonamento, preservacao de evidencia e tabletop.
Nada nesse escopo toca teto de escrita, origem de requisicao ou salto de
correlacao.

E a mesma forma de defeito que este PR vem encontrando desde a fase 1, agora no
proprio ledger de excecoes: uma frase verdadeira quando escrita, que ninguem
conferiu contra o mecanismo. A correcao adotada e datar excecao pelo **trabalho
que a fecha**, e nao pela proxima fase disponivel; as quatro passaram a apontar
para o PR que carrega esse trabalho, com o motivo na propria coluna de prazo.

Quatro excecoes novas entraram, todas vindas do tabletop: EXC-AUD-011 (a trilha
sub-reporta o martelo em alvo unico), EXC-AUD-012 (contencao de sessao nao
executavel), EXC-AUD-013 (remocao de linha exige dois responsaveis e ha um) e
EXC-AUD-014 (contadores por processo, painel por instancia). Fechar uma excecao
sem registrar o que sobrou dela e como o defeito central deste PR comecou.

## 8. Riscos residuais

- O alerta e **pull**, e nao push: ele so aparece para quem abre `/operacoes`.
  Uma trilha parada as 3h da manha continua sem tocar ninguem ate alguem olhar.
  Esta e a lacuna mais relevante que a fase deixa aberta, e ela e consciente --
  ver a recusa das duas alternativas na secao 6.
- Os limiares de negativa nao tem base medida. Se o volume de fundo real for
  maior que 50/h, o alerta vira ruido e sera ignorado, que e o pior desfecho
  possivel para um alerta. Primeiro item a rever quando houver medida.
- O alerta de falha fica aceso ate o restart. E deliberado, mas significa que um
  operador pode aprender a conviver com ele. O criterio de encerramento
  ("contador estavel", e nao "alerta sumiu") existe para conter isso, e depende
  de disciplina humana.
- O procedimento inteiro depende de uma pessoa. Nenhum controle tecnico cobre
  isso.

## 9. Rollback

Reverter o commit desta fase remove os dois alertas, o contador de negativas, o
gate de procedimento e as secoes do runbook. Nao ha estado persistente a
desfazer: nenhuma migration, nenhuma coluna, nenhum dado. Os contadores vivem em
memoria de processo e desaparecem com ele.

Reverter reabre a lacuna da secao 7 da politica e devolve o PR 52 a "duas metades
do gate minimo de tres".

## 10. Operacoes externas

Esta fase **nao** exige nenhuma operacao externa antes do merge. Nao ha DDL, nao
ha migration e nao ha configuracao de provedor a mudar -- ao contrario da fase 2,
cuja migration `1720000001038` exigia aplicacao fora de banda com `neondb_owner`.

Depois do merge, ha **um** passo humano recomendado e ele nao e bloqueante para o
merge: executar o procedimento de teste de alerta em banco descartavel e
registrar o resultado sanitizado. Ate que isso aconteca, o que esta provado e a
logica dos alertas pelos testes automatizados -- e nao o caminho operacional
ponta a ponta.

Continua valendo o achado operacional herdado da fase 2, ainda em aberto:
conferir `OCTACLIN_BACKEND_URL` e `OCTACLIN_TENANT_SLUG` no servico web de
producao. Esta fase nao o tocou.
