# Fase 319 — encerramento da pesquisa de busca no prontuário

> **For agentic workers:** Executar nativamente as tarefas após autorização, seguindo AGENTS.md e este handoff; usar `superpowers:executing-plans` se disponível. Revisão cruzada R4 quando viável. Não escolher modelo/delegação silenciosamente.

**Objetivo original:** demonstrar se busca por significado melhora a localização de evoluções autorizadas de um paciente, comparada aos filtros e à busca textual.
**Decisão de encerramento:** pesquisa técnica concluída com NO-GO para implementar busca semântica usando E5 ou MiniLM, conforme resultados da PoC v4. A proposta original de piloto não avançará.
**Tech Stack:** NestJS/TypeORM/PostgreSQL/RLS/Next.js existentes. Dependências/engine de embedding restritos ao laboratório até passar gates.
**Spec:** [Contrato e decisões D01–D06](../../product/CONTRATO_BUSCA_PRONTUARIO_FASE_319.md), [benchmark proposto](../../product/BENCHMARK_BUSCA_PRONTUARIO_FASE_319.md).

## Global Constraints

- Esta documentação registra pesquisa e PoCs locais sintéticas já executadas. Não autoriza nem inclui runtime, embeddings de produto, índice vetorial, novas rodadas de PoC, migrations, merge, deploy ou ativação.
- Um paciente; evoluções/anotações autorizadas; trechos/data/origem/original, sem resposta de IA.
- PoC local CPU, exclusivamente sintética e sem chamadas pagas/OpenAI.
- Piloto só responsável atual; histórico completo autorizado, sem ocultar cobertura parcial.
- Tenant/SID/carteira/versões revalidados; RLS/FORCE e role NOBYPASSRLS; cifras e histórico preservados.
- Vetores/tokens/textos derivados reais são sensíveis; nenhum índice clínico em claro, cache persistente ou logs de consulta.
- 316 stand-by, 314 bloqueios preservados; nenhuma nova concessão BYOK318 ou portal familiar.
- Não iniciar busca semântica/produto/persistência com base nesta pesquisa. Uma futura camada compartilhada de contexto clínico, busca textual estruturada ou integração MCP com ChatGPT exige planejamento próprio, validação de produto, privacidade e segurança, e autorização explícita após a Fase 320.
- A Fase 320 foi encerrada nesta rodada com `NO-GO` para TBCA; consultar `docs/history/phases/PLANO_FASE_320.md`. O backlog pós-320 iniciou apenas FND02 por autorização posterior do proprietário.

## Review Focus

1. Fonte antiga além do registro 50: deve ser pesquisável e abrir o original exato, não apenas mudar de aba.
2. Transferência A→B→A, revogação/SID trocado durante consulta: descartar resultado/cursor antigos; nova busca usa autorização atual.
3. Negação/unidade/data na borda do trecho: texto literal com contexto e aviso, sem interpretação inventada.
4. Fonte ilegível/alterada/página com zero itens após filtros: reportar cobertura incompleta; não perder avanço/produzir falso fim.
5. Modelo/corpus mudou ou build foi interrompido: invalidar resultado/versão, sem combinar vetores incompatíveis nem falso completo.

## Base, escopo e evidência

Base inspecionada main `b9535170`, PR409 integrada, em2026-10-13. Branch
`docs/fase-319-planejamento`, worktree `/tmp/octaclin-f319-planejamento` por
ENOSPC do disco principal. Worktrees/alterações anteriores preservadas.
PR410 permanece separada, com CI sob acompanhamento do proprietário; não assumir
merge/ativação. Uploads pós320 preservados naquela PR, para uso após320.

D01–D06 foram confirmadas por perguntas da sessão. Não há decisão de produto
aberta nesta revisão. Autorização de implementação/PoC e GO/rollout são posteriores.

## Gaps confrontados com código

