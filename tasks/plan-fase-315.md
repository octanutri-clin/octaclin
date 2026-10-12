# Handoff — Fase 315: retirada compatível do score legado

Autorização de desenvolvimento recebida (“Pode seguir”). Implementação local
concluída e validada; PR Draft a preparar. Branch `feature/fase-315-score-risco`,
worktree `/workspace/octaclin/.worktrees/docs-fase-315-planejamento`, base
`c77c4520` (PR #394 já integrada).
Alteração preexistente `octaclin-web/next-env.d.ts` na checkout principal
preservada. Handoffs/checklists anteriores não sobrescritos.

- [Contrato, decisões, gaps e rollback](../docs/history/phases/PLANO_FASE_315.md).
- [Inventário de arquivos e linhas](../docs/product/INVENTARIO_SCORE_RISCO_FASE_315.md).
- [Tarefas executáveis](todo-fase-315.md).

## Estado e próxima ação exata

D01 confirmada: PATCH legado validado sem gravar; retirar das respostas e CSV;
coluna/histórico preservados. T01–T05 concluídas; T06 concluída quanto à prova
RLS descartável, mas `test:authz` ficou parcial/cancelada; T07 parcial, T08 em
andamento. Próxima ação: scanner de segredos/diff final, commit da
implementação e abertura de uma PR Draft; acompanhar CI.

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

PASS: base Git/PR394 MERGED; backend completo (2652 testes, 54 ignorados; três
suítes ignoradas) e foco atualizado 98/98; backend/Web typecheck e builds,
lint Web sem erros (65 avisos do repositório), RLS em PostgreSQL descartável
31/31, smoke BFF local e
Playwright focado. `test:authz` PARCIAL/CANCELADO manualmente após execução
prolongada; grupos pertinentes já executados passaram, mas isso não substitui
a suíte completa. Um teste Playwright de timeout passou isoladamente.
CI da PR pendente; R4 independente SKIPPED.

FAIL observado na base: monitor produção `38183397104`, saúde externa; causa
não investigada, sem relação estabelecida com esta mudança. SBOM provenance da
base SKIPPED. Não houve consulta a bancos externos, migration, merge ou deploy.

## Modelo

GPT-6.1 Sol médio usado para contratos e execução. Nenhuma troca de modelo
foi feita nesta etapa.
