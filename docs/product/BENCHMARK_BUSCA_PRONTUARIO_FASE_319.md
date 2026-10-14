# Benchmark e resultados — Fase 319

Status: pesquisa técnica encerrada em 2026-10-14 com NO-GO para implementação de
busca semântica E5/MiniLM. Os protocolos e resultados v3/v4 são somente
sintéticos; nenhum runtime ou teste de implementação de produto foi executado.

## Hipótese e comparadores

Hipótese: busca semântica encontra trechos úteis em português com menos esforço
que navegar pela timeline/filtros ou pesquisar palavras, sem perder acesso exato
à fonte. Se busca textual for suficiente, registrar NO-GO semântico e recomendar
somente a alternativa cujo valor foi demonstrado, antes de implementar produto.

A — baseline atual: timeline com filtros/tipos/datas, Evoluções limitada50.
B — textual lexical: fonte completa sintética paginada; tokens normalizados,
acentos/case-insensitive, BM25 local por paciente, sem índice clínico persistido.
C — semântico: embedding local + cosseno, candidatos recuperados somente no mesmo
paciente; mean-pooling/normalização/prefixos conforme manifesto do modelo.
Normalização textual: NFKC, minúsculas e remoção de acentos apenas para ranking;
original nunca alterado. Congelar stopwords/tokenização e pesos BM25(k1=1,2,b=0,75).
Embedding: cada tokenizer divide em janelas de 96 tokens com sobreposição de 24 tokens,
sem truncar o histórico; preservar offsets no original e deduplicar fonte pelo
melhor trecho. E5 usa os prefixos documentados `query:` e `passage:`; MiniLM
usa seu contrato próprio sem esses prefixos. Conferir pooling/normalizaçãoL2 e
limites antes de executar; não derivar tamanho pela coluna de 1.536 dimensões da fundação.

D — híbrido candidato: fusão RRF com constante 60, só se B/C justificarem comparar;
sem ajustes no conjunto de teste final e sem provider/ LLM generativo.

## Corpus e oráculos

Planejar 40 consultas: 10 de desenvolvimento e 30 de avaliação congelada. Cada consulta
positiva tem de 1 a 3 fontes relevantes, com IDs e grau 0/1/2 registrado por revisores.
Separar consultas sem resposta; NDCG/Recall não recebem valor artificial nesses
casos. Realizar revisão humana dos rótulos antes de congelar o teste final.

Categorias: sinônimos/expressões nutricionais; frases exatas/termos raros;
negação/hipótese/relato; números/unidades/datas; informações divergentes;
fonte relevante além do registro 50; duplicidades; nenhum trecho relacionado;
texto malicioso tratado como dado; fonte ilegível/alterada; pacientes/tenants
semelhantes. Consultas não são instruções de conduta ou diagnósticos.

Volumes de 50, 51, 200, 1.000 e 5.000 fontes por paciente, com conteúdo até 6.000 caracteres.
Dados de desenvolvimento/teste distintos. Modelos veem as mesmas fontes; medir
cobertura completa, preparação fria, consulta quente e abertura da fonte.

## Critérios pré-registrados propostos

- Isolamento: zero fontes/contagens/vetores de outro tenant/paciente/carteira;
  requisito absoluto, não média estatística. Fontes exibidas sempre literais.
- Semântico/híbrido só recebe GO de valor se NDCG@10 subir>= 0,10 absoluto sobre B,
  Recall@10>= 0,90 nas consultas positivas e não houver regressão no subconjunto
  de identificações exatas/datas/unidades/negações comparado a B.
- Registrar retornos enganosos em consultas sem resposta e abstinência; no máximo
  1 consulta sem resposta classificada pelos revisores como enganosa no teste final.
  Similaridade/limiar técnico não deve ser exibido como probabilidade clínica.
- Tempo humano de localizar/abrir fonte: redução mediana>= 20% sobre A em ensaio
  cego/ordem balanceada. Sem pessoas no ensaio, essa medida fica BLOCKED, não PASS.
- Laboratório: CPU de 1 núcleo/RAM de 2 GiB como limite de medição proposto, sem GPU; consulta
  quente p95<=2s; medir também RSS, build frio, bytes e threads. Capacidade real
  de staging/produção desconhecida nesta rodada. Peso pequeno não prova fit.
