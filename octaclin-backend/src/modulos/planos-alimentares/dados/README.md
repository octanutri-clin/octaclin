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

## USDA FoodData Central

Use os downloads oficiais de Foundation Foods e SR Legacy. Cada base/release tem
identidade própria; não use Branded Foods nesta fase. Baixe o ZIP oficial,
extraia localmente o JSON da base escolhida e mantenha o arquivo fora do Git.
O gerador aceita somente uma raiz (`FoundationFoods` ou `SRLegacyFoods`) por
vez e grava checksum, release, data de captura e dados de origem.

```powershell
pnpm --dir octaclin-backend catalogo:usda:gerar -- `
  --arquivo 'C:\dados\FoodData_Central_foundation_food_json.json' `
  --saida 'C:\dados\octaclin-usda-foundation-2026-04.json' `
  --base foundation-foods --versao 2026-04 --capturada-em 2026-10-01
```

Para SR Legacy, use `--base sr-legacy --versao 2018-04` e o JSON
`SRLegacyFoods` da edição final. Atualizações geram uma versão nova; não
substituem registros de releases anteriores. O conversor usa o ID energético
2048 (Atwater específico), com 2047 como alternativa, em Foundation Foods; SR
Legacy usa 1008. Mantém os demais nutrientes e atributos originais em
`metadadosOrigem`. Amostras explicitamente descritas como 0% de umidade são
excluídas; ausências não viram zero.

Para carregar, confirme database e role owner pelo runbook. O comando compara o
banco conectado com o valor exato esperado, exige ator e confirmação literal,
e a repetição só é aceita se fonte, checksum, hash e registros continuarem
íntegros:

```powershell
$env:USDA_CATALOGO_JSON='C:\dados\octaclin-usda-foundation-2026-04.json'
$env:USDA_CONFIRMAR_CARGA='true'
$env:USDA_BANCO_ESPERADO='<nome exato confirmado no runbook>'
$env:USDA_ROLE_ESPERADA='<role owner exata confirmada no runbook>'
$env:USDA_RESPONSAVEL_APROVACAO='<responsável identificado>'
pnpm --dir octaclin-backend catalogo:usda:carregar
Remove-Item Env:USDA_CATALOGO_JSON,Env:USDA_CONFIRMAR_CARGA,Env:USDA_BANCO_ESPERADO,Env:USDA_ROLE_ESPERADA,Env:USDA_RESPONSAVEL_APROVACAO
```

## IBGE POF 2008–2009

Este catálogo usa o ZIP local oficial `tabelacompleta.zip`; seu conversor é
separado do parser USDA. Instale a dependência Python fixada e gere um JSON
intermediário determinístico. Informe a data da captura explicitamente; o
conversor verifica o membro XLS, tamanho, cabeçalhos e 1.971 linhas da tabela.
O resultado guarda hashes do ZIP e do XLS, referências, legenda e os 37 campos
nutricionais por registro. O JSON e os arquivos de origem devem ficar fora do
Git.

```powershell
python -m pip install --require-hashes -r octaclin-backend/scripts/requirements-catalogo-ibge.txt
pnpm --dir octaclin-backend catalogo:ibge:pof:converter -- `
  --arquivo 'C:\dados\tabelacompleta.zip' `
  --saida 'C:\dados\ibge-pof-intermediario.json' `
  --versao pof-2008-2009-2011-v1 --capturada-em 2026-10-01
pnpm --dir octaclin-backend catalogo:ibge:pof:gerar -- `
  --arquivo 'C:\dados\ibge-pof-intermediario.json' `
  --saida 'C:\dados\octaclin-ibge-pof-2008-2009.json'
```

O identificador externo é `codigoAlimento:codigoPreparacao`, pois o mesmo
alimento aparece em preparos distintos. Nome de referência, código e descrição
da preparação, referência bibliográfica e todos os nutrientes originais ficam
preservados. `-` e células ausentes viram `null` no valor usado para cálculo;
marcadores e strings de origem também ficam no metadado. A fonte só pode ser
carregada depois de informar a referência documental da autorização confirmada
pelo proprietário:

```powershell
$env:IBGE_CATALOGO_JSON='C:\dados\octaclin-ibge-pof-2008-2009.json'
$env:IBGE_CONFIRMAR_CARGA='true'
$env:IBGE_BANCO_ESPERADO='<nome exato confirmado no runbook>'
$env:IBGE_ROLE_ESPERADA='<role owner exata confirmada no runbook>'
$env:IBGE_RESPONSAVEL_APROVACAO='<responsável identificado>'
$env:IBGE_REFERENCIA_DIREITO_USO='<referência externa do documento de autorização>'
pnpm --dir octaclin-backend catalogo:ibge:pof:carregar
Remove-Item Env:IBGE_CATALOGO_JSON,Env:IBGE_CONFIRMAR_CARGA,Env:IBGE_BANCO_ESPERADO,Env:IBGE_ROLE_ESPERADA,Env:IBGE_RESPONSAVEL_APROVACAO,Env:IBGE_REFERENCIA_DIREITO_USO
```

O importador recusa fonte/versionamento divergentes, checksum ou conteúdo
alterados, IDs repetidos e referência ausente. Reexecutar o mesmo artefato
íntegro é idempotente. Uma nova versão é aditiva. Não execute a carga em staging
ou produção sem identificar o ambiente, banco e role owner no runbook.
