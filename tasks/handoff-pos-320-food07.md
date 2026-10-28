# FOOD07 — handoff: T01/T02 locais, integração seguinte autorizada

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

Checkpoint atual T02: código `dc9620c0`, suíte completa **3.544 PASS/148 skipped**, typecheck/build PASS. T01 código `bdb816f8`, persistência cifrada/HMAC/consulta/CAS/1080 e projeção mínima segura implementadas; ver [registro completo](execucao-pos-320-food07.md). PostgreSQL descartável com role runtime não owner/NOBYPASSRLS, FORCE RLS, paginação101+, concorrência controlada e rollback: **6/6 PASS** após a correção de legado. Revisor independente T02 encontrou P2 de opcionais null aceitos no contrato antigo; corrigido com RED/GREEN sem escrever ciphertext nas leituras. Não é R4 integral. CI do código T01/HEAD ce6ec296: Backend/Web/Demo/scanners PASS, Mobile/PR Gate FAIL. Novo delta exige CI próprio. Personas B/C e T03–T07 ainda pendentes, exceto allowlist mínima de T04 antecipada por segurança do writer. Gate amplo local RLS: FOOD04/FOOD07 10 PASS, 99 casos bloqueados no setup pela imagem Timescale ausente; não são 99 regressões funcionais nem aprovação de RLS integral.

Histórico documental até ea2bd1d5, substituído quanto à execução por T01 acima: análise de código/referências e integração das decisões; links/diff/scanner local PASS com Node24/pnpm11.19. Implementação/baseline/builds/banco/Playwright/CI/R4 ainda não executados naquele checkpoint. Não ligar symlink de outra worktree por conveniência. Não confundir CI #451 com teste FOOD07; falha Mobile segue separada, sem supressão para aprovar agentes.

## Próxima ação

Conferir branch/HEAD/diff e CI da PR Draft #452. Continuar T03 — prévia autorizada de porcionamento conforme plano, sem refazer T01/T02. Node22/pnpm exatos em `/tmp/octaclin-food07-tools/bin`, instalação frozen própria; nunca symlink de outra worktree. Docker local funciona com socket unix, sem contexto/TLS remotos; imagem PostgreSQL15 disponível, Timescale indisponível (não substituir para mascarar gate). Espaço local ~237MB livres: não instalar dependências/imagens sem orçamento, nem apagar artefatos alheios. Correção Mobile na PR Draft #453, audit FAIL apesar de patch/testes direcionados aprovados; não importar para #452/#451. Papéis UX por referência #451/0d3382b6 para B/C quando existir UI real. #446/G06 preservados. Sem FOOD05-MDL/FOOD08, merge/deploy/DDL externo/infra/cobrança.