| ID | Evidência real | Consequência e resolução proposta |
| --- | --- | --- |
| GAP01 | `ServicoPacientes.listarLinhaDoTempoPaginada`, padrão20/máximo50; DTO filtra tipo/data/responsável, sem texto | Timeline é baseline, não buscador de conteúdo. Não alterar filtros para fingir semântica. |
| GAP02 | `listarEvolucoesClinicas`, `take:50`; título/conteúdo cifrados em `EvolucaoClinicaOrm` | Consulta autorizada paginada server-side e leitura/cifra; não pesquisar só os50do navegador. |
| GAP03 | `abrirDetalheEvento` só troca a aba para evolução | Nova abertura da fonte por ID, inclusive51+, com autorização e versão; não depender da lista50. |
| GAP04 | `observacao` já é tipo de evolução; visibilidade atual só `privada` | Reusar a mesma fonte; não criar tabela de notas ou aplicar filtro exclusivo de autor inexistente. |
| GAP05 | Migração fundação contém vector e `ai_sentiment_analysis.embedding vector(1536)`; ORM/API atuais não implementam busca vetorial de prontuário | Não usar coluna de sentimentos ou assumir dimensão1536. Conferir modelo/dimensão própria no laboratório. |
| GAP06 | ADR017 autoriza índice cego de nomes/contatos, não conteúdo clínico em claro | Semântica exige análise de derivado sensível; persistência cifrada ou processamento efêmero, só após medir. |
| GAP07 | FastAPI atual usa heurísticas de sentimento/alimentos; não possui embeddings/retrieval | Não chamar endpoints legados como se fossem engine semântica. Não adicionar dependência/runtime durante planejamento. |
| GAP08 | `garantirEscopoPaciente` restringe Professional por responsável; outros papéis têm visão tenant-wide | Guard explícito novo de Professional e revalidação SID/perfil; preservar leitura legada para os outros papéis. |
| GAP09 | 1071 contém gerações monotônicas em paciente/perfil/usuário/tenant; não representa versão de cada evolução | Reusar epochs para vínculo sem herdar direitos318; definir snapshot de fonte/corpus e invalidação em alterações. |
| GAP10 | Cursor cronológico base64 contém data/id, sem consulta/versão/modelo | Novo cursor protegido por 15 min se necessário; não reutilizá-lo como capability. |
| GAP11 | Endpoints legados BFF de timeline/evoluções repassam texto da resposta e filtros por GET | Novo contrato fechado/projeção/no-store/POST para consulta; não ampliar genericamente esses endpoints. |
| GAP12 | Metadata dos dois candidatos declara licença e pesos~470,6MB | Verificar licença/artifact/hash realmente baixado e medir CPU/RAM; não inferir fit em 512 MiB nem aprovação clínica. |

Números de volumes/latência atuais de produção não medidos. Não consultadas
linhas clínicas, contagens de pacientes ou metadata de banco externo nesta rodada.
Presença de migration no Git não prova estado real de staging/produção.

## Etapas, checkpoints e arquivos

### T00 — baseline e decisões (esta rodada)

**Arquivos:** este plano, contrato, protocolo, manifesto, `tasks/plan-fase-319.md` e `tasks/todo-fase-319.md`.
**Consome:** roadmap302–320, código main, D01–D06.
**Produz:** escopo fechado, matriz de gaps e gates, sem software ativado.
- [x] Conferir Git/base/worktree e referências do código.
- [x] Registrar seis decisões confirmadas e distinção anotações/observação.
- [x] Verificar links/diff/secrets documentais e registrar limites reais.

### T01 — corpus e oráculos sintéticos

**Executado:** corpus v3 com 40 consultas (10 dev/30 teste), 210 documentos, 25 positivas e cinco sem resposta no teste. V4 preserva v3, corrige sete enunciados e troca cinco notas explícitas de ausência por textos neutros. A auditoria recebida está arquivada; ainda falta uma revisão independente dos novos textos neutros e comprovação da identidade/qualificação do auditor.

- [x] Corpus, seed e divisão dev/teste definidos.
- [ ] Revisão humana independente dos rótulos v4 antes de decisão de valor.
- [x] Hash e critérios congelados antes das rodadas finais v3 e v4; cortes da v3 preservados.

**Estado:** PARCIAL. Rótulos construídos por autoria não são oráculo humano independente; isso bloqueia conclusão de relevância/GO.

### T02 — procedência e viabilidade da engine local

**Artefatos:** `research/fase319/fetch_models.py`, `requirements-lab-lock.txt` e resultados em `research/fase319/results/`.

- [ ] Direitos: metadata declara MIT (E5) e Apache-2.0 (MiniLM); `LICENSE` retornou HTTP 404 em ambas as revisões. Cadeia dos pesos e autorização comercial não comprovadas.
- [x] ONNX fixado por revisão, grafo validado e somente operadores ONNX padrão; nenhum script/model card foi executado. Sem `pickle`/`trust_remote_code`.
- [x] Bytes e SHA-256 real de ONNX/tokenizers coincidem com hashes LFS declarados.
- [x] Loader, CPU, RSS, dimensão 384 e p95 medidos em dados sintéticos.

