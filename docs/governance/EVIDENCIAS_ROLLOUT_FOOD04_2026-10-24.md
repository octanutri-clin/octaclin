# FOOD04 — aplicação externa e validação de 24/10/2026

## Autorização e base

O proprietário autorizou nesta sessão: “Faça as migrations, validações”.
PR #441 MERGED em 24/10/2026 08:39:34 UTC; merge
`02a51be816637b0c30aeb56dce7a84ef05812667`, confirmado no GitHub e em origin/main.
CI do HEAD da PR `b2da3799` PASS, run40076515998; CodeQL, Semgrep,
Trivy e Dependency Review SUCCESS. Provenance do SBOM SKIPPED pelo workflow.
Revisão cruzada de fonte e RED/GREEN em `tasks/revisao-seguranca-food04.md`.
A autorização operacional atual supersede o bloqueio histórico do planejamento;
não constitui autorização para mudar plano/cobrança, desativar RLS ou fazer deploy.

## Alvos e resultado

| Alvo | Identificação explícita | Resultado |
| --- | --- | --- |
| Staging | projeto silent-snow-21079677, branch production / br-solitary-pine-atv1hyot, banco neondb | PASS para migration/estrutura e probes SQL descritos abaixo |
| Produção | projeto royal-tooth-92809187, branch production / br-floral-butterfly-awsjh8k7, banco Octaclin-db-producao | BLOCKED: Neon HTTP402, quota excedida; nenhuma escrita executada |
| Ensaio isolado | staging, food04-1078-validation-20261024 / br-divine-lake-atfscuuw | PASS migration, RLS/DML/constraints com fixtures exclusivamente sintéticas |
| Backup staging | backup-food04-before-1078-staging-20261024 / br-bold-lab-atwvscfn | Criado antes da aplicação, sem compute; parent LSN 0/A0DD658 |

Os dois branches criados permanecem preservados; o branch de ensaio contém
fixtures sintéticas identificadas e não deve servir tráfego da aplicação.
Não houve consulta de registros clínicos reais, cópia de credenciais ou alteração
em roles/grants existentes. O clone Neon é copy-on-write do staging; não é dump
sanitizado nem evidência de restore completo. Somente fixtures conhecidas foram
consultadas nos testes positivos; metadados e agregados das tabelas novas nos demais.

## Procedimento realmente executado

1. Branch/worktree/HEAD/diff e merge confirmados. Checkout principal e sua alteração
   preexistente preservados. Nova branch documental `docs/food04-rollout-1078`.
2. Leitura das instruções, migration1078, runbooks e contratos de menor privilégio.
3. Comparação das 91 migrations registradas com o ledger de staging: somente
   `GruposSubstituicoes1720000001078` pendente; nenhuma migration desconhecida.
4. SQL extraído da `up` integrada, sem modificar migration antiga. SHA256 do arquivo:
   `2f22544c20815fcad8aee96a8167842bd070cfe72edc08492b5286d64ac952e5`.
   SHA256 do literal SQL extraído:
   `4a6f24daf58d8f91712d28259bc0509075aa0c07f8b2f9680f5bc7875b5f53a6`.
5. Ensaio via Neon MCP `run_sql_transaction`, com owner neondb_owner: lock_timeout5s,
   statement_timeout60s, advisory lock1078, lock transacional no ledger, guardas de
   banco/owner/cadeia1077, DDL da up e INSERT no ledger na mesma transação.
   Não foi usado migration:run/CLI nem boot com migration automática; a execução
   explícita do SQL integrado e ledger é registrada para não atribuir um comando
   ORM que não ocorreu. A ferramenta resolve conexão do branch sem expor segredo.
6. Testes positivos/negativos no clone usando login real octaclin_app_staging,
   sem SUPERUSER/BYPASSRLS. Fixtures criadas pelo owner somente no clone; mutações
   de teste revertidas por subtransação. Nenhuma fixture criada no staging principal.
7. Backup copy-on-write de staging; aplicação da mesma transação no alvo principal.
8. Verificação pós-aplicação: ledger1078, nenhuma migration pendente/desconhecida,
   duas tabelas, ENABLE+FORCE RLS, policies USING/WITH CHECK por app.tenant_id,
   constraints/índices válidos e privilégios DML herdados dos default ACL existentes.
9. Login SQL runtime real no staging: rolsuper=false, rolbypassrls=false,
   CREATE no public=false; zero grupos/favoritos visíveis sem contexto tenant.
10. Consultas somente leitura de deploys/logs Render e smokes HTTP públicos.
    Nenhum deploy, restart, revert, flag ou migration de produção executado.

