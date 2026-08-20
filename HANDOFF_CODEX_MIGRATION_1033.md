# Registro operacional - migration 1033 (receitas nutricionais)

Documento operacional do Incremento 8 da Fase 234. Nao depende da conversa
original e nao contem connection string, token ou dado clinico.

- Migration: `1720000001033-CriarReceitasNutricionais`
- Estado do codigo: implementado e validado localmente em 2026-08-20
- Estado do banco: **aplicada em integracao e producao em 2026-08-20**
- Restore point Neon de producao: `backup-pre-migration-1033-20260820`

## Execucao realizada

- Integracao: `octaclin_test_fase150b`, role `neondb_owner`, com a unica
  pendencia `CriarReceitasNutricionais1720000001033` antes da aplicacao.
- Producao: `Octaclin-db-producao`, role `neondb_owner`, com a unica pendencia
  `CriarReceitasNutricionais1720000001033` antes da aplicacao.
- Pos-condicoes confirmadas nos dois bancos: registro no historico TypeORM,
  RLS e RLS forcada, policy `isolamento_tenant_receitas_nutricionais`, indices
  de listagem/profissional e constraints de origem, tipo, total e escopo.

## Escopo e risco

A migration e aditiva. Cria apenas `receitas_nutricionais`, seus dois indices,
RLS forcada e uma policy de isolamento por tenant. Ela nao altera planos,
versoes, alimentos, catalogos, dados de pacientes nem executa backfill.

Nome, instrucoes e itens de receita ficam em snapshot criptografado. O plano
publicado nao referencia a receita: ao usar a biblioteca, a web copia itens para
o rascunho e o servico existente recalcula os totais ao salvar.

## Pre-requisitos obrigatorios

1. O checkout local esta no commit que inclui a migration. Como `main` faz
   deploy automatico, nao faca merge antes de a aplicacao em producao passar:
   a tabela nova e aditiva, portanto o schema pode avancar antes do codigo sem
   indisponibilizar a aplicacao atual.
2. Confirmar explicitamente o ambiente e o nome do banco na propria
   `DATABASE_URL`.
3. Executar primeiro em `octaclin_test_fase150b` com a role `neondb_owner`.
4. Em producao, confirmar backup/snapshot valido antes de executar.
5. Manter `BANCO_EXECUTAR_MIGRACOES=false` no runtime de producao. A role de
   aplicacao nao deve receber privilegio de DDL para compensar isso.
6. Nunca rodar seed, importador ou backfill enquanto a URL administrativa
   estiver na sessao.

## Passo 1 - integracao

No checkout atualizado, usando apenas a URL owner do banco de integracao:

```powershell
$env:DATABASE_URL='<URL do neondb_owner de octaclin_test_fase150b>'
pnpm --dir octaclin-backend migration:show
pnpm --dir octaclin-backend migration:run
pnpm --dir octaclin-backend migration:show
Remove-Item Env:DATABASE_URL
```

Antes de `migration:run`, a unica pendente precisa ser
`CriarReceitasNutricionais1720000001033`. Se houver outra pendente, pare e
reporte. Depois, todas as migrations precisam aparecer com `[X]`.

## Verificacao obrigatoria

Rode no banco que acabou de receber a migration:

```sql
select relrowsecurity, relforcerowsecurity
from pg_class where relname = 'receitas_nutricionais';
-- esperado: t | t

select policyname from pg_policies where tablename = 'receitas_nutricionais';
-- esperado: isolamento_tenant_receitas_nutricionais

select indexname from pg_indexes where tablename = 'receitas_nutricionais'
order by indexname;
-- esperado incluir: receitas_nutricionais_pkey,
-- idx_receitas_nutricionais_listagem, idx_receitas_nutricionais_profissional

select conname from pg_constraint
where conrelid = 'receitas_nutricionais'::regclass and contype = 'c';
-- esperado incluir: receitas_nutricionais_origem_profissional_check
```

## Passo 2 - producao

Somente depois da integracao e das verificacoes acima passarem. Repita o mesmo
fluxo com a URL de `neondb_owner` de `Octaclin-db-producao`, mantendo o backup
confirmado. Nao use `octaclin_app_producao` para DDL e nao habilite migration
automatica no deploy.

Depois, valide `/health/pronto`, login e a abertura de um prontuario. A
biblioteca podera ser testada com massa sintetica ou conta de teste, sem usar
paciente real no primeiro aceite.

## Em caso de falha

Nao execute `migration:revert` automaticamente. A migration cria uma tabela
nova e vazia, mas o erro precisa ser analisado antes de qualquer `down`. Limpe
`DATABASE_URL` da sessao e reporte a mensagem com a URL redigida.
