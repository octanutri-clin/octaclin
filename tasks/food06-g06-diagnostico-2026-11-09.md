# G06 — diagnóstico operacional (2026-11-09)

Leitura somente de metadados nos projetos Neon, via SQL `select`. Nenhuma
migration, DDL, escrita, mudança de quota/configuração ou deploy foi executada.
O Render não foi consultado (sem acesso nesta sessão).

## Estado observado

| Item | Produção (`Octaclin-db-producao`) | Staging (`neondb`) |
| --- | --- | --- |
| Última migration no ledger | 1080 (93 no total) | 1080 (93 no total) |
| 1079 e 1080 | aplicadas | aplicadas |
| 1081 (`registros_analises_factuais`) | **ausente** | **ausente** |
| 1082 (append-only, PR #478) | ausente (ainda não está na `main`) | ausente |
| Roles | `octaclin_app_producao` sem BYPASSRLS; `octaclin_backup_producao` com BYPASSRLS (leitura) | não conferido |
| Fontes de composição | TACO, IBGE/POF, USDA Foundation, USDA SR Legacy: ativas, direito aprovado | IBGE/POF e as duas USDA; **sem TACO** |
| Uso | 2 pacientes; última auditoria em 2026-10-13 | 4 pacientes; última auditoria em 2026-09-18 |
| Compute | ativo em 2026-11-09 | ativo em 2026-11-09 |

Comparado com a conferência de 2026-11-04 (`CHECKLIST_FASES_FUTURAS_PRODUCAO.md`):
1079 e 1080 foram aplicadas nos dois bancos, e o compute de produção voltou a
responder (o HTTP 402 de quota de 30/10 não se repetiu na leitura de hoje; isso
não prova a conexão do runtime do Render).

## Risco atual

A `main` já contém o código da #455, que usa `registros_analises_factuais`. Se o
Render publicou esse commit (auto-deploy por commit, segundo o checklist), os
endpoints de registros factuais falham até a 1081 existir. Os demais fluxos não
dependem dela. Pelo volume de uso, o impacto observado hoje é baixo.

## Plano para encerrar o G06

Cada passo com banco ou deploy exige autorização explícita do proprietário,
ambiente identificado e role owner, conforme `RUNBOOK_PRODUCAO.md`.

1. Mergear a #478 (traz a 1082).
2. **Staging:** aplicar 1081 e 1082 com owner (procedimento em
   `docs/governance/IMPLANTACAO_FOOD06_MIGRATION_1081.md`), conferir por leitura
   (ledger, FORCE RLS, policies, trigger `A`, grants sem TRUNCATE) e publicar o
   backend da `main`. Smoke com fixture sintética.
3. **Staging:** decidir se carrega a TACO para espelhar a produção.
4. **Render (proprietário):** conferir em qual commit cada serviço está e se o
   backend de produção conecta ao banco sem erro de quota.
5. **Produção:** repetir o passo 2 com evidência própria, depois smokes
   (`/health/detalhado`, login, captura de registro factual sintético,
   isolamento entre tenants) e rollback documentado (código anterior, sem `down`).
6. Registrar a evidência e só então marcar G06 como resolvido.

## Execução autorizada — 1081 e 1082 (2026-11-09, ~11:53–11:55 UTC)

Autorização do proprietário nesta sessão ("Tá autorizado"), para staging e depois
produção. Execução via Neon, role owner (`neondb_owner`), com o SQL extraído
literalmente dos arquivos da `main` (sha256 do arquivo 1081 `41deceb0…`, 1082
`4ae47753…`), 14 comandos numa única transação, incluindo o registro no ledger
`migrations` (timestamps 1720000001081 e 1720000001082).

| Passo | Staging (`silent-snow-21079677`) | Produção (`royal-tooth-92809187`, `Octaclin-db-producao`) |
| --- | --- | --- |
| Ponto de restauração | branch `backup-pre-1081-1082-2026-11-09` (`br-fancy-leaf-atb6g4v7`) | branch `backup-pre-1081-1082-2026-11-09` (`br-raspy-butterfly-awe85wfz`) |
| Pré-requisitos | ledger em 1080; índices únicos `(tenant_id, id)` em pacientes, profissionais, usuarios | idem |
| Aplicação | transação concluída | transação concluída |
| Ledger | 1081 e 1082 registradas | 1081 e 1082 registradas |
| RLS | ENABLE e FORCE | ENABLE e FORCE |
| Policies | só `select` e `insert` | só `select` e `insert` |
| Trigger append-only | `A` (enable always) | `A` (enable always) |
| Grants da runtime | `octaclin_app_staging`: SELECT/INSERT/UPDATE/DELETE, **sem TRUNCATE** (nome fora da lista do REVOKE; a trigger protege) | `octaclin_app_producao`: **só SELECT/INSERT**; `octaclin_backup_producao`: só SELECT |
| Prova funcional (UPDATE `where false` como runtime) | `42501` da trigger | `42501` `permission denied` (REVOKE) |

Não foi feito: deploy, conferência do Render, smoke de aplicação com registro
factual sintético. A carga da TACO no staging foi feita depois e está registrada na
seção seguinte. Os pontos de restauração podem ser removidos pelo proprietário
depois que o backend novo estiver validado.

## Execução autorizada — carga da TACO v1 no staging (2026-11-09)

Autorização do proprietário nesta sessão ("Pode carregar a TACO no staging").
Projeto `silent-snow-21079677`, banco `neondb`, via Neon com a role owner. Carga
**aditiva** (catálogo, fonte, importação e alimentos novos; nada existente foi
alterado). Produção não foi tocada: a TACO já estava ativa lá.

| Item | Valor |
| --- | --- |
| Catálogo / fonte | `taco_nepa_unicamp` / `taco-4a-cmvcol-taco3-v1` (base `cmvcol_taco3`, esquema `octaclin-composicao-v1`) |
| Direito de uso | `aprovado`, referência na URL oficial do NEPA/UNICAMP, responsável `proprietario-autorizacao-2026-11-09` |
| Registros | 583 alimentos válidos, de 597 candidatos; 14 excluídos pelo motivo `valor_nutricional_em_reavaliacao_ou_invalido` (listados no manifesto da importação) |
| Hashes | arquivo de origem `a66b8ec5…2d14`; conteúdo `82c22bc4…81e7`; combinado dos registros `6e811a55…1b5f` |

**Como foi executada.**

1. Primeira tentativa, numa única transação, **abortada** pela conferência de hash
   (583 linhas, hash divergente) e revertida: nada foi gravado. Causa: erro de cópia
   do payload feita pelo agente (a linha 597, "Noz, crua", saiu com sódio 1 em vez
   de 5). O hash esperado foi recalculado localmente a partir das duas fontes
   (`linhas.json` e o SQL ensaiado) e estava correto.
2. Segunda tentativa, em etapas: (a) abertura numa transação (catálogo, fonte em
   `em_validacao`, importação `em_execucao`); (b) 6 lotes de até 100 linhas, cada um
   com o prefixo esperado do hash de **cada linha** (linha divergente aborta o lote
   com o código dela); (c) fechamento numa transação: conferência da contagem e do
   hash combinado, importação `concluida`, fonte `ativa` e tentativa registrada. A
   fonte só ficou `ativa` depois da conferência.

**Verificado por leitura depois da carga:** fonte `ativa`, direito `aprovado`, 583
alimentos, importação `concluida`, 1 tentativa `concluida`, hash combinado igual ao
esperado.

**Limites e pendências.**

- **Sem ponto de restauração novo:** `create_branch` falhou por limite de branches
  do staging. O backup existente (`backup-pre-1081-1082-2026-11-09`) é anterior à
  carga. A carga é aditiva; o rollback não foi ensaiado e exigiria procedimento
  deliberado, porque a fonte ativa é protegida por triggers.
- **v2 (micronutrientes) não foi carregada**: só a v1 (`taco-4a-cmvcol-taco3-v1`).
- **Não comparado** com a TACO da produção (equivalência de versão e conteúdo não
  verificada).
- **Alimento 540 com nome "L"** (categoria "Alimentos preparados"): o nome já vem
  assim do artefato de origem (`linhas.json`), não do SQL. Parece truncado na
  extração da planilha; **conferir na fonte** (e na TACO da produção) antes de
  expor o item a usuários. Os valores nutricionais dessa linha não foram revisados.
- A tabela "Estado observado" acima registra o estado do início do dia (staging sem
  TACO) e não foi reescrita.
