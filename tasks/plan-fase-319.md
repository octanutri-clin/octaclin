# Registro de encerramento da Fase 319 — pesquisa técnica NO-GO

Status: pesquisa técnica concluída. NO-GO para implementação de busca
semântica com E5 ou MiniLM. Este documento é histórico de evidência e não é
autorização para runtime ou nova PoC. A Fase 320 foi posteriormente encerrada
nesta rodada com NO-GO para ingestão TBCA; consultar `tasks/plan-fase-320.md`.

Branch `docs/fase-319-planejamento`, base main `b9535170`; worktree
`/tmp/octaclin-f319-planejamento`. Fase 318/PR #410 e uploads pós-320 preservados em
branch própria. Não considerar merge410 ou configuração operacional realizada.

## Fontes de verdade

- [Plano, gaps, interfaces, arquivos e T00–T10](../docs/history/phases/PLANO_FASE_319.md).
- [D01–D06 e invariantes](../docs/product/CONTRATO_BUSCA_PRONTUARIO_FASE_319.md).
- [Protocolo de comparação e critérios propostos](../docs/product/BENCHMARK_BUSCA_PRONTUARIO_FASE_319.md).
- [Manifesto público de candidatos](../docs/product/FONTES_BUSCA_SEMANTICA_FASE_319.json).
- [Checklist e dependências](todo-fase-319.md).

## Decisões confirmadas

Um paciente por vez; evoluções/anotações (tipo `observacao` existente), trechos
com acesso ao original, local em CPU/só sintéticos/sem chamadas pagas, somente
responsável atual no eventual piloto e cobertura histórica completa autorizada.
Não propor novamente carteira inteira, respostas LLM, exames/OCR ou OpenAI/BYOK.

## Gaps que determinam a implementação futura

Timeline filtra tipos/datas, não busca texto. Evoluções ficam cifradas e lista
é limitada50. Abrir histórico apenas troca a aba; fonte51+exige detalhe porID.
`vector(1536)` antigo pertence a sentimentos, não ao prontuário. Índice de PII
cego não autoriza vetor clínico em claro. FastAPI não possui engine de embeddings.

Gerações1071 podem ajudar invalidar vínculo, mas fontes precisam de versão/cutoff
próprios e cursor protegido. Não importar direitos318, restrições sociais317ou
migrations antigas. Não pesquisar só o conteúdo carregado no navegador.

## PoC sintética executada e limites

O proprietário autorizou continuar com T01–T04 em ambiente local sintético.
V3 foi preservado; v4 corrigiu sete enunciados e neutralizou cinco textos de
ausência, com hashes e thresholds registrados antes da rodada. Dez testes da
base e quatro testes de integridade v4 passaram; ONNX/tokenizers e hashes foram
verificados e os resultados estão preservados no laboratório e relatórios.

O teste não usa runtime, pacientes, PostgreSQL ou ambiente externo; nenhuma
dependência foi adicionada ao produto. Um limite artificial de espaço virtual de
2 GiB impediu a inicialização; RSS real foi medido sem esse limite e permaneceu
abaixo de 2 GiB. Direitos comerciais, revisão independente dos rótulos e estudo
de tempo humano seguem pendentes. T05–T10 seguem bloqueadas por valor, direitos,
privacidade e autorização de implementação.

Depois da auditoria recebida dos 30 casos, v3 foi preservado e v4 foi criado em
`research/fase319/v4/`. Sete enunciados foram ajustados, cinco fontes negativas
foram neutralizadas, o hash foi congelado antes da nova rodada e os thresholds
v3 foram mantidos. Resultado v4 e limites: [relatório da rodada](../docs/history/phases/reviews/fase-319/RELATORIO_POC_SINTETICA_V4.md).
V4 não demonstra ganho semântico; os cinco novos textos negativos ainda precisam
de revisão independente e não há regra de abstenção para pontuar o corte de
consultas sem resposta. G01 permanece BLOCKED.

## Decisão e sequência vigente

Encerrar a pesquisa com NO-GO para E5/MiniLM. V4 não atingiu o ganho NDCG
congelado, E5 regrediu em q-021/data e o limite para consultas sem resposta não
pôde ser avaliado sem regra prévia de abstenção. G01 e G02 seguem BLOCKED; G03
segue BLOCKED para produto; G04 foi SKIPPED; G05 está BLOCKED e não foi
executado.
T05–T10 não iniciadas. A Fase 320 foi encerrada documentalmente em NO-GO para
TBCA nesta rodada; a onda pós-320 foi iniciada somente com FND02, por decisão
posterior do proprietário. Contexto clínico compartilhado,
busca textual estruturada e MCP com ChatGPT são possibilidades futuras somente
após a 320, sob planejamento próprio, validação de produto, privacidade,
segurança e autorização explícita.

Recomendação de modelo: GPT 6 Luna alto é suficiente para corpus/métricas/PoC
isolada com contrato fechado. GPT 6.1 Sol médio é indicado para auth/RLS/cifra,
integração e revisão de segurança; avisar e pausar antes da troca manual.

## Entregas das rodadas sintéticas

Documentos de decisão/gaps, corpus sintético e protocolo hashado, comparadores
BM25/E5/MiniLM, métricas com testes unitários, verificação estática ONNX e resultados de
escala. V4 tem fixture/testes/runner/resultados próprios; a auditoria recebida foi
arquivada sem alteração. Nenhuma ratificação clínica/jurídica foi feita.

Modelo para esta PoC: GPT 6 Luna alto é suficiente. Sol médio é indicado antes
da futura integração de auth/RLS/cifra e revisão de segurança; avisar e pausar
para troca manual antes dessa transição.
