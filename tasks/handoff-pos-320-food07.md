# FOOD07 — handoff de planejamento

## Branch/base

`docs/pos320-food07-planning`, worktree `/workspace/octaclin/.worktrees/pos320-food07-planning`, base origin/main `2f24fcb178ff6cbd4623a233a665cce1416bfd9f`, fetch28/10/2026. Uma branch independente de446; nenhuma alteração na worktree FOOD05. Não usar aquela branch como base.

## Objetivo e autorização

Planejar FOOD07 com Sol6.1 alto, apenas gaps residuais da biblioteca310. Nenhuma implementação autorizada ainda. Q1 campos/filtros e Q3 tags internas+rendimento/tempo nos novos envios foram aprovadas. Q2 foi ampliada pelo proprietário para **ajustar quantidades por rendimento**. S1–S3 respondidas: cadastro tanto da receita inteira como por porção, frações com prévia e envio porcionado ao portal aprovados. Nenhuma pergunta funcional restante identificada; apresentar plano consolidado antes da implementação. Pelo escopo ampliado de bases/snapshots/idempotência, recomendar Sol6.1 médio para integração e Luna alto apenas para tarefas delimitadas com interfaces fechadas; avisar e pausar **antes** da troca manual, conforme fluxo do proprietário.

## Concluído

- Auditoria dos contratos reais; receitas atuais já cobrem categorias/itens/instruções, versões e envios imutáveis.
- Tags/rendimento/tempo ausentes e UI primeira página100 confirmados estaticamente.
- Plano T01–T07 com interfaces, limites, omissão/limpeza, migração candidata1080 e gates; checklist e referências.
- Licenças Tandoor AGPL+Commons Clause e OpenNutriTracker GPLv3 conferidas em arquivos, blobs registrados; nenhuma cópia/dependência.

## Pontos críticos

- Portal atual retorna snapshot JSON completo. Tags novas internas exigem allowlist server-side tanto ao criar snapshot quanto ao retornar ao portal; ocultar JSX não é suficiente.
- Não decifrar todo o acervo para filtrar; HMAC por tenant e SQL antes de count/offset. Novo POST consulta evita etiquetas em URL; GET legado mantém contrato.
- Metadados no ciphertext; writer antigo sem novos campos deve preservar por omissão; null/[] só para remoção explícita definida no plano.
- Novo porcionamento exige base/rendimento explícitos, razão exata e prévia/confirmar server-side; somente após autorização de implementação; S1–S3 já foram aprovadas. Não inferir base de receitas antigas; tempo/instruções e concentrações por100g não são escalados. Não exportar contexto FOOD05 por receita/modelo.
- Share novo deve comparar comando completo incluindo porções e congelar resultado no snapshot cifrado; legado sem hash não aceita virar porcionado por replay. Backend de portal usa allowlist; worker agendado não recalcula.
- Preservar selecionadas/versão ao paginar e evitar respostas antigas em troca de paciente/filtro; testar assincronismo.
- Sem nova política de papéis/admin: receitas310 e gruposFOOD04 têm contratos distintos.
- Número de migration/reconciliação de1079/446 deve ser conferido antes de escrever; nenhuma migration criada.

## Validações

Análise de código/referências e base: executadas. Links locais, diff check e scanner local de segredos PASS; scanner em Node24/pnpm11.19 fora do intervalo do projeto, sem alteração versionada de dependências. O pnpm inicializou automaticamente seu ambiente ao chamar o script (Already up to date). Testes de implementação/baseline, builds, PostgreSQL, Playwright, CI/scanners/R4: NOT RUN, pois autorização atual é planejamento. Não instalar dependências na worktree documental nem ligar symlink para outro checkout; executor observado com pouco espaço. Não excluir artefatos para contornar infraestrutura. Planejar CI equivalente se local não suportar prova.

## Próxima ação

Plano com S1–S3 consolidado: revisar sua cobertura e obter autorização de implementação. Não implementar automaticamente pela resposta às perguntas. Reconfirmar base e estado do Git antes de qualquer execução. Sem merge/deploy/DDL externo/infra/cobrança; G06 segue separado. Documentos em `tasks/plan-pos-320-food07.md`, `todo-pos-320-food07.md`, `referencias-pos-320-food07.md` e este handoff. Manter PR futura individual Draft.
