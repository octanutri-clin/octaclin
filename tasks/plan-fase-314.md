# Handoff de planejamento — Fase 314

Consolidado rev2 em 2026-10-10; revisão técnica dos quatro anexos externos.
Somente documentação autorizada. Ficha continua NÃO RATIFICADA.

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
Este handoff separado preserva todos eles; não sobrescrever `plan.md` da 313.
Promover somente após decisão de execução, mantendo seu histórico e links.

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

Encaminhar a ficha rev2 com matriz CL-01–CL-10 à equipe para respostas explícitas,
especialmente idade/correção/elegibilidade/18–19; resolver dados e direitos G01.
Depois registrar ratificação G02 e obter autorização G03. **T03–T18 bloqueadas**.
Não considerar anexos recebidos aprovação clínica nem autorização de código.

## Revisão rev2: fatos e gates

- [Relatório completo e divergências](../docs/history/phases/REVISAO_PLANEJAMENTO_FASE_314.md).
- Base inicial limpa, commit `3df581c5`; PR391/CI final/pós-merge reconfirmados.
- PASS:16 XLSX locais/14.338 linhas/hash/aba/LMS, seis PDFs INTERGROWTH
  baixados novamente/hashes iguais. Re-download OMS CDN bloqueado403.
- Fonte OMS oficial consultada: interpolação de L/M/S, âncoras 60/229/121,
  diferença de grade/idade aplicável, precisão e flags. Dois exemplos
  sintéticos comparados matematicamente; não são testes do OctaClin.
- Termos MS limitam reprodução comercial de obras; pacotes OMS declaram GPL.
  Avaliar forma concreta de incorporação, sem presumir licença irrestrita.
- Papéis atuais preservados; leitura por lotes examinados cifrados/cursorSQL;
  1068 protege UPDATE com exceções, não prova DELETE. PG/revisão futura exigidos.
- Implementação/DB/merge/deploy não realizados. Documentos 312/313 e runtime
  permanecem sem alteração; anexos preservados byte a byte, histórico via Git.

| Gate | Estado | Próximo requisito |
| --- | --- | --- |
| G00 | BLOCKED, partes PASS | Direitos/artefatos e prova operacional1068 externa futura |
| G01 | BLOCKED | Modelo neonatal diário/oráculo/termos e fechamento computacional OMS |
| G02 | BLOCKED | CL01–10 ratificadas para versão/hash da ficha |
| G03 | BLOCKED | Autorização expressa de implementação e escopo de testes |
| G04 | SKIPPED | Implementação e provas futuras positivas/negativas/PG/consumidores |
| G05 | BLOCKED | RevisãoR4/CI314 final e ambiente/1068; autorizações operacionais separadas |

A tabela completa/evidências está na seção10 do plano. Prova de ambiente não
é inferida do merge313. T01/T02 avançam apenas como documentação nesta sessão.
Ordem futura e subfatias T16-A/B/C preservadas em `todo-fase-314.md`.

## Verificações documentais finais

- PASS: `git diff --check`, links locais/anchors e colunas de tabelas Markdown.
- PASS: CL-01–CL-10 presentes, IDs T01–T18 preservados e anexos byte a byte.
- PASS: `pnpm security:secrets`, nenhum segredo real identificado. Node24/pnpm11
  geraram aviso de versão; futuro software/CI deve usar runtime declarado.
- SKIPPED: testes de implementação, builds/PG/authz/Playwright; nenhum runtime,
  migration, staging/produção, merge/deploy autorizado ou executado.


## Modelos

GPT-6.1 Sol médio para algoritmo/persistência/integração; Luna alto pode assumir
as telas quando o contrato estiver fechado. A troca é manual: avisar e pausar.
O mesmo modelo atual dá conta do planejamento e do núcleo da implementação.

## Limites das evidências

Downloads/inspeção documental não são ratificação clínica. Testes da 314 não
executados, sem código implementado. Nenhum PHI/PII real enviado a fontes,
GitHub ou providers; somente dados públicos e fixtures futuras sintéticas.
Não fechar revisão independente/saúde de produção pelo CI da fase anterior.