## Provas e limites

| Verificação | Resultado observado |
| --- | --- |
| Ensaio PostgreSQL18, schema real do staging | PASS |
| Leitura positiva por tenant próprio e negativa cruzada, grupos e favoritos | PASS no clone |
| Escrita cruzada grupos/favoritos | PASS: SQLSTATE42501 |
| Idempotência e favorito duplicado | PASS: unique_violation |
| Revisão zero | PASS: check_violation |
| FK favorito/grupo de outro tenant | PASS: foreign_key_violation |
| CAS vencido, arquivo e restauração explícitos | PASS no clone; não equivale a corrida paralela HTTP |
| Concorrência/serviços/autorização de produto | PASS no CI da PR; não repetido contra dados reais |
| grupos_substituicoes no staging | FORCE RLS,25 constraints,8 índices válidos |
| favoritos_grupos_substituicoes no staging | FORCE RLS,10 constraints,2 índices válidos |
| Ledger staging após aplicação | 1078 presente; conjunto registrado completo |
| Runtime staging | Sem SUPERUSER/BYPASSRLS/CREATE; DML permitido sob RLS |
| Produção, duas tentativas read-only | BLOCKED HTTP402, quota excedida |
| Health/readiness/login HTTP, dois ambientes | INCONCLUSIVO: seis requests atingiram timeout30s no executor |
| Jornada autenticada profissional/paciente após aplicação | SKIPPED: não executada nesta rodada |

Contagens de constraints do PostgreSQL18 incluem NOT NULL; não comparar diretamente
com contagens de outros majors. RLS por tenant não substitui autorização por
profissional/escopo nos serviços: a matriz de produto continua nas provas da PR.

Notas de tooling: tentativa de múltiplas instruções em run_sql foi recusada antes
de execução; mudou-se para run_sql_transaction. Configuração de suspend_timeout
custom no primeiro create_branch foi recusada (HTTP412), sem branch criado;
repetição com defaults criou o clone. A primeira prova por SET ROLE do owner foi
recusada e revertida; o teste válido conectou diretamente como runtime, sem
conceder associação ou privilégio adicional. Nenhuma dessas tentativas é PASS.

Artefatos locais reproduzíveis: `/tmp/food04-rollout-20261024/` contém SQL extraído,
lista de migrations, seed exclusivamente sintético do clone e prova-runtime.sql.
O seed não deve ser executado em staging principal/produção. A mesma propriedade
está automatizada em `1720000001078-GruposSubstituicoes.integracao.spec.ts`.

## Render e impedimento de produção

Metadados da conexão Octaclin / My Workspace, mesmo commit do merge:

| Serviço | Último deploy observado |
| --- | --- |
| octaclin-backend-staging | live, dep-dbe6tics728c73c8tvfg |
| octaclin-web-staging | live, dep-dbe6ti4s728c73c8tv50 |
| octaclin-web-producao | live, dep-dbe6ti4s728c73c8tvag |
| octaclin-backend-producao | update_failed, dep-dbe6tics728c73c8u01g |

Logs entre08:39–08:43 UTC confirmam `Your account or project has exceeded the
quota. Upgrade your plan to increase limits.` no backend de produção. O Neon
repetiu HTTP402 nas consultas desta rodada. Não se presume schema/ledger de
produção a partir de staging nem saúde operacional a partir de deploy live.
A falha do deploy automático ocorreu antes desta execução operacional.

## Retomada e rollback

1. Responsável regulariza a quota do projeto/conta Neon pelo painel, sem enviar
   segredo nesta conversa. Nenhum upgrade ou alteração de cobrança foi realizado.
2. Reconsultar produção e reconciliar todas as migrations com main; criar backup e
   ensaio isolado de produção, então aplicar1078 se ainda pendente, com transação
   e owner explícitos; validar schema/RLS/runtime e ledger nesse banco.
3. Verificar deploy/readiness e jornada autenticada em ambos os ambientes;
   recuperação/redeploy operacional exige autorização correspondente.
4. Manter tabelas/histórico. down da1078 recusa remoção. Não restaurar banco inteiro
   sobre produção como rollback rotineiro: isso perderia escritas posteriores.
   Para envelopes editoriais2, conservar writer compatível e preferir fix adiante.

FOOD04 está integrada tecnicamente; rollout produtivo não concluído. FOOD05 ainda
não planejada/implementada nesta rodada. O diálogo de escopo pode prosseguir,
mas não resolve a pendência operacional da FOOD04.