**Estado:** PARCIAL/BLOCKED por direitos. Licença declarada não é parecer nem autorização de incorporação/comercialização.

### T03 — motores e testes de métricas do benchmark

**Implementação de pesquisa:** `research/fase319/benchmark.py`, `run_benchmark.py`, `run_scale.py` e testes.

- [x] Testes de NDCG graduado, ordem inversa, gold vazio, Recall, normalização, determinismo BM25, chunk overlap, corpus sintético e fontes antigas.
- [x] BM25, E5 e MiniLM receberam as mesmas 200 fontes do paciente sintético, restringidas antes do ranking. Testadas negação, números/unidades e fonte >50.
- [x] `python -m unittest discover -s research/fase319/tests -v`: 10 passed.

**Limite:** a busca retorna ranking sem abstinência; os casos sem resposta precisam de revisão humana e não há limiar pré-registrado para abster. Os testes passaram, mas não foi registrado um ciclo RED antes de implementar as métricas; não declarar TDD completo.

V4 adicionou quatro testes de integridade do corpus, todos PASS. O comparador usa
o mesmo `benchmark.py`; runner específico em `research/fase319/v4/` lê somente o
corpus/protocolo v4 e grava resultados separados.

### T04 — ensaio e decisão GO/NO-GO

**Resultados:** `research/fase319/results/run-001.json` e `scale-e5.json`.

- [x] Rodada congelada; escala E5 em 50/51/200/1.000/5.000 fontes, RSS, construção, p95 e chunk de texto longo registrados.
- [x] Cortes mantidos. BM25 NDCG@10 0,880/Recall@10 0,920; E5 0,961/1,000; MiniLM 0,885/0,920. Ganhos NDCG +0,081 e +0,005, abaixo de +0,10.
- [x] Segunda leitura por consulta documentada em [RELATORIO_POC_SINTETICA_V3.md](reviews/fase-319/RELATORIO_POC_SINTETICA_V3.md): E5 recupera 25/25 golds no top-10 (BM25 23/25), com 23/25 em primeiro lugar (BM25 21/25); nos cinco casos sem resposta todos os métodos retornam ranking, sem limiar de abstenção. A leitura não é revisão humana independente.
- [ ] Estudo humano de tempo e avaliação de falsos positivos/abstinência.
- [ ] Decisão de valor/privacidade pelo proprietário após revisão dos rótulos.

**Conclusão técnica:** candidatos não atingem o corte; recomendação NO-GO semântico nesta versão. G01 continua BLOCKED: corpus sintético pequeno, gold sem revisão independente e tempo humano não medido. T05–T10 seguem bloqueadas.

**Rodada v4 (corpus corrigido):** evidência completa em
[RELATORIO_POC_SINTETICA_V4.md](reviews/fase-319/RELATORIO_POC_SINTETICA_V4.md).
BM25 NDCG@10 0,945/Recall@10 0,960; E5 0,945/0,960 (ganho 0,000); MiniLM
0,905/0,920 (ganho −0,040). E5 perde q-021 (data) que BM25 recupera, violando o
critério congelado de não regressão. Os cinco casos sem resposta recebem ranking
top-10, sem regra de abstenção para avaliar o corte de “no máximo uma enganosa”.
Conclusão v4: nenhum candidato demonstra valor semântico incremental; G01
permanece BLOCKED. v3 não foi reescrito nem substituído.

### T05 — contrato de API e fonte completa, somente após GO

