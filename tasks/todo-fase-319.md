# Checklist Fase 319

Pesquisa encerrada em NO-GO. Consultar [plano canônico](../docs/history/phases/PLANO_FASE_319.md)
para evidência e limites. Nenhuma tarefa abaixo autoriza implementação ou nova
PoC; T05–T10 não foram iniciadas.

| Tarefa | Dependências | Critério objetivo | Estado |
| --- | --- | --- | --- |
| T00 — decisões/gaps/documentos | Main/código/roadmap | D01–D06 registradas; 12 gaps evidenciados | PASS — docs e base conferidos |
| T01 — corpus/oráculo | Autorização PoC,T00 | 40 consultas, 10 dev/30 teste, hash antes de resultados | PARCIAL — v3 preservado; v4 corrige 7 consultas e 5 fontes sem resposta; revisão independente dos textos neutros e do auditor não comprovadas |
| T02 — licença/engine/CPU | Autorização PoC,T00 | Licença/procedência/hash/dimensões; CPU/RAM medidos | PARCIAL/BLOCKED — ONNX/config/hashes e recursos medidos; LICENSE 404, cadeia de direitos pendente |
| T03 — comparadores/métricas/TDD | T01,T02 | Baseline textual e semântico; Recall/NDCG; fonte >50 | PASS técnico exploratório — 10 testes base + 4 de integridade v4; nenhum teste de runtime |
| T04 — ensaio/decisão | T03 | Cortes congelados e decisão fundamentada | CONCLUÍDA COM NO-GO — E5 ganho NDCG 0,000 e regressão q-021/data; MiniLM −0,040; critério sem resposta não avaliável sem abstenção; sem estudo humano de tempo |
| T05 — DTO/API/fontes completas | GO,T04,autorização produto | Prof/SID/paciente atual, corpuspaginado100, original51+ | BLOCKED |
| T06 — lifecycle/engine/índice | T05 e decisão medidaADR | Sem PHI/vetor em claro; versões/cursor15min/retenção/rollback | BLOCKED |
| T07 — PG/RLS/concorrência | T05,T06 | RoleNOBYPASSRLS; isolamento/contexto/revogações comprovados em BD descartável | BLOCKED |
| T08 — BFF/projeção | T05,T06 | POST fechado/no-store/origin/permissão; original autorizado; authzPASS | BLOCKED |
| T09 — UI/axe/legado | T08 | Desktop/mobile, teclado, fontes/cobertura; sessão/paciente e respostas atrasadas | BLOCKED |
| T10 — R4/CI/PR/rollout | T07–T09 | GatesHEAD, revisão e rollback; piloto ainda desligado até autorização operacional | BLOCKED |

## Checkpoints

- [x] D01: um paciente por vez.
- [x] D02: evoluções/anotações autorizadas.
- [x] D03: trechos e original, sem resposta gerada.
- [x] D04: local em CPU/sintético/sem chamadas pagas.
- [x] D05: responsável atual, leitura legada preservada.
- [x] D06: histórico completo autorizado, parcial explicitamente informado.
- [x] PoC local sintética autorizada e executada; hash e resultados registrados.
- [x] Auditoria recebida dos 30 casos arquivada; v3 preservado e corpus v4 executado com cortes congelados.
- [ ] Revisão independente dos cinco textos neutros v4 e operacionalização da métrica de abstinência (não bloqueiam o encerramento NO-GO; seriam necessários para qualquer reavaliação futura).
- [ ] G01 — valor aprovado por evidência, não por intenção.
- [ ] G02 — licença/artifacts/dependências/capacidade conferidos.
- [ ] G03 — privacidade/ADR de derivado e fluxo institucional.
- [ ] G04 — implementação, autorização/RLS/concorrência/R4/CI.
- [ ] G05 — operação/ambiente/role/alvo/ativação específica (BLOCKED/não executado; nenhum piloto preparado/ativado).

## Validação desta rodada

Executados apenas scripts de pesquisa isolados em `/tmp` e dados sintéticos. Sem
runtime OctaClin, pacientes, banco externo, migration ou configuração de produto.
Direitos, relevância humana e tempo de tarefa continuam pendentes. A Fase 320
foi encerrada documentalmente em NO-GO para TBCA nesta rodada; possibilidades de contexto clínico compartilhado,
busca textual estruturada e MCP com ChatGPT dependem de planejamento próprio
após a Fase 320 e autorização explícita.
