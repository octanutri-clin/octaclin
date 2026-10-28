# FOOD07 — handoff: T01–T03, compartilhamento porcionado seguinte

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
- Migration1080 criada/registrada, aplicada apenas no PostgreSQL15 descartável `food07_test`; não importa1079/446. Reconciliar composição e sequência antes de qualquer operação futura.
- Reenvio imediato substitui cópia ativa da mesma receita/paciente; agendado só na ativação. Resposta inacessível usa 404 genérico, sem revelar estado de recurso alheio.
- DTO manual atual exige quatro indicadores quando composição é informada; resumo parcial de prévia não autoriza enfraquecer esse contrato. Detecção universal de contradições em linguagem livre é inviável: usar conferência profissional explícita, não promessa de regex infalível.

## Validações

Checkpoint atual T03: T01 `bdb816f8`; T02 `dc9620c0`/docs4c5a8fc9; T03 código `5e20b279`, commitado, CI próprio ainda em acompanhamento. Ver [registro completo](execucao-pos-320-food07.md). T03 suíte completa3.577 PASS/150 skipped,398/398 focados e PostgreSQL8/8 PASS, typecheck/build PASS. Revisor independente encontrou P1 locks em catálogo somente SELECT e P2 arredondamento divergente; ambos reproduzidos RED e corrigidos, re-revisão437 testes favorável, não é R4 integral. Usar JOIN bulk/statement único e revalidar fonte/versão/fingerprint na confirmação T04; não ampliar grants. Metadados continuam cifrados, campos null antigos normalizados só em memória. CI T02 Backend: principal3.640 PASS/52 skipped, Redis2, RLS109/109,1080 somente PostgreSQL de CI. Esse CI não aprova o delta T03 ainda não comprovado no novo CI. Mobile audit FAIL, Web/scanners PASS; smoke em acompanhamento. UX B/C e R4 final ainda NOT RUN. Gate amplo Timescale continua indisponível localmente, apesar de comprovado no CI T02.

Histórico documental até ea2bd1d5, substituído quanto à execução por T01 acima: análise de código/referências e integração das decisões; links/diff/scanner local PASS com Node24/pnpm11.19. Implementação/baseline/builds/banco/Playwright/CI/R4 ainda não executados naquele checkpoint. Não ligar symlink de outra worktree por conveniência. Não confundir CI #451 com teste FOOD07; falha Mobile segue separada, sem supressão para aprovar agentes.

## Próxima ação

Conferir branch/HEAD/diff e CI da PR Draft #452. Continuar T04 — compartilhamento porcionado conforme plano, depois de conferir commit/CI T03, sem refazer T01–T03. Validar instruções específicas, confirmação de conferência, hash semântico/replay, lote/rollback/agendamento, fontes/carteira e locks ordenados. Nenhuma escrita de T04 foi antecipada além da projeção mínima documentada em T02. Node22/pnpm exatos em `/tmp/octaclin-food07-tools/bin`, instalação frozen própria; nunca symlink de outra worktree. Docker local funciona com socket unix, sem contexto/TLS remotos; imagem PostgreSQL15 disponível, Timescale indisponível (não substituir para mascarar gate). Espaço local ~237MB livres: não instalar dependências/imagens sem orçamento, nem apagar artefatos alheios. Correção Mobile na PR Draft #453, audit FAIL apesar de patch/testes direcionados aprovados; não importar para #452/#451. Papéis UX por referência #451/0d3382b6 para B/C quando existir UI real. #446/G06 preservados. Sem FOOD05-MDL/FOOD08, merge/deploy/DDL externo/infra/cobrança.
