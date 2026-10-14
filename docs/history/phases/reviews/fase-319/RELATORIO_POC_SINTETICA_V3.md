# Relatório da PoC sintética — Fase 319

Data da execução: 2026-10-13. Escopo autorizado: T01–T04 em laboratório local,
CPU, dados sintéticos, sem chamadas pagas e sem alteração no runtime OctaClin.

## Protocolo e rastreabilidade

- Corpus v3: 40 consultas (10 desenvolvimento, 30 teste), 210 documentos no
  arquivo; 200 fontes do paciente sintético usadas por consulta, mais 10
  documentos de outro tenant excluídos antes da recuperação.
- Teste final: 25 consultas com fonte gold e 5 sem resposta. Os quatro casos
  `fonte-antiga` ficam depois das primeiras 50 fontes ao ordenar por criado_em/id.
- SHA-256 corpus: `340f7247def447ae92f9306ee42a904af136c80aa598c0369fb987301e14a07e`.
  Critérios do protocolo não foram alterados depois dos resultados.
- Oráculos apontam para fonte criada para cada consulta, mas não tiveram revisão
  humana independente. Os resultados não demonstram validade clínica nem
  generalização para prontuários reais.
- Run exploratório v1 arquivado em `research/fase319/results/archive/`; foi
  substituído antes da avaliação final porque os casos antigos não estavam
  todos além das primeiras 50 fontes em ordem cronológica por criado_em/id. A rodada oficial é
  corpus/protocolo v3.

## Candidatos e procedência

| Modelo | Licença declarada no cartão | Arquivo LICENSE na revisão | ONNX SHA-256 verificado | Dimensão |
| --- | --- | --- | --- | --- |
| multilingual-e5-small, revisão `614241f622f53c4eeff9890bdc4f31cfecc418b3` | MIT | HTTP 404 | `ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665` | 384 |
| paraphrase-multilingual-MiniLM-L12-v2, revisão `e8f8c211226b894fcb81acc59f3b34ba3efd5f42` | Apache-2.0 | HTTP 404 | `10f7a088420252b26caf819236ca2c9d2987afd0fc06fec7553b542a5655a05a` | 384 |

Os tokenizers também coincidiram com os hashes LFS declarados no manifesto.
Ambos os grafos ONNX foram validados estaticamente, usam somente operadores
ONNX padrão e recebem `input_ids`, `attention_mask` e `token_type_ids`. E5 usa
`query:`/`passage:`, mean pooling com máscara e normalização L2. Nenhum código do
repositório dos modelos foi executado. Os bytes ficam em `/tmp`, fora do Git.

Os cartões afirmam licença, mas o endpoint `LICENSE` retorna 404; os direitos da
cadeia dos pesos e a permissão comercial permanecem **não comprovados**. A
avaliação local sintética não aprova dependência para produto. G02 segue BLOCKED.

## Resultado congelado (protocolo v3)

| Método | NDCG@10 médio (25 consultas positivas) | Recall@10 | Ganho NDCG vs. BM25 |
| --- | ---: | ---: | ---: |
| BM25 textual | 0,880 | 0,920 | referência |
| E5 small | 0,961 | 1,000 | +0,081 |
| MiniLM L12 v2 | 0,885 | 0,920 | +0,005 |

O protocolo exige ganho absoluto NDCG de pelo menos 0,10 e Recall@10 de pelo
menos 0,90. E5 tem recall e não regrediu nas categorias avaliadas, mas o ganho
NDCG ficou abaixo do corte congelado. MiniLM também não atingiu o ganho e teve
regressões em termo raro/fonte antiga. Portanto, os dois candidatos falham o
critério de valor para continuar a implementação semântica nesta versão.

Nos cinco casos sem resposta, os executores produziram ranking top-10; não foi
implementado limiar de abstinência. A contagem não permite classificar cada
resultado como enganoso sem revisão humana. Não há ensaio de tempo humano,
avaliação independente dos golds ou decisão final de produto. G01 permanece
BLOCKED; recomendação técnica provisória: NO-GO semântico nesta versão e avaliar
somente busca textual se a equipe confirmar a utilidade dos rótulos.

### Leitura comparativa por consulta

Recontagem direta dos 30 registros de teste em `run-001.json`, comparando cada
posição com o único `sourceId` gold congelado na consulta:

| Medida | BM25 | E5 | MiniLM |
| --- | ---: | ---: | ---: |
| Gold em 1º lugar (25 consultas respondíveis) | 21/25 | 23/25 | 21/25 |
| Gold em qualquer posição do top-10 | 23/25 | 25/25 | 23/25 |
| Consultas sem resposta (5): saída top-10 | 5/5 | 5/5 | 5/5 |