**Criar:** `octaclin-backend/src/modulos/pacientes/aplicacao/servico-busca-prontuario.ts`,
`octaclin-backend/src/modulos/pacientes/aplicacao/dtos-busca-prontuario.ts`,
`octaclin-backend/src/modulos/pacientes/apresentacao/controlador-busca-prontuario.ts` e specs correspondentes.
**Modificar:** `octaclin-backend/src/modulos/pacientes/modulo-pacientes.ts` para registrar providers/controlador.
**Interfaces:** `consultar(u,pacienteId,ConsultaBusca319)->ResultadoBusca319`;
`obterFonte(u,pacienteId,fonteId)->FonteAutorizada319` (documento completo autorizado).
- [ ] RED: prof semSID/vínculo/permissão e outros papéis não leem/descriptografam; paciente/tenant arbitrário não amplia escopo.
- [ ] GREEN: JWT/papel/permissão, contexto tenant, paciente/responsável ativos e fonte paginada100porlote; cutoff estável, timezone clínico canônico e fronteiras de datas.
- [ ] RED/GREEN: registro51 abre original correto; fonte ilegível/modificada torna cobertura parcial e evita falso fim.
**API proposta:** `POST /pacientes/:id/busca-prontuario`; `GET /pacientes/:id/busca-prontuario/fontes/:fonteId`.
**Aceite:** DTO/projeção explícitos, clínica fora de URLs/logs, sem ORM cru;
ler dados cifrados somente após autorização e novamente no retorno/original.

### T06 — ciclo do índice/engine, condicionado à medição

**Criar:** `octaclin-backend/src/modulos/pacientes/aplicacao/contexto-busca-prontuario.ts` e engine local/adaptador privado aprovado noADR.
**Consome:** fonte e snapshotT05; **produz:** ranking somente do paciente autorizado.
- [ ] ADR decide processamento efêmero ou derivado cifrado, conforme perfilCPU/RAM/build medido emT04.
- [ ] Não persistir vetor/tsvector/BM25 clínico em claro; não reutilizar coluna sentimental1536.
- [ ] Se imprescindível, nova migration numerada após conferir main, entidades/FKs/RLS/FORCE/versionamento/retenção e testes;1070/1071 inalteradas.
- [ ] RED/GREEN: fonte/modelo/corpus mudou, build falhou, paginação sem itens, replay de cursor e transferênciaA→B→A.
**Aceite:** sem mix de bases, rollback conserva fontes; nenhum worker administrativo
lê PHI só por possuir token interno; lifecycle/expurgo de derivado demonstrado.

### T07 — prova PostgreSQL/RLS/concorrência

**Criar:** `octaclin-backend/src/modulos/pacientes/aplicacao/busca-prontuario.integracao.spec.ts` e integração engine conformeADR aprovado.
- [ ] PostgreSQL real descartável, roleNOBYPASSRLS; criar fixtures sintéticas de dois tenants/carteiras/SIDs.
- [ ] Negar retornos de outro paciente/tenant, transferênciaA→B→A, revogação, fonte alterada e registro51+, inclusive páginas subsequentes/original.
- [ ] Testar concorrência de build/consulta/alteração/cancelamento; retorno revalida gerações e não é servido do cache antigo.
**Aceite:** zero vazamentos; conteúdo/capability/consulta/vetores ausentes de
logs/auditoria/respostas não autorizadas; todos os testes efetivamente executados.

### T08 — BFF e acesso ao original

**Criar:** `octaclin-web/lib/server/busca-prontuario-bff.ts`, BFFPOST do paciente e GET de fonte;
`octaclin-web/scripts/test-fase-319-bff.mjs` e spec. **Modificar:** `octaclin-web/package.json` só para registrar teste próprio se necessário.
- [ ] RED/GREEN: sessão/origem/permissão/role, campos extras/oversize/cursor inválido; nunca mandar consulta emGET/querystring.
- [ ] Projeção allowlist, stream limitado, erro sanitizado e `private,no-store`/VaryCookie.
- [ ] Rodar teste próprio e `pnpm test:authz`; não alterar os BFFslegados de forma ampla.
**Aceite:** vetor/chave/ciphertext/PHIextra eliminados em runtime, não só tiposTS.

### T09 — UI, acessibilidade e regressões

**Criar:** `octaclin-web/components/pacientes/busca-prontuario.tsx` e `octaclin-web/tests/visual/fase-319-busca.spec.mjs`.
**Modificar:** composição de `octaclin-web/components/pacientes/prontuario-paciente.tsx`, `octaclin-web/lib/prontuario-api.ts` apenas no necessário.
- [ ] RED/GREEN desktop/mobile: resultados+origem+data, original51+, coberturaparcial/status/erro, teclado/foco/axe.
- [ ] Limpar consulta/resultados ao trocar paciente/sessão/sair; revalidar foco e descartar retorno atrasado.
- [ ] Preservar evolução manual/templates, linha do tempo, fontes313/314 e funções318; nada no portal/cachepersistente.
**Aceite:** UI compreensível, sem confiança clínica/diagnóstico ou link que não abre fonte autorizada.

