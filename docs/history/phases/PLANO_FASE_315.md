# Fase 315 — retirada controlada de score_risco

## Escopo e evidência

Planejamento autorizado pelo proprietário em 2026-10-11. Base consultada:
`origin/main` em `c77c45204fb67a8ca64287052690b99ad20e8314`, PR #394
MERGED, conferida no GitHub neste ciclo. Branch `docs/fase-315-planejamento`.
Nenhuma implementação, migration ou alteração de ambiente nesta etapa.
Risco documental R0; execução prevista R4 por contrato de paciente e projeção
de dados, apesar de não propor DDL nem mudança de autorização.

Fontes: roadmap 302–320, `PLANO_FASE_300.md`, código de pacientes, integrações,
portal, projeção de prioridade, DTOs, pipe HTTP e fixtures. Inventário detalhado:
[INVENTARIO_SCORE_RISCO_FASE_315.md](../../product/INVENTARIO_SCORE_RISCO_FASE_315.md).
Sequência de implementação: [todo-fase-315.md](../../../tasks/todo-fase-315.md).
Handoff: [plan-fase-315.md](../../../tasks/plan-fase-315.md).

## Resultado proposto e decisão D01

Retirar o campo manual da superfície atual; preservar os valores existentes
na coluna e a prioridade operacional da Fase 300. Não converter o legado
em prioridade, não apagar dados nem recalcular avaliações.

**D01 — CONFIRMADA pelo proprietário nesta rodada:** transição compatível;
aceitar PATCH legado validado sem gravar, retirar de respostas internas e CSV,
preservar coluna/histórico. A resposta explícita foi recebida na conversa.
Clientes que dependem da resposta/coluna CSV exigem adaptação; aceitar o PATCH
não resolve essa dependência. Documentar a mudança de contrato na PR.

O handoff está fechado para implementação após autorização dessa etapa.
Nenhum prazo fictício de descontinuação: a remoção final da entrada e da coluna
será outro gate, com inventário de consumidores e aceite explícito.

## Matriz de gaps e decisões técnicas

| Gap | Evidência na base | Correção planejada / aceite |
| --- | --- | --- |
| G315-01 Escrita ativa | `AtualizarPacienteDto` aceita 0–100; `atualizar` grava `String(dados.scoreRisco)` | D01; teste HTTP com pipe real e teste direto do serviço, inclusive payload misto |
| G315-02 Saída interna | `PacienteRespostaDto`, `mapearResposta`, `PacienteResumo` exigem o legado | Remover projeção e tipos conforme D01; testar criação/lista/busca/detalhe/arquivados/PATCH/prontuário, inclusive objetos aninhados |
| G315-03 CSV | `exportarCsv` inclui cabeçalho e valor do legado | D01; testar cabeçalho exato e alinhamento das linhas, quoting, neutralização de fórmula e paginação |
| G315-04 Demo divergente | `api-demo-local.mjs` responde objeto cru e PATCH espalha `body` via `Object.assign` | Allowlist de resposta; excluir campo da gravação e evitar reintrodução via spread; paridade nos fluxos atendidos pelo demo |
| G315-05 Clientes/mocks antigos | Tipos Web, smoke BFF, script staging mutável e fixtures Playwright contêm legado | Atualizar contratos simulados; manter fixture ORM legada e testes de não exposição; não executar script externo nesta fase |
| G315-06 Histórico/schema | Coluna numeric(5,2), NOT NULL DEFAULT 0; ORM ainda mapeia campo | Manter schema/ORM; evitar novas escritas de valor manual; nenhuma alteração em migration antiga |
| G315-07 Domínio sem consumidor encontrado | `dominio/paciente.ts` declara propriedade; busca por construtor/import não encontrou uso | Reconfirmar antes de retirar só a propriedade; não ampliar para refactor de domínio/status |
| G315-08 Superfícies protegidas | Portal já exclui legado; `/v1` usa allowlist; prioridade vem de tabela própria | Manter testes negativos; não expor prioridade pública nem substituir campo por `scoreCalculado` |
| G315-09 Consumidores externos desconhecidos | Busca estática não observa aplicações já distribuídas/integrações privadas | Impacto documentado na decisão D01; registrar limite de evidência e janela futura, sem consultar logs sensíveis |
| G315-10 Cobertura CSV fraca | Testes atuais conferem partes do cabeçalho, não contrato completo | Asserção exata, contagem/ordem de colunas e amostra com legado não-zero |

## Contrato aprovado D01

- PATCH mantém `@IsOptional/@IsNumber/@Min(0)/@Max(100)` e marca entrada
  depreciada. Não afrouxar `whitelist`/`forbidNonWhitelisted`; campos arbitrários
  continuam rejeitados. Não usar `@Allow` para aceitar valor cru.
- Preservar comportamento atual de `@IsOptional` para null/ausência, comprovado
  com pipe real. Strings, NaN/Infinity, objetos e valores fora de faixa não
  ganham aceitação nova. POST segue seu contrato atual, sem nova entrada legado.
