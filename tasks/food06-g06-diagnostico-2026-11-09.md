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