E5 recuperou no top-10 os dois golds que BM25 não encontrou: `q-019`
(`número-unidade`, posição 5) e `q-022` (`horário`, posição 1). Também elevou
`q-015` e `q-033` (negação) da posição 3 para a 1. Em `q-030` (paráfrase),
BM25 ficou em 1º e E5 em 2º. As quatro consultas `fonte-antiga` mantiveram seu
gold no 1º lugar com ambos. O ganho de cobertura do E5 é observável neste
corpus, mas o ganho de NDCG médio continua abaixo do corte pré-fixado; esses
30 casos não demonstram superioridade geral nem relevância clínica.

Nos cinco casos sem resposta, o top-1 foi `syn-013`, `syn-037`, `syn-038`,
`syn-039` e `syn-040` no BM25; `syn-036` a `syn-040` no E5; e `syn-036`,
`syn-037`, `syn-038`, `syn-039` e `syn-011` no MiniLM, respectivamente para
`q-036`–`q-040`. Isso confirma somente que os três métodos sempre ranqueiam
alguma fonte; sem rótulo de não relevância validado por avaliador, limiar de
abstenção e teste de uso, não mede taxa de falso resultado nem segurança da
interface. Esta é uma leitura analítica dos artefatos, não revisão humana
independente dos rótulos.

## Capacidade sintética em CPU

Execução em um núcleo (`taskset`), Python 3.12.14, ONNX Runtime 1.22.1,
ONNX 1.19.0, tokenizers 0.21.4 e NumPy 2.5.4. A escala mediu E5; 5.000 fontes
curtas mais uma nota de 6.000 caracteres dividida em janelas de 96 tokens com
24 de sobreposição.

| Fontes | Build acumulado E5 | p95 quente E5 | BM25, uma consulta |
| ---: | ---: | ---: | ---: |
| 50 | 0,53 s | 14,9 ms | 1,0 ms |
| 51 | 0,55 s | 16,4 ms | 0,8 ms |
| 200 | 1,96 s | 19,6 ms | 5,6 ms |
| 1.000 | 12,87 s | 21,6 ms | 16,5 ms |
| 5.000 | 80,63 s | 33,5 ms | 130,4 ms |

RSS máximo do processo E5: 1.436.256 KiB (aprox. 1,37 GiB). No comparativo que
carregou ambos candidatos sequencialmente, RSS máximo observado foi 1.836.712
KiB (aprox. 1,75 GiB). Um `ulimit -v 2097152` falhou ao inicializar o ONNX ao
tentar reservar espaço virtual; isso não é uma medida de RSS. Sem esse limite
artificial, os processos completaram. Os números representam este container,
não staging/produção. O critério de build de 1.000 fontes passou neste ambiente;
isso não compensa o corte de qualidade falho nem aprova arquitetura de produto.

## Verificações executadas

- `python -m unittest discover -s research/fase319/tests -v`: 10 testes PASS.
- `taskset -c 0 /tmp/f319-venv/bin/python research/fase319/run_benchmark.py`:
  concluído no corpus v3; métricas por consulta em `run-001.json`.
- `taskset -c 0 /tmp/f319-venv/bin/python research/fase319/run_scale.py`:
  concluído; evidência detalhada em `scale-e5.json`.
- SHA-256 real dos dois ONNX e dois tokenizers confere com o LFS declarado.
- `onnx.checker.check_model` PASS nos dois grafos; zero domínios customizados.
- `git diff --check` e scanner de secrets executados antes dos commits.

Não foram executados testes NestJS/Next.js, PostgreSQL/RLS, Playwright, CI,
testes de autorização do produto, testes com pacientes ou alterações de runtime.
Os scripts de recuperação são de laboratório e não são serviço seguro para PHI.

## Gates

| Gate | Estado | Evidência/pendência |
| --- | --- | --- |
| G00 | PASS | Decisões e base documental conferidas. |
| G01 | BLOCKED | Corte NDCG falhou; falta revisão dos rótulos, ensaio humano e decisão de valor. |
| G02 | BLOCKED | SHA e grafo verificados; `LICENSE` e cadeia de direitos não comprovados. |
| G03 | BLOCKED para produto | Sem threat model aprovado para fontes/derivados clínicos persistentes e revisão institucional. |
| G04 | SKIPPED | Nenhum runtime do OctaClin foi alterado/testado nesta PoC. |
| G05 | BLOCKED | Nenhum ambiente/alvo/piloto autorizado ou configurado. |
