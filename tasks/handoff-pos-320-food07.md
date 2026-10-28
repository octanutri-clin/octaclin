# FOOD07 — handoff: decisões UX integradas, execução autorizada

## Branch/base

`docs/pos320-food07-planning`, worktree `/workspace/octaclin/.worktrees/pos320-food07-planning`, base origin/main `2f24fcb178ff6cbd4623a233a665cce1416bfd9f`, fetch28/10/2026. Uma branch independente de446; nenhuma alteração na worktree FOOD05. Não usar aquela branch como base.

## Objetivo e autorização

Implementar FOOD07 após integrar decisões aprovadas na mensagem “Aprovação das sugestões UX da FOOD07 e continuidade da PR #451”, em 28/10/2026. Q1–Q3/S1–S3 preservadas; NUX-01–05 e PUX-01–05 enumerados aprovados, NUX-06 mantém a política 310, PUX-06 BACKLOG. Ver [matriz de aceite](aceite-pos-320-food07.md). Restrição anterior de somente planejamento superada por autorização expressa; sem merge, deploy, migrations externas, mudanças de Render/Neon ou FOOD05-MDL. Manter configuração atual; avisar e pausar antes de troca manual. Não é necessário novo aceite para executar detalhes de engenharia já autorizados.

## Concluído

- Auditoria dos contratos reais; receitas atuais já cobrem categorias/itens/instruções, versões e envios imutáveis.
- Tags/rendimento/tempo ausentes e UI primeira página100 confirmados estaticamente.
- Plano T01–T07 com interfaces, limites, omissão/limpeza, migração candidata1080 e gates; checklist e referências.
- Licenças Tandoor AGPL+Commons Clause e OpenNutriTracker GPLv3 conferidas em arquivos, blobs registrados; nenhuma cópia/dependência.
- Aprovações UX integradas a plano/checklist/matriz; instruções específicas por envio, hash semântico e conferência explícita por receita porcionada definidos antes de mudar runtime.
- Papéis/procedimento e histórico #451 referenciados no commit 0d3382b6, sem importar configuração. Reexecutar personas em B e C; seleção nativa permanece NÃO COMPROVADA, ponte com papel explícito permitida.

## Pontos críticos

- Portal atual retorna snapshot JSON completo. Tags novas internas exigem allowlist server-side tanto ao criar snapshot quanto ao retornar ao portal; ocultar JSX não é suficiente.
- Não decifrar todo o acervo para filtrar; HMAC por tenant e SQL antes de count/offset. Novo POST consulta evita etiquetas em URL; GET legado mantém contrato.
- Metadados no ciphertext; writer antigo sem novos campos deve preservar por omissão; null/[] só para remoção explícita definida no plano.
- Novo porcionamento exige base/rendimento explícitos, razão exata e prévia/confirmar server-side; execução agora autorizada. Não inferir base de receitas antigas; tempo/instruções e concentrações por100g não são escalados. Profissional pode adaptar instruções só na cópia enviada, com conferência por item obrigatória no backend, texto cifrado e incluído na identidade idempotente. Não exportar contexto FOOD05 por receita/modelo.
- Share novo deve comparar comando completo incluindo porções e congelar resultado no snapshot cifrado; legado sem hash não aceita virar porcionado por replay. Backend de portal usa allowlist; worker agendado não recalcula.
- Preservar selecionadas/versão ao paginar e evitar respostas antigas em troca de paciente/filtro; testar assincronismo.
- Sem nova política de papéis/admin: receitas310 e gruposFOOD04 têm contratos distintos.
- Número de migration/reconciliação de1079/446 deve ser conferido antes de escrever; nenhuma migration criada.
- Reenvio imediato substitui cópia ativa da mesma receita/paciente; agendado só na ativação. Resposta inacessível usa 404 genérico, sem revelar estado de recurso alheio.
- DTO manual atual exige quatro indicadores quando composição é informada; resumo parcial de prévia não autoriza enfraquecer esse contrato. Detecção universal de contradições em linguagem livre é inviável: usar conferência profissional explícita, não promessa de regex infalível.

## Validações

Checkpoint atual T01: código `bdb816f8`, [registro completo](execucao-pos-320-food07.md). 270 testes próprios PASS, suíte completa backend 3.514 PASS/142 skipped, Node22.23.4/pnpm11.25.0, typecheck/build PASS. RED funcional observado e oráculo Python independente reproduzido. T01 concluída localmente; CI/R4 final/UX B/C não concluídos. DTOs ainda não conectados a endpoints para não aceitar sem persistir; T02 deve fazer a conexão atômica. Helpers públicos não significam que as respostas HTTP já os utilizem.

Histórico documental até ea2bd1d5, substituído quanto à execução por T01 acima: análise de código/referências e integração das decisões; links/diff/scanner local PASS com Node24/pnpm11.19. Implementação/baseline/builds/banco/Playwright/CI/R4 ainda não executados naquele checkpoint. Não ligar symlink de outra worktree por conveniência. Não confundir CI #451 com teste FOOD07; falha Mobile segue separada, sem supressão para aprovar agentes.

## Próxima ação

Continuar T02 após conferir estado preservado da PR Draft #452. Usar Node/pnpm isolados em `/tmp/octaclin-food07-tools`, dependências frozen instaladas nesta worktree. Não refazer T01. Ler registro de execução, fechar writer/reader/DTO na mesma mudança e escrever RED de persistência/omissão/CAS/índice antes de implementar. Numeração candidata1080 deve ser revalidada antes de schema; provas mutáveis somente descartáveis. Correção Mobile em worktree/branch separadas, sem misturar arquivos. Papéis via `git show 0d3382b6:<path>` conforme plano; #446/G06 preservados. Sem merge/deploy/DDL externo/infra/cobrança.