- Pedido misto válido atualiza os demais campos; o legado permanece idêntico.
  Valor inválido rejeita a requisição antes de mutações. Pedido só legado
  autoriza e retorna a projeção vigente sem save desnecessário, alteração de
  atualizadoEm ou evento fictício. Documentar o no-op;
  não inventar nova trilha de auditoria ou log de valor clínico.
- Autorizar tenant/carteira antes de qualquer caminho de retorno, inclusive
  no-op. Sem alteração em `ExecutorTenant`, guardas, RLS, crypto ou permissões.
- Resposta allowlist omite legado em JSON real, não apenas na interface TS.
  O BFF continua encaminhando o contrato backend; não duplicar regra ali.
- CSV proposto remove só a coluna `scoreRisco`; não acrescenta prioridade.
  Mantém ordem das demais, limite de exportação, filtros e escaping existentes.
- Valores ORM antigos não-zero continuam legíveis internamente e intactos
  em updates de cadastro. Novos registros podem usar DEFAULT 0 do schema;
  seeds não devem escrever novos scores manuais não-zero em produção.
- Retirar de fixtures de resposta; preservar casos ORM históricos e asserções
  negativas de portal/dashboard. Não fazer remoção textual indiscriminada.

## Invariantes e dependências

Filtros `risco`, filtros salvos, status `risco`, prioridade calculada/override,
gatilho `paciente.risco_alto`, dashboard e painel de operação seguem seus
contratos vigentes. A nomenclatura histórica desses identificadores não é
o campo legado. Não alterar regras, pesos, expiração de override ou automações.

Fase 315 independe dos datasets/direitos/G01 da 314. G02 da 314 permanece
ratificado; classificadores continuam bloqueados. Proteções de gestantes,
menores, adultos e snapshots não participam da mudança. Nenhuma nova
dependência, tabela, feature flag ou projeção paralela é necessária.

Manter `synchronize: false`, migrations antigas, FORCE RLS, carteira e
minimização existentes. Não inferir migrations aplicadas de merge/CI.
Provas de banco da implementação ocorrerão só em PostgreSQL descartável;
sem leitura de pacientes reais ou migrations externas.

## Gates e rollback

| Gate | Estado neste planejamento | Evidência de saída |
| --- | --- | --- |
| P00 Base/isolamento/inventário | PASS | Main/PR/HEAD conferidos, worktree própria, arquivos preexistentes preservados |
| P01 Compatibilidade D01 | PASS | Resposta explícita recebida e contrato atualizado |
| P02 Planejamento documental | PASS | Gaps, inventário, tarefas, testes e rollback escritos |
| I01 Contratos/serviços/demo | SKIPPED | Testes novos positivos/negativos + pipe HTTP + BFF/smoke local |
| I02 Histórico/isolamento | SKIPPED | PG descartável prova preservação não-zero, carteira/tenant e updates; RLS existente regressão |
| I03 Regressões/CI | SKIPPED | Builds/typecheck/lint disponíveis, prioridade/portal/API/antropometria, Demo smoke e checks obrigatórios do HEAD |
| I04 Revisão R4 | SKIPPED | Revisor independente identificado quando viável; indisponibilidade registrada, nunca autoprovada |
| O01 Produção | BLOCKED | Autorização operacional e investigação de saúde externa; evidência do alvo |

Sem DDL, rollback por código mantém a coluna e os dados. Voltar ao código
anterior pode reexpor/reativar a escrita legado: isso requer análise deliberada,
não um rollback automático considerado neutro. Preferir corrigir projeção
ou compatibilidade preservando dados. Não usar `migration:revert`, DROP,
reset de score ou transformação em prioridade. Remoção física futura exige
comprovar consumidores inativos, retenção/recuperação, compatibilidade das
versões ainda suportadas e limite de não reversão, em nova autorização.

## Evidências e limites desta rodada

PASS: Git/branch/status/log, inventário e leitura dos contratos. PR #394
MERGED em 2026-10-11; checks de PR SUCCESS salvo Provenance SBOM SKIPPED;
CI pós-merge `38179801575` SUCCESS no mesmo SHA. São evidências da base,
não testes da Fase 315. Monitor produção `38183397104` FAIL em
“Verificar backend, dependencias e web”; causa não investigada aqui.

Nenhum teste de implementação, build, banco externo, migration, merge ou
deploy executado. Verificações documentais ficam registradas no handoff.

## Modelo suficiente e uso de tokens

Planejamento/contratos/revisão R4: GPT-6.1 Sol médio. Com D01 fechado,
GPT-6 Luna alto pode implementar tarefas pequenas T01–T07 guiado por este
contrato; risco de mass assignment, prova PG ou divergência de contrato nova
exige Sol médio para análise. Para evitar trocas e retrabalho, Sol médio
é suficiente para a execução completa. Troca só manual, após aviso e pausa;
nenhuma troca realizada ou necessária durante este planejamento.
