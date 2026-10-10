# Handoff de planejamento — Fase 314

## Objetivo e estado

Planejar antropometria pediátrica com quatro indicadores, gráfico no console
e prematuros INTERGROWTH → OMS com idade corrigida. **Somente planejamento**;
não existe implementação da 314, PR de entrega nem autorização de deploy.

Branch: `docs/fase-314-planejamento`; base `origin/main` `f8c5ab66` (PR #391).
Worktree: `/workspace/octaclin/.worktrees/docs-fase-314-planejamento`.
Plano: [PLANO_FASE_314.md](../docs/history/phases/PLANO_FASE_314.md).
Ficha: [FICHA_VALIDACAO_CLINICA_FASE_314.md](../docs/product/FICHA_VALIDACAO_CLINICA_FASE_314.md).
Fontes: [FONTES_ANTROPOMETRIA_FASE_314.md](../docs/product/FONTES_ANTROPOMETRIA_FASE_314.md).
Execução futura: [todo-fase-314.md](todo-fase-314.md).

O handoff 313 em `plan.md` contém gates operacionais/revisão ainda pendentes.
Este rascunho separado preserva todos eles; definir a promoção para `plan.md`
após fechar as perguntas, preservando o original no histórico.

## Concluído

- [x] Conferir merge #391/CI pós-merge; não inferir aplicação da 1068.
- [x] Inventariar cálculo/DTO/snapshot/UI/consumidores/portal e gaps.
- [x] Obter/inspecionar fontes oficiais públicas e hashes; runtime offline.
- [x] Registrar decisões recebidas e propostas técnicas verificáveis.
- [x] Preparar arquitetura, tarefas pequenas, matriz de provas e rollback.
- [x] Links locais, `git diff --check` e `pnpm security:secrets` PASS.

## Pendente

- [x] Registrar etapa INTERGROWTH sem SISVAN, elegibilidade definida pela equipe
  e proposta para revisão de transição após 64s0d.
- [ ] Consolidar duração/base da idade corrigida e elegibilidade detalhada.
- [ ] Fechar métodos mensais/caudas/flags e referência computacional neonatal
  suficiente: não interpolar escores a partir de tabelas arredondadas.
- [ ] Ratificação clínica da ficha consolidada, incluindo política 18–19.
- [ ] Autorização de implementação e de seu escopo de testes.
- [ ] Conferência operacional externa da 1068 antes de liberar a aplicação;
  ausência de confirmação continua SKIPPED, sem executar neste planejamento.

## Próxima ação exata

Incorporar as respostas pendentes à ficha e ao plano; fechar G01 e enviar a
ficha consolidada para revisão clínica. Não começar o classificador enquanto
G01/G02 não estiverem ratificados. Se falta fonte/coeficiente, registrar esse
item explicitamente, sem fabricar algoritmo neonatal.

## Modelos

GPT-6.1 Sol médio para algoritmo/persistência/integração; Luna alto pode assumir
as telas quando o contrato estiver fechado. A troca é manual: avisar e pausar.
O mesmo modelo atual dá conta do planejamento e do núcleo da implementação.

## Limites das evidências

Downloads/inspeção documental não são ratificação clínica. Testes da 314 não
executados, sem código implementado. Nenhum PHI/PII real enviado a fontes,
GitHub ou providers; somente dados públicos e fixtures futuras sintéticas.
Não fechar revisão independente/saúde de produção pelo CI da fase anterior.
