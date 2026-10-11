# Handoff — Fase 315: planejamento e gaps

Autorização atual: planejar/analisar gaps. Implementação não iniciada.
Branch `docs/fase-315-planejamento`, worktree
`/workspace/octaclin/.worktrees/docs-fase-315-planejamento`, base `c77c4520`.
Alteração preexistente `octaclin-web/next-env.d.ts` na checkout principal
preservada. Handoffs/checklists anteriores não sobrescritos.

- [Contrato, decisões, gaps e rollback](../docs/history/phases/PLANO_FASE_315.md).
- [Inventário de arquivos e linhas](../docs/product/INVENTARIO_SCORE_RISCO_FASE_315.md).
- [Tarefas executáveis](todo-fase-315.md).

## Próxima ação exata

D01 confirmada: PATCH legado validado sem gravar; retirar das respostas e CSV;
coluna/histórico preservados. Próxima etapa: implementar T01 após autorização
expressa de desenvolvimento da Fase 315. Planejamento solicitado concluído.

Não substituir `tasks/plan.md` ou `tasks/todo.md`: contêm handoff anterior e
pendências históricas. Nesta rodada o alvo é o par por fase já usado no projeto.
Caso se deseje promovê-lo a handoff corrente, preservar conteúdo antigo antes.

## Atenção para o executor

No caminho preferencial, scoreRisco fica só no DTO PATCH depreciado validado,
sem escrita e sem saída. ORM/schema e valores antigos ficam. Fixtures ORM
históricas não são fixtures de resposta. Demo espalha `body`: excluir legado
da atribuição, além de omitir na resposta. Não mudar pipe global para aceitar
campos desconhecidos. Autorizar mesmo um pedido só legado.

Não alterar `statusAdesao: risco`, filtro salvo `risco`, gatilho `risco_alto`,
override, fórmulas, `scoreCalculado` ou `frustracaoScore`. API pública e portal
continuam sem score legado; pública também sem prioridade operacional.

## Verificações

PASS: base Git/PR394 MERGED, CI base pós-merge SUCCESS; leitura e inventário.
SKIPPED: testes de implementação, PG, builds e CI315; não houve código.
FAIL observado: monitor produção `38183397104`, saúde externa; não atribuir
à 314/315 nem declarar produção saudável. SBOM provenance da base SKIPPED.
PASS: `git diff --check`, `node scripts/scan-secrets.mjs` (padrões locais),
verificação documental dos links locais, dez gaps, T00–T08 e linhas do roadmap.
Primeira tentativa de inventário via subprocesso rg sem path retornou exit 1;
reexecutada com path explícito `.` com sucesso. Sem inferir testes runtime.

## Modelo

Sol 6.1 médio suficiente para contratos e execução inteira; Luna alto suficiente
para tarefas delimitadas após D01. Avisar modelo pretendido e pausar antes
de troca manual. Nenhuma troca feita, nenhuma implementação autorizada aqui.
