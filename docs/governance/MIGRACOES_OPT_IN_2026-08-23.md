# PR 4 - Migrations opt-in

## Decisao implementada

O backend executa migrations no boot somente quando
`BANCO_EXECUTAR_MIGRACOES=true` esta definido literalmente. Variavel ausente ou
`false` deixa `migrationsRun=false`; qualquer outro valor falha explicitamente
na configuracao. O comando `pnpm --dir octaclin-backend migration:run` continua
sendo o caminho fora de banda para aplicar migrations.

## Inventario observado

| Ambiente | Fonte de evidencia | Estado esperado apos esta PR |
| --- | --- | --- |
| Local | `octaclin-backend/.env.example` | `BANCO_EXECUTAR_MIGRACOES=false`; usar o comando explicito para DDL. |
| CI staging mutavel | `.github/workflows/staging-e2e-mutavel.yml` | Runtime ja usa `false`; o workflow aplica migrations antes do boot com a URL owner do branch Neon descartavel. |
| Staging Render | Configuracao externa ao Git | Confirmar `false` no painel antes do deploy e validar `/health/pronto` apos o deploy. |
| Producao Render | Configuracao externa ao Git | Confirmar `false` no painel antes do deploy e validar `/health/pronto` e `/health/detalhado` apos o deploy. |

Valores de ambiente Render nao sao acessiveis pelo repositorio e nao foram
inferidos. A ausencia da variavel fica segura com este codigo, mas o valor
explicito `false` e o estado operacional desejado.

## Procedimento de migration

1. Confirmar projeto, branch, banco e role owner da URL.
2. Executar `migration:show` e interromper se houver pendencias inesperadas.
3. Executar `pnpm --dir octaclin-backend migration:run` com a URL owner.
4. Executar novamente `migration:show` e validar o schema esperado.
5. Fazer deploy com o runtime usando `BANCO_EXECUTAR_MIGRACOES=false`.
6. Validar `/health/pronto` e `/health/detalhado` sem migration pendente.

Nao usar a URL ou a role de runtime para executar migrations e nao usar
`migration:revert` como rollback de aplicacao.
