# FOOD07 — handoff: T01–T05, interface seguinte

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

Checkpoint atual T04, código `f45d5132`: envio porcionado com texto próprio, contexto/hash cifrados e projeções validadas implementados. **3.620 PASS/161 skipped**, typecheck/build PASS;48/48 serviço e19/19 PostgreSQL descartável. A fixture agora executa1066 real (FK/RLS/trigger) junto de1033/1080, mantendo parent tables sintéticas e catálogo SELECT-only. Transferência, consentimento, CAS/versão, lotes recíprocos, replay, legado, rollback tardio e worker agendado comprovados. Uma falha adicional de retirada durante transferência foi reproduzida e corrigida; não ampliar grants/papéis. R4 integral/T05–T07/UX B/C ainda pendentes. Não confundir parecer específico T03 com revisão deste writer. [Registro completo](execucao-pos-320-food07.md).

CI anteriorff6cde0e/run40784685792: Backend/Web/Demo/AI/governança/operação/rollout/scanners PASS; Mobile audit e PR Gate FAIL. Não comprova delta T04. Fonte main continua2f24fcb1, sem encadeamento em446. Tags/contexto nunca saem ao paciente; novos leitores devem preceder novos writers na futura liberação G06. Não recalcular replay pela biblioteca viva.

Histórico documental até ea2bd1d5, substituído quanto à execução por T01 acima: análise de código/referências e integração das decisões; links/diff/scanner local PASS com Node24/pnpm11.19. Implementação/baseline/builds/banco/Playwright/CI/R4 ainda não executados naquele checkpoint. Não ligar symlink de outra worktree por conveniência. Não confundir CI #451 com teste FOOD07; falha Mobile segue separada, sem supressão para aprovar agentes.

## Próxima ação

Conferir branch/HEAD/diff e CI da PR Draft #452; T05 BFF concluída localmente; continuar T06 (UI/portal/UX B) e T07 (regressões/UX C/R4 integral/CI). Usar o contrato de `snapshot-compartilhamento-receita.ts` e a prévia realT03. Não refazer T01–T04 nem mexer #451/#446/#453 para esconder auditoria.

Ferramentas temporárias anteriores desapareceram na retomada: Node22.21.1 persistente em `/workspace/.toolchains/food01`, pnpm11.25.0 verificado em `/tmp/octaclin-food07-tools/bin`. Backend node_modules preservado; Web instalada frozen/offline com hardlinks do store, sem alterações em dependências/lockfile. Espaço ~237MB; store pnpm contém hardlinks reutilizáveis, conferir orçamento antes de instalação frozen necessária, sem symlink entre worktrees/alteração de políticas ou apagar trabalho alheio. Docker PG15 cached/socket local, Timescale local indisponível; CI anterior executou gates oficiais. G06 BLOCKED. Sem FOOD05-MDL/FOOD08, merge/deploy/DDL externo/infra/cobrança.

## Retomada T05 —29/10/2026

BFFs consulta/prévia/share com sessão compartilhada, limites, projeções explícitas e private/no-store; clientes POST/body com AbortSignal. RED3 falhas funcionais, GREEN70/70; suíte Web autorização332/332 em26 scripts, zero skipped/falhas, exit0; typecheck PASS. Lint zero erros/70 avisos fora dos arquivos alterados. Orçamento de request do lote512KiB, confirmado com10 instruções válidas de4000 caracteres suplementares inclusive JSON escapado (256KiB rejeitava caso válido). Build local/CI do delta não comprovados ainda. Espaço ~220MB; navegadores Playwright cached. Próximo passo: T06 testes funcionais de interface reais desktop/mobile antes do código, metadados/prévia/lote/portal e personas B. Não usar CI T04 como aprovação T05.
