# Catalogo TACO

Artefato derivado da aba `CMVCol taco3` da Tabela Brasileira de Composicao de
Alimentos (TACO), 4a edicao revisada e ampliada, NEPA/UNICAMP, 2011.

Regeneracao a partir da URL oficial:

```powershell
pnpm --dir octaclin-backend exec ts-node scripts/importar-catalogo-taco.ts
```

Para usar uma copia local sem rede:

```powershell
$env:TACO_ARQUIVO_LOCAL='C:\caminho\taco.xlsx'
pnpm --dir octaclin-backend exec ts-node scripts/importar-catalogo-taco.ts
Remove-Item Env:TACO_ARQUIVO_LOCAL
```

Regras de transformacao:

- `NA` e celula ausente viram `null`, sem inventar valor nutricional.
- `Tr` vira `0`. Na legenda TACO, traco significa valor abaixo do criterio de
  arredondamento ou do limite de quantificacao.
- `*` significa analise em reavaliacao. O alimento e excluido quando um dos
  nutrientes obrigatorios do catalogo possui esse marcador.
- Energia e sodio seguem o formato inteiro da planilha. Proteina, lipideos,
  carboidrato e fibra seguem uma casa decimal.
- A saida e ordenada por codigo e serializada canonicamente para que duas
  importacoes da mesma origem produzam os mesmos bytes.

A publicacao informa que a reproducao total ou parcial e permitida desde que a
fonte seja citada. A atribuicao completa e o SHA-256 da planilha ficam nos
metadados do JSON.

## Carga no banco

A migration deve estar aplicada antes da carga. Confirme explicitamente o nome
do banco; o carregador recusa a execucao quando o banco conectado diverge:

```powershell
$env:DATABASE_URL='<URL owner do banco confirmado>'
$env:TACO_CONFIRMAR_CARGA='true'
$env:TACO_BANCO_ESPERADO='octaclin_test_fase150b'
$env:TACO_RESPONSAVEL_APROVACAO='<responsavel identificado>'
$env:TACO_REFERENCIA_DIREITO_USO='<documento ou URL da aprovacao>'
pnpm --dir octaclin-backend catalogo:taco:carregar
Remove-Item Env:DATABASE_URL
Remove-Item Env:TACO_CONFIRMAR_CARGA
Remove-Item Env:TACO_BANCO_ESPERADO
Remove-Item Env:TACO_RESPONSAVEL_APROVACAO
Remove-Item Env:TACO_REFERENCIA_DIREITO_USO
```

A carga e idempotente por fonte, versao e codigo do alimento. Ela nao remove
registros existentes e nunca deve ser executada com um banco ambiguo. A fonte
so fica `ativa` quando checksum, esquema nutricional, referencia de direito de
uso e responsavel pela aprovacao estiverem presentes. Novas fontes permanecem
`em_validacao` por padrao.
