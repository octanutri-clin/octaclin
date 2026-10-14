# Relatório da rodada sintética v4 — Fase 319

Data: 2026-10-13. Escopo: corrigir os rótulos levantados na auditoria recebida,
congelar um corpus versionado separado e repetir BM25/E5/MiniLM em CPU local.
Nenhum runtime, banco, migration, serviço externo ou dado real foi usado.

## Integridade e mudanças

- Corpus v3, protocolo v3, hash e `run-001.json` permanecem preservados.
- V4: 40 consultas (10 dev/30 teste), 210 documentos (200 do paciente sintético
  consultado e 10 de outro tenant, excluídos antes do ranking); 25 positivas e
  cinco sem fonte relevante.
- SHA-256 do corpus v4:
  `28ca1fc052a20c286cfe8c2551ffa6d62d9967ea3270a2e1d19f6ca57239a5b6`.
- Sete enunciados foram corrigidos sem trocar seus golds: q-016, q-019, q-021,
  q-023, q-027, q-029 e q-033. q-036…q-040 mantêm consulta, `answerable=false`
  e gold vazio; syn-036…syn-040 agora tratam de assuntos neutros, sem menção ou
  negativa explícita dos alvos.
- O parecer recebido foi arquivado sem alteração. Suas correções orientaram a
  v4; sua autoria/qualificação não foi verificada independentemente. O teste
  automatizado confirma estrutura, isolamento e ausência lexical, mas não
  substitui uma nova revisão semântica humana dos cinco documentos neutros.
- Os oito textos de filler continuam repetidos 15 vezes cada. Foram mantidos
  para isolar correções de rótulo; podem distorcer o ranking e reduzem a validade
  externa do benchmark.
- SHA-256 do protocolo v4:
  `2642384d45fa77ef799b5278bbc8a43d11e75dea5013ecdfb18541a2d6892e6e`.
  Os thresholds são idênticos aos de v3; não foram ajustados após os resultados.

Detalhes editoriais e os limites do novo conjunto estão em
[`research/fase319/v4/REVISAO_ROTULOS.md`](../../../../../research/fase319/v4/REVISAO_ROTULOS.md).

## Resultado congelado

| Método | NDCG@10 | Ganho vs. BM25 | Recall@10 | Gold em 1º | Gold no top-10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| BM25 | 0,945 | referência | 0,960 | 23/25 | 24/25 |
| E5 small | 0,945 | +0,000 | 0,960 | 23/25 | 24/25 |
| MiniLM L12 v2 | 0,905 | −0,040 | 0,920 | 22/25 | 23/25 |

Critérios congelados: ganho absoluto NDCG de pelo menos 0,10, Recall de pelo
menos 0,90, sem regressão em consultas exatas/datas/unidades/negações e no
máximo uma consulta sem resposta enganosa. E5 e MiniLM passam somente o corte
de Recall. Nenhum alcança o ganho NDCG; E5 empata com BM25. MiniLM fica abaixo
do baseline. **A evidência v4 não demonstra valor incremental da busca
semântica.**

### Regressões e casos que merecem leitura

- q-021 pergunta a data sem revelá-la. BM25 e MiniLM recuperam o gold syn-021
  em primeiro; E5 não o coloca no top-10. Na única consulta da categoria `data`,
  E5 fica em 0/1 e BM25 em 1/1. Isso viola o critério congelado de não regressão
  para datas.
- q-022 continua sendo um ganho válido observado: E5 e MiniLM recuperam syn-022
  em primeiro para “seis e quinze”; BM25 não encontra o gold no top-10.
- q-030: BM25 e MiniLM colocam syn-030 (água com gás) em primeiro; E5 coloca
  syn-010 (kefir de água) antes e o gold em segundo. Água fermentada não é água
  gaseificada.
- q-019 agora pergunta capacidade da garrafa, portanto syn-019 é compatível; o
  ganho v3 observado nesse caso não deve ser reutilizado como resultado v4.

### Consultas sem fonte relevante

Os três motores retornam top-10 nos cinco casos; não há abstinência configurada.
Os top-1 por q-036…q-040 foram:

| Consulta | BM25 | E5 | MiniLM |
| --- | --- | --- | --- |
| q-036 — tofu nesta semana | syn-013 (leite) | fill-004 (agenda) | syn-011 (amaranto) |
| q-037 — suplemento de zinco | fill-000 (refeições) | neg-036 (termo genérico ausente de lista) | syn-009 (lentilha) |
| q-038 — caminhada na neve | syn-009 (lentilha) | syn-028 (sopa no inverno) | fill-004 (agenda) |
| q-039 — alergia a kiwi | fill-003 (refeições) | syn-031 (chá de hibisco) | syn-004 (bebida de aveia) |
| q-040 — pitaya amarela | syn-013 (leite) | syn-011 (amaranto) | syn-011 (amaranto) |

q-037 no E5 e q-038 no E5 são candidatos a resultado confuso: o primeiro fala
de ausência em lista genérica sem identificar zinco; o segundo compartilha
“inverno”, mas não descreve caminhada na neve. Esta leitura é qualitativa, não
um julgamento independente do proprietário. Os demais top-1 também são
resultados irrelevantes ao objeto perguntado. O protocolo fixa máximo de uma
consulta sem resposta enganosa, porém não define abstinência, limiar de score
nem regra para contar “enganosa”. Portanto esse gate fica **não demonstrado**;
`top10 nonempty = 5` é a saída do ranking, não uma taxa clínica de erro.

## Capacidade local e artefatos

Execução em um núcleo (`taskset -c 0`), Python 3.12.14 e pesos/tokenizers em
`/tmp/f319-models`, sem rede durante a inferência. Hashes conferidos antes da
rodada com os mesmos valores do manifesto: E5 ONNX
`ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665`, E5
tokenizer `0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39`,
MiniLM ONNX `10f7a088420252b26caf819236ca2c9d2987afd0fc06fec7553b542a5655a05a`,
MiniLM tokenizer `2c3387be76557bd40970cec13153b3bbf80407865484b209e655e5e4729076b8`.
Os dois grafos foram carregados e verificados pelo runner antes da inferência.

| Medida | E5 | MiniLM |
| --- | ---: | ---: |
| Construção para 200 fontes | 1,96 s | 1,81 s |
| p95 quente de consulta | 14,5 ms | 16,1 ms |

RSS máximo do processo: 1.816.248 KiB (aprox. 1,73 GiB). São medidas deste
container/corpus e não capacidade de staging ou produção.

## Verificações executadas

- `/tmp/f319-venv/bin/python -m unittest discover -s research/fase319/v4/tests -v`:
  **4 PASS** (hash/cortes, estrutura/golds, correções editoriais e ausência
  lexical dos alvos nos documentos elegíveis).
- `taskset -c 0 /tmp/f319-venv/bin/python research/fase319/v4/run_benchmark.py`:
  concluído, usando os mesmos pesos fixados e os critérios congelados.
- SHA-256 dos quatro artefatos ONNX/tokenizer conferido.
- Os top-10 não contêm documentos do outro tenant sintético; isso verifica o
  artefato local, não RLS nem isolamento do produto.
- O teste completo de laboratório `research/fase319/tests` ainda precisa ser
  executado nesta rodada; nenhum teste de runtime, PostgreSQL/RLS, autorização,
  Next.js/NestJS, Playwright, CI ou produção foi executado.

## Gates e parecer

| Gate | Estado | Evidência/pendência |
| --- | --- | --- |
| G00 — escopo/base | PASS | Corpus v3 preservado; v4, mudanças e hashes rastreáveis. |
| G01 — valor/relevância | BLOCKED | E5 ganho NDCG zero; MiniLM regressa; E5 falha consulta de data; regra sem resposta não mensurável sem abstinência; rótulos novos sem revisão humana independente; sem ensaio de tempo humano. |
| G02 — direitos | BLOCKED | Hashes e grafos verificados; cadeia de direitos/licenças comerciais continua sem comprovação. |
| G03 — privacidade/arquitetura | BLOCKED | Nenhuma arquitetura de produto, fonte clínica, índice ou threat model foi implementado/aprovado. |
| G04 — integração/runtime | SKIPPED | Nenhuma alteração nem teste do runtime OctaClin. |
| G05 — operação/piloto | BLOCKED | Nenhum alvo, autorização operacional ou piloto habilitado. |

**Recomendação:** NO-GO para promover E5/MiniLM a implementação semântica na
Fase 319 com esta evidência. Manter a possibilidade de busca textual apenas como
decisão de produto separada; G01 continua BLOCKED. A rodada sintética não
autoriza implementação clínica, runtime, uso real, licença comercial, merge ou
deploy.