- Preparação de 1.000 fontes <= 300 s é teto de laboratório, não UX aprovado de espera.
  Se completa apenas por build caro/índice, desenhar lifecycle antes do piloto.
  Query com timeout/fonte ilegível registra cobertura parcial, sem falso completo.
- Protocolos, seeds, versões, goldsets, hardware, opções de tokenizer/chunking,
  critérios e hashes congelados antes do teste final. Mudança gera versão nova.
  Não relaxar cortes para transformar FAIL em PASS.

Esses números são alvos de engenharia propostos para decidir custo/valor; não
são limites clínicos ratificados. Caso inviáveis ou inconclusivos, registrar
FAIL/BLOCKED/NO-GO e alternativas com a evidência, sem habilitar produto.

## Modelos, segurança e evidência

Candidatos: multilingual-e5-small (principal para recuperação textual) e
paraphrase-multilingual-MiniLM-L12-v2 (comparador). Metadados públicos, revisões,
licenças declaradas e hashes estão em FONTES_BUSCA_SEMANTICA_FASE_319.json.
As duas versões não quantizadas têm pesos de aproximadamente 470,6 MB; RAM de
inferência e dependências não foi medida. Não supor funcionamento em 512 MiB.

T02 deve verificar licença escrita/cadeia de artefatos, fixar commit e verificar
SHA256 real do arquivo baixado; hash LFS declarado não é hash conferido. Escolher
Safetensors/ONNX, sem pickle/trust_remote_code/execução remota; medir versão
quantizada somente se origem/conversão reproduzível e qualidade forem verificadas.
Não baixar modelo, instalar dependência ou executar código estrangeiro nesta
rodada. API externa, OpenAI/BYOK e chamadas pagas ficam excluídas por D04.

Relatório futuro por versão: datasets/oráculos, modelo/artefato/licença, engine,
configurações/seed, NDCG/Recall por consulta, fontes retornadas, latência/RSS,
limitações e decisão GO/NO-GO. Evidência só sintética e agregada; nada de PHI.


## Resultado da execução sintética v3 — 2026-10-13

Protocolo/hash e resultado detalhado: `research/fase319/protocolo.json`,
`research/fase319/results/run-001.json` e `scale-e5.json`. Em 25 consultas
positivas, BM25 obteve NDCG@10 0,880 e Recall@10 0,920; E5 obteve 0,961/1,000;
MiniLM obteve 0,885/0,920. Os ganhos absolutos de NDCG (+0,081 e +0,005) ficaram
abaixo do corte congelado de +0,10. Candidatos atuais não recebem GO técnico.

E5 escalou em CPU neste container: build cumulativo 12,87 s/1.000 fontes e
80,63 s/5.000; p95 quente 21,6 ms/1.000 e 33,5 ms/5.000; RSS 1.436.256 KiB.
Isso não representa produção. Os oráculos foram construídos junto do corpus, sem
revisão humana independente; o ensaio de tempo humano não foi feito. G01 segue
BLOCKED, e a recomendação técnica é NO-GO semântico nesta versão. Direitos ficam
BLOCKED em G02 pois os dois cartões declaram licença mas `LICENSE` retornou 404.

## Fechamento da pesquisa — v4

V3 e seus resultados permanecem como baseline histórico. A v4 incorporou as
correções da auditoria recebida, preservou os thresholds e está detalhada em
`research/fase319/v4/protocolo.json`, `research/fase319/v4/corpus.json` e
`research/fase319/v4/results/run-001.json`.

Em v4, BM25 e E5 empataram em NDCG@10 0,945/Recall@10 0,960; MiniLM obteve
0,905/0,920. O ganho E5 foi 0,000 (corte +0,10); MiniLM regrediu −0,040. E5
falhou em recuperar q-021, consulta de data localizada por BM25. O limiar de
consulta sem resposta enganosa permanece não demonstrado: não há critério
operacional de abstenção e todos os motores retornaram top-10 nos cinco casos.

Decisão final: **NO-GO para implementar E5 ou MiniLM na Fase 319**. G01/G02/G03
permanecem BLOCKED; G04 SKIPPED; G05 BLOCKED. A Fase 320 é a próxima etapa
vigente. Contexto clínico compartilhado, busca textual estruturada e integração
MCP com ChatGPT são possibilidades futuras que exigem planejamento próprio,
validação de produto, privacidade e segurança e autorização explícita após a
Fase 320.
