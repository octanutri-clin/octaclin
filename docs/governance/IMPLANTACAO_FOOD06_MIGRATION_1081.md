# FOOD06 — plano de implantação da migration 1081

Procedimento planejado, **não executado** em staging ou produção. Escrever este
documento não autoriza migration externa, merge ou deploy.

A migration `1720000001081-RegistrosAnalisesFactuais` cria a tabela
`registros_analises_factuais` (registros factuais cifrados de análise de
micronutrientes, PR #455). É aditiva: não altera nem lê tabelas existentes. A
classe declara `@aplicacao fora-de-banda`, então o runtime não consegue aplicá-la
no boot (ver `RUNBOOK_PRODUCAO.md`, seção `BANCO_EXECUTAR_MIGRACOES`).

## O que a migration cria

- Tabela com `tenant_id`, `paciente_id`, `profissional_id`, `usuario_id`,
  `chave_idempotencia`, `criado_em` e `conteudo_criptografado` (`bytea`, 32 B a
  10 MiB).
- Chaves estrangeiras compostas por tenant para `tenants`, `pacientes`,
  `profissionais` e `usuarios`, todas `on delete restrict`.
- Unicidade `(tenant_id, id)` e de idempotência
  `(tenant_id, usuario_id, chave_idempotencia)`.
- Índice `(tenant_id, paciente_id, criado_em desc, id desc)` para o histórico.
- `ENABLE` e `FORCE ROW LEVEL SECURITY`, com políticas só de `SELECT` e `INSERT`
  filtradas por `app.tenant_id`. Sem política de `UPDATE`/`DELETE`: sob `FORCE`,
  a role de runtime não altera nem apaga linhas (registro append-only).
- `down()` recusa o rollback para preservar registros clínicos.

Grants: nenhum na migration. A tabela herda os default privileges do owner no
schema (`HANDOFF_CODEX_MIGRATION_1031.md`): a role de runtime recebe
`select, insert, update, delete`, mas o RLS limita a `SELECT`/`INSERT` do próprio
tenant. **Confirmar os grants depois de aplicar**, sem presumir.

## O que acontece se o código chegar antes da migration

Os endpoints de registros factuais (captura, histórico, comparação e relatório
de registros salvos) falham ao acessar a tabela inexistente. O restante do
backend não depende dela. Por isso a ordem é: migration primeiro, deploy depois.

## Pré-condições para o operador

1. CI verde no HEAD final, incluindo o job Backend com PostgreSQL, e revisão R4
   independente registrada na PR.
2. Identificar ambiente, projeto/branch/banco, role owner e role de runtime
   efetivamente usadas, com a autorização operacional correspondente. Não copiar
   credenciais para terminal compartilhado, Git ou PR.
3. Conferir quais migrations o banco já tem:
   `pnpm --dir octaclin-backend run typeorm -- migration:show`.
   A única pendente deve ser a 1081. **Se aparecer qualquer outra pendente
   (por exemplo 1077 a 1080), parar** e tratar cada uma pelo seu procedimento.
4. Confirmar backup recente conforme `RUNBOOK_BACKUP_RESTORE.md`.

## Sequência por ambiente

1. **Staging (ensaio):** com `DATABASE_URL` da role owner, rodar
   `pnpm --dir octaclin-backend migration:run` e observar tempo e locks (tabela
   nova; não deve bloquear tabelas existentes, exceto as checagens de FK).
2. **Verificar por leitura**, com a role owner:
   - `select name from migrations where name like '%1081%';` retorna a linha;
   - `select relrowsecurity, relforcerowsecurity from pg_class where relname='registros_analises_factuais';`
     retorna `true, true`;
   - `select polname, polcmd from pg_policy where polrelid='registros_analises_factuais'::regclass;`
     lista só as políticas de `SELECT` (`r`) e `INSERT` (`a`);
   - `select grantee, privilege_type from information_schema.role_table_grants where table_name='registros_analises_factuais';`
     mostra a role de runtime e, se existir, a de backup só com `SELECT`.
3. **Publicar backend e web** compatíveis só depois do passo 2.
4. **Validar o fluxo** com dado sintético: capturar um registro factual, listar o
   histórico e conferir que outro tenant não o vê. Não usar paciente real.
5. **Produção:** repetir 1 a 4 com evidência e autorização próprias. Não herdar
   conclusões do staging.

## Rollback

- **Código:** reimplantar o commit anterior. A tabela fica, sem uso; nenhum dado
  se perde.
- **Migration:** não executar `migration:revert` nem o `down` (ele recusa por
  projeto). Correção sempre aditiva, em migration nova.
- Registros já gravados ficam preservados e cifrados; a versão anterior do
  código simplesmente não os lê.

## Limites deste plano

- Validado localmente: a suíte `1720000001081-...integracao.spec.ts` passou 44 de
  44 em PostgreSQL 16 descartável (role de runtime sem `BYPASSRLS`, `FORCE RLS`,
  negação de `UPDATE`/`DELETE`/`TRUNCATE`, idempotência, carteira). O CI usa
  PostgreSQL 15.
- Não validado: a cadeia completa de migrations do zero, Neon/produção, tempo
  real de aplicação, default privileges reais do ambiente.
