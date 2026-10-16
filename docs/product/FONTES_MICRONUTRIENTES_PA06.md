# PA06 — fontes e contrato factual de micronutrientes

Conferência documental em 2026-10-16, base `011ea87d` (PR #421 integrada).
Este documento especifica a terceira entrega PA06; nenhum importador, catálogo
operacional ou snapshot clínico foi alterado nesta rodada.

## Evidência de origem

Foram baixados somente artefatos públicos oficiais, em memória, para conferir
cabeçalhos, unidades e identificadores. Nenhum registro de paciente foi usado;
nenhum script dos fornecedores foi executado. O parser XLS já disponível no
ambiente (`xlrd`) foi usado somente para ler os cabeçalhos IBGE.

| Fonte | Artefato conferido | SHA-256 |
| --- | --- | --- |
| TACO, NEPA/UNICAMP, 4ª edição/2011 | [XLSX oficial](https://www.nepa.unicamp.br/arquivo/uploads/taco-4a-edicao/taco-4a-edicao-2/), 322270 bytes, aba `CMVCol taco3`, linhas 2/3 | `a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14` |
| IBGE POF 2008–2009 | [ZIP oficial](https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/Tabelas_de_Composicao_Nutricional_dos_Alimentos_Consumidos_no_Brasil/tabelacompleta.zip), 338672 bytes | `3aa01426f16f8041ce830de2dda7e5003806b437917cb829f8cefe84a0ac21e0` |
| IBGE | membro `tabelacompleta.xls`, cabeçalho da linha 4 e aba de legenda | `e75487405593196fe551d58e934e415e840f33f78acd0af08ed61bedb957c7ac` |
| USDA FoodData Central SR Legacy, 2018-04 | [CSV ZIP oficial](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip), 6074592 bytes | `b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0` |
| USDA | membro `nutrient.csv`, colunas `id`, `name`, `unit_name` | `466ab9d011094cc1ad8d939b246693988b56817c42d0e40a98820723695c6084` |

Reprodução documental: baixar cada URL; calcular SHA-256 dos bytes; abrir o ZIP
sem executar conteúdo; ler `xl/sharedStrings.xml`, relações e primeira folha
TACO; ler a tabela XLS IBGE de 43 colunas e a legenda; consultar `nutrient.csv`
pelos IDs abaixo. Guardar o manifesto gerado e fixtures sintéticas dos adapters
na implementação. Uma alteração de hash exige nova conferência, sem aceitar
automaticamente o novo artefato como equivalente.

## Whitelist proposta: `octaclin-micronutrientes-v1`

Os códigos/unidades são fixos. `mcg` é a unidade canônica da API; `UG` do USDA
representa microgramas, sem mudar a escala numérica. Todos os valores de entrada
referem-se à base nutricional declarada pelo catálogo, normalizada a 100 g uma
única vez. O snapshot conserva base e valor de origem.
Na API a unidade base é `mg` ou `mcg`; RE/RAE/NE/DFE são qualificadores fixos do
código, apresentados no rótulo da tabela e nunca convertidos entre si.

Na coluna IBGE, os nomes são os cabeçalhos oficiais com a unidade indicada;
abreviações abaixo não autorizam matching aproximado por nome no runtime.
Os adapters precisam declarar os cabeçalhos literais e aliases sem acento já
suportados pelo importador, recusando duplicatas ambíguas.

| Código canônico | Unidade | TACO: coluna | IBGE: campo | USDA: ID |
| --- | --- | --- | --- | --- |
| `calcioMg` | mg | L | Cálcio | 1087 |
| `magnesioMg` | mg | M | Magnésio | 1090 |
| `manganesMg` | mg | O | Manganês | 1101 |
| `fosforoMg` | mg | P | Fósforo | 1091 |
| `ferroMg` | mg | Q | Ferro | 1089 |
| `potassioMg` | mg | S | Potássio | 1092 |
| `cobreMg` | mg | T | Cobre | 1098 |
| `zincoMg` | mg | U | Zinco | 1095 |
| `selenioMcg` | mcg | ausente | Selênio | 1103 |
| `retinolMcg` | mcg | V | Retinol | 1105 |
| `vitaminaAReMcg` | mcg RE | W | ausente | sem mapeamento |
| `vitaminaARaeMcg` | mcg RAE | X | Vitamina A (equivalente de atividade de retinol) | 1106 |
| `tiaminaMg` | mg | Y | Tiamina (vitamina B1) | 1165 |
| `riboflavinaMg` | mg | Z | Riboflavina (vitamina B2) | 1166 |
| `vitaminaB6Mg` | mg | AA: piridoxina | Piridoxina (vitamina B6) | 1175 |
| `niacinaMg` | mg | AB | Niacina (vitamina B3) | 1167 |
| `niacinaNeMg` | mg NE | ausente | Equivalente de niacina (vitamina B3) | sem mapeamento |
| `vitaminaB12Mcg` | mcg | ausente | Cobalamina (vitamina B12) | 1178 |
| `folatoDfeMcg` | mcg DFE | ausente | Folato (equivalente dietético de folato) | 1190 |
| `vitaminaDMcg` | mcg | ausente | Vitamina D (calciferol), pendência semântica abaixo | 1114: D2 + D3 |
| `vitaminaEAlfaTocoferolMg` | mg | ausente | Vitamina E (total de alpha-tocopherol) | 1109 |
| `vitaminaCMg` | mg | AC | Vitamina C | 1162 |

Os 20 IDs USDA e suas unidades foram conferidos no CSV oficial. Isso não
comprova a presença de cada nutriente em cada alimento ou a compatibilidade
automática de qualquer release futura. Foundation Foods precisa de fixture
própria do formato já aceito, validação de ID/unidade e registro da release.

Pendência técnica delimitada: o cabeçalho IBGE de vitamina D não descreve
sozinho a agregação D2+D3. T08c.1 deve conferir as notas/metodologia da referência
antes de habilitar esse mapeamento comum. Sem comprovação, o adapter IBGE não
produz `vitaminaDMcg`; indica ausência de definição compatível e preserva a
célula original. Não converter unidades internacionais de vitaminas ou deduzir
equivalência somente pelo nome. O restante da whitelist pode prosseguir.

## O que pode ser somado

- Manter retinol, RE e RAE separados. Não somar esses três campos nem derivar
  um deles dos demais; representam expressões diferentes de vitamina A.
- Manter niacina e NE separados, assim como folato DFE de qualquer folato
  natural/total que não esteja na whitelist. Não calcular conversões de
  biodisponibilidade por inferência.
- Energia/macros/fibras/sódio preservam os seis contratos existentes. Sódio de
  adição não se soma ao sódio total; não é um segundo valor de `sodioMg`.
- Não acrescentar colesterol, açúcares ou ácidos graxos nesta entrega por estarem
  próximos dos micronutrientes na planilha. DRI/IDR/UL permanecem na FOOD06.
- `Tr`, `NA`, ausente, `*`, `-`, valor negativo sentinela, unidade incompatível,
  IDs repetidos e valor zero com LOQ positivo não se tornam zero conhecido.
  No novo bloco de micros, conservar motivo e, quando existir, marcador original.
  A convenção histórica TACO `Tr -> 0` dos seis campos antigos não é reescrita.
- Zero numérico conhecido é válido. Falha de um micronutriente não destrói os
  demais valores válidos nem invalida os macros completos do alimento.

## Preservação e versionamento

TACO v1 (`AlimentoTaco`) só contém seis nutrientes; o loader grava apenas
categoria em `micronutrientes`. Não há como recuperar minerais/vitaminas desses
registros por leitura do banco. Preparar modo explícito novo no importador e
loader existentes, com versão de artefato `taco-4a-cmvcol-taco3-v2-micros1` e
novo esquema declarado. Continua sendo a edição científica de 2011, não uma
nova edição da TACO. O modo v1 continua reproduzível e seus hashes não mudam.

USDA preserva `metadadosOrigem.nutrientsOriginal`; IBGE preserva
`nutrientesOriginais`/`nutrientesNormalizados` e a referência. Um adapter puro,
versionado e validado pode usar esses registros íntegros para um **novo**
snapshot no rascunho. Nenhuma consulta de publicação antiga recaptura micros no
catálogo. Formatos/fonte/esquema desconhecidos ficam sem micros; nenhum Record
arbitrário é entregue ao navegador como contrato de nutrientes.

Novos snapshots cifrados guardam valores por 100 g e por porção, estados por
nutriente, fonte/release/base/hash já existentes e versão do mapeamento. Snapshots
legados sem o bloco permanecem legados, com micros ausentes. Modelo/receita/cópia
manual precisam preservar os campos permitidos, sem copiar o estado ON/OFF da
origem. Itens de catálogo continuam resolvidos pelo servidor.

## Direitos e operação

A política de fontes e as referências de licença já ficam no README dos dados,
nos manifests e na governança de ativação. A TACO exige atribuição; o importador
USDA registra CC0; o IBGE exige a referência documental de direito de uso já
prevista no projeto. Esta conferência de cabeçalhos não concede direitos novos
nem comprova o cadastro de aprovação de uma fonte em produção.

Preparar e testar a nova TACO foi confirmado pelo proprietário nesta rodada.
Carga externa é uma operação separada: confirmar alvo, role owner, direitos,
hashes, versão/base, idempotência e contagens pelo runbook. Não sobrescrever
fonte antiga, trocar IDs históricos, editar migrations 1072–1074 ou importar
TBCA. Sem schema novo previsto; o JSONB do catálogo e os snapshots cifrados já
acomodam o contrato aditivo. Qualquer necessidade comprovada de migration exige
novo arquivo e gate próprio, sem aplicar DDL externamente nesta etapa.
