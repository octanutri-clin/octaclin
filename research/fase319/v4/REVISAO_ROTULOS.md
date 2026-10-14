# Revisão de rótulos e mudanças — Fase 319, corpus v4

Data do congelamento: 2026-10-13. Corpus exclusivamente sintético.

## Procedência e limites da revisão

A revisão de 30 casos recebida foi arquivada sem alteração em
`docs/history/phases/reviews/fase-319/AUDITORIA_30_CASOS_POC_FASE_319.md`.
Ela classifica 18 casos como válidos, 4 como precisando de ajuste, 3 como
insuficientes e os 5 negativos como inválidos por conterem afirmações explícitas
de ausência. Os ajustes abaixo seguem as recomendações editoriais dessa revisão.
O conteúdo e a consistência textual foram conferidos contra corpus v3; a
identidade e a qualificação de quem assinou o parecer não foram verificadas.

Esta execução não afirma revisão independente dos novos textos `syn-036` a
`syn-040`. Eles foram redigidos para não conter os termos alvo nem suas
negações explícitas; a revisão semântica humana independente desses negativos
continua necessária. O verificador automatizado cobre integridade, estrutura,
isolamento sintético e ausência lexical, não equivalência semântica.

## Correções aplicadas às consultas respondíveis

| Consulta | Gold preservado | Consulta v4 | Motivo |
| --- | --- | --- | --- |
| q-016 | syn-016 | Localize a anotação que relata desconforto após o lanche, sem afirmar causalidade. | A fonte relata sequência temporal, sem atribuir causalidade nem formular hipótese. |
| q-019 | syn-019 | Qual é a capacidade, em mililitros, da garrafa levada ao trabalho? | A fonte menciona garrafa de 750 mL; não afirma água nem consumo. |
| q-021 | syn-021 | Para qual data foi combinada a próxima conversa? | A versão anterior continha a data na pergunta e pedia informação diferente da fonte. |
| q-023 | syn-023 | Existe registro de um copo tomado como referência de aproximadamente 200 mL? | A fonte registra a capacidade de referência, não o uso do copo. |
| q-027 | syn-027 | Qual nota antiga menciona pão de fermentação natural? | A nota é antiga, mas não é a mais antiga do corpus. |
| q-029 | syn-029 | Qual nota menciona que uma receita de milho roxo foi compartilhada? | A fonte menciona compartilhamento, sem descrever a receita. |
| q-033 | syn-033 | Há relato de que a pessoa deixou de consumir café no período da tarde? | A fonte limita a interrupção ao período da tarde. |

As 18 consultas que a revisão recebida marcou como válidas mantêm texto e gold.
Todos os 25 positivos continuam com um gold de grau 2. Essa convenção simples
não avalia múltiplas fontes alternativas; é uma limitação remanescente do
benchmark.

## Consultas sem resposta e fontes neutras v4

As consultas q-036 a q-040 permanecem com `answerable: false` e `gold: []`.
As fontes que anteriormente afirmavam que não havia menção foram substituídas
por textos sintéticos sobre outros assuntos:

| Documento | Texto v4 | Consulta negativa |
| --- | --- | --- |
| syn-036 | Relatou que costuma incluir lentilhas no jantar. | q-036 — tofu nesta semana |
| syn-037 | Comentou que prefere ouvir música durante o trajeto ao trabalho. | q-037 — suplemento de zinco |
| syn-038 | A pessoa relatou que reorganizou a agenda no início da semana. | q-038 — caminhada na neve |
| syn-039 | Comentou que está lendo um romance histórico nas horas livres. | q-039 — alergia a kiwi |
| syn-040 | Relatou que visitou uma exposição de fotografia no fim de semana. | q-040 — pitaya amarela |

Uma varredura lexical dos 200 documentos elegíveis não encontra `tofu`, `soja`,
`zinco`, `suplemento`, `neve`, `esqui`, `ski`, `kiwi`, `alergia`, `pitaya` ou
`fruta do dragão`. Isso não substitui julgamento semântico humano. Os 10
documentos do tenant sintético separado permanecem inalterados e são excluídos
antes do ranking.

## Integridade e comparabilidade

- Corpus v4: 210 documentos, 40 consultas, partição 10 dev/30 teste, 25
  respondíveis e 5 sem fonte relevante.
- SHA-256: `28ca1fc052a20c286cfe8c2551ffa6d62d9967ea3270a2e1d19f6ca57239a5b6`.
- Os critérios congelados de v3 foram copiados sem alterar qualquer corte.
- Os fillers foram mantidos para isolar as correções de rótulo; continuam sendo
  oito textos repetidos 15 vezes cada. Isso limita a validade externa e pode
  distorcer rankings.
- v3, seu hash e `run-001.json` não são reescritos. Resultados v4 não devem ser
  comparados como se fossem a mesma amostra v3.
- Nenhuma métrica de qualidade foi inspecionada antes de congelar o hash v4.

## Critério de ausência e abstinência

O runner classifica os positivos por NDCG/Recall, mas sempre retorna uma lista
top-10. O limite congelado de no máximo uma consulta sem resposta enganosa não
tem limiar de abstinência nem regra operacional de julgamento. Portanto, a
execução reportará os rankings desses cinco casos, mas não converterá “top-10
não vazio” em uma taxa de engano. Este critério continuará não demonstrado e
G01 permanece BLOCKED.