### T10 — integração R4 e entrega

- [ ] Testes unitários/integração/negativos, backendbuild/typecheck/fullsuite,
  Webauthz/build/lint, Playwright/axe e gatesHEAD.
- [ ] Revisão cruzada técnica R4 com autoria/limites, sem declarar ratificação clínica/jurídica inexistente.
- [ ] Atualizar status/plano/checklist/ADR/runbook/permissões/retenção; PRúnica de entrega técnica.
- [ ] Rollback/flag desativada por padrão; licença/privacy/infra e autorização operacional do alvo antes de piloto.
**Aceite:** gate por gate com PASS/FAIL/BLOCKED/SKIPPED; nunca merge/deploy/DDL externo nesta autorização de planejamento.

## Gates separados — estado de encerramento da pesquisa

| Gate | Estado | Condição de saída |
| --- | --- | --- |
| G00 — escopo/base documental | PASS | Decisões D01–D06, corpus/protocolo e limites da avaliação registrados; encerramento NO-GO documentado. |
| G01 — valor/relevância | BLOCKED (critério não atingido) | V4: E5 ganho NDCG 0,000; MiniLM −0,040; E5 regrede em q-021/data; corte sem resposta não avaliável sem regra de abstenção. Não há base para GO. A decisão desta fase é encerrar a pesquisa e não implementar os candidatos. |
| G02 — modelo/direitos/recursos | BLOCKED | Hashes e recursos foram medidos, mas a cadeia de direitos e autorização comercial dos pesos não foi comprovada. |
| G03 — privacidade/arquitetura | BLOCKED / não iniciado para produto | Não houve desenho aprovado, threat model nem revisão institucional para processamento de PHI ou derivados clínicos. |
| G04 — implementação/R4/CI | SKIPPED | Runtime, integração, RLS, CI de produto e revisão R4 não foram executados; T05–T10 não iniciadas. |
| G05 — operação/piloto | BLOCKED / não executado | Nenhum alvo ou piloto foi preparado/ativado; a prontidão operacional não foi avaliada e a decisão NO-GO impede avançar. |

## Modelos de desenvolvimento e sequência

GPT 6.1 Sol médio é indicado para planejamento e segurança/integração R4. GPT 6
Luna alto é suficiente para a PoC isolada T01–T04 já executada. Não recomendado
sozinho para T05–T10 (auth/cifra/RLS/índice/contexto). Antes da implementação
de produto, avisar e pausar para a troca manual para Sol médio.

Encerramento: pesquisa técnica concluída com NO-GO para busca semântica com E5
ou MiniLM. Os critérios de ganho e não regressão não foram atingidos, e os
critérios de consultas sem resposta não puderam ser pontuados sem uma política
de abstenção pré-especificada. Os artefatos v3/v4 e seus resultados ficam
preservados para rastreabilidade. A Fase 320 foi encerrada documentalmente em
NO-GO para ingestão TBCA nesta rodada (ver `PLANO_FASE_320.md`). Após o handoff,
uma camada compartilhada de
contexto clínico, busca textual estruturada e integração MCP com ChatGPT podem
ser avaliadas em planejamento próprio, com validações de produto, privacidade
e segurança e autorização explícita.

## Autorrevisão e evidência documental

Confrontados D01–D06, 12 gaps, tarefas/interfaces e cinco modos de falha do Review
Focus. PoCs v3/v4 não alteram runtime. A auditoria dos casos foi arquivada; a
identidade/qualificação do auditor não foi verificada e os cinco novos textos
negativos v4 não têm revisão independente registrada. Não houve ensaio humano de
tempo, revisão independente de código/modelo, revisão R4 de produto ou aprovação
jurídica/comercial.

Executados nas rodadas registradas: inspeção Git/rg/documentos; consultas de
metadata/config/cards e downloads ONNX/tokenizers fixados/hashados em `/tmp`;
validação estática dos grafos; dez testes da base v3 e quatro testes da v4;
benchmarks sintéticos v3/v4 e medida de escala E5. Nesta rodada de encerramento,
somente conferência documental e `git diff --check`; não foram executados testes
de runtime, banco, RLS, CI ou dados reais. O container não prova capacidade de
produção; licença declarada não prova direitos comerciais.
