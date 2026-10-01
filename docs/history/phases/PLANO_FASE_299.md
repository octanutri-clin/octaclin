# Fase 299 — catálogo alimentar multifonte

## Estado e risco

Implementação local concluída em `feat/fase299-catalogos-alimentares`, baseada na
`main` após o PR #356. A migration 1060 foi confirmada pelo proprietário. Risco
R4: dados nutricionais entram em cálculos clínicos e a carga requer governança
de banco. Nenhuma carga externa ou migration foi executada nesta fase. Integração
e CI remotos permanecem pendentes.

## Objetivo e decisões

- Manter TACO existente e incluir USDA FoodData Central e IBGE POF 2008–2009.
- USDA será consumida por artefatos oficiais locais, sem chamada de API durante
  a busca. Foundation Foods e SR Legacy ficam em fontes/bases/releases separadas.
- IBGE será importado de arquivo local oficial. Sua ingestão terá conversor
  próprio para o XLS legado; USDA terá parser próprio para JSON oficial. Não
  forçar as fontes a um único formato ou mecanismo de ingestão.
- O proprietário confirmou que possui autorização documentada para carga ativa
  do IBGE. O comando de carga exigirá referência e responsável pela autorização;
  nenhum documento privado será versionado ou exposto em logs.
- TBCA não será implementada nesta fase.
- Identidade persistida: fonte/versionamento em `fontes_composicao_alimentos`,
  identificador externo original em `codigo_origem`, único dentro da fonte. No
  IBGE, `externalId` combina código do alimento e código da preparação. Isso
  conserva preparos distintos e deixa o catálogo aberto a fontes futuras como
  `custom` sem enum fechado.
- USDA, IBGE e TACO nunca são mescladas nem deduplicadas por semelhança. A busca
  sempre exibe fonte, edição/versão e base. Snapshots publicados permanecem
  imutáveis.
- Reutilizar as tabelas e governança atuais das migrations 1028–1030. Migration
  1061 amplia a escala numérica dos nutrientes de quatro para oito casas para
  preservar os valores publicados; o rollback verifica perda antes de reduzir
  a escala. Nenhuma migration será executada externamente nesta fase.

## Evidência e limites dos dados

- USDA FoodData Central publica arquivos JSON de Foundation Foods e SR Legacy;
  os conversores preservarão FDC ID, data type, release, nutrientes e metadados
  originais. Foundation Foods e SR Legacy não compartilham identidade.
- O arquivo completo IBGE POF 2008–2009 contém 1.971 linhas de alimentos e 43
  colunas, incluindo código/nome do alimento, código/descrição de preparação,
  referência/citação e 37 campos nutricionais por 100 g de parte comestível.
  Valores `-` permanecem ausentes, não zero. O conteúdo é uma compilação com
  múltiplas fontes; a autorização de uso deve acompanhar a execução da carga.
- Nenhum catálogo derivado será introduzido automaticamente em staging ou
  produção. Os operadores executarão a carga deliberadamente com banco e role
  confirmados, seguindo o runbook e a governança atual.

Fontes oficiais consultadas em 2026-10-01:

- USDA downloads e documentação: <https://fdc.nal.usda.gov/download-datasets/> e
  <https://fdc.nal.usda.gov/data-documentation/>
- IBGE POF, arquivos: <https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/Tabelas_de_Composicao_Nutricional_dos_Alimentos_Consumidos_no_Brasil/>
- IBGE descrição e publicação: <https://www.ibge.gov.br/estatisticas/sociais/populacao/24786-pesquisa-de-orcamentos-familiares-2.html>
- TACO/NEPA: <https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf>
- TBCA (fora do escopo): <https://www.tbca.net.br/base-dados/composicao_estatistica.php>

## Contrato canônico compartilhado

- Os dois conversores independentes produzem registros compatíveis com o modelo
  existente: `externalId`, nome original, preparação, base em gramas, nutrientes
  calculáveis e JSONB de metadados/nutrientes originais.
- Fonte, versão, base, URL/referência, licença/autorização, checksums e hash do
  conteúdo ficam no registro versionado da fonte/importação. Cada registro
  aponta para essa fonte e mantém `codigo_origem` estável.
- Mapear energia (kcal), proteína (g), carboidrato (g), lipídios (g), fibra (g)
  e sódio (mg). Unidade ou marcador não numérico desconhecido nunca vira zero.
  Nutrientes adicionais, descrições de referência e códigos de preparação ficam
  preservados no JSONB de origem. Valores USDA negativos permanecem na origem,
  marcados no manifesto, e ficam ausentes do valor calculável para evitar uma
  composição inválida; o registro fica indisponível se isso retirar um nutriente
  essencial.
- Buscar e exibir alimentos sem composição essencial completa, marcando-os como
  indisponíveis para cálculo conforme o contrato atual; não descartar os demais
  dados publicados. Apenas registros selecionáveis passam pelo cálculo.
- Não traduzir automaticamente nomes USDA. Busca e filtros identificam
  inequivocamente `USDA`, `IBGE` ou `TACO`, com base/versão na mesma linha.
- A importação idêntica é idempotente. Hash/identidade divergentes falham sem
  sobrescrever fonte ou alimentos anteriores. Versões novas são aditivas.
- Conversores validam tamanho, estrutura, cabeçalhos, tipos, valores, IDs
  repetidos e hashes. A carga usa transação, ator, referência de direito,
  confirmação literal, banco esperado, lotes limitados e auditoria existente.
  Runtime segue somente leitura.

## Etapas e critérios de aceite

1. Atualizar o plano e registrar as decisões após revisão do diff. **Concluído**.
2. TDD para contratos canônicos, parser USDA JSON e parser IBGE XLS; testar
   ausência, zero, unidade, duplicidade, preparação, metadados e hashes.
3. Criar conversores separados, manifests reproduzíveis e passos de geração
   local sem versionar cópias de origem ou dados derivados protegidos.
4. Implementar cargas separadas e idempotentes sobre as mesmas entidades e
   tabelas de auditoria; manter verificações de banco/ator/direitos e não
   executar carga remota.
5. Integrar resultados à busca existente, apresentar fonte/versão/base e
   metadados de origem, preservar seleção e snapshots existentes. Validar que
   resultados de fontes diferentes não se mesclam.
6. Documentar geração e atualização USDA/IBGE e variáveis necessárias, inclusive
   a referência de autorização IBGE; não pedir nem imprimir secrets.
7. Atualizar checklist/status/auditoria/matriz de confiabilidade conforme
   aplicável, revisar diff e executar testes focados, lint, typecheck, diff check
   e scan de secrets. Não abrir PR até validações locais concluírem.

Aceite: USDA e IBGE preservam identificadores, versão/referência e dados de
origem; cada parser possui fluxo próprio; TACO continua disponível; fontes não
se mesclam; busca exibe a origem claramente; ausência não é convertida em zero;
cargas são reproduzíveis, governadas e idempotentes; não há migration/carga
externa sem autorização e alvo explícitos.

## Gaps revistos e soluções

| Gap | Solução |
| --- | --- |
| Plano anterior excluía IBGE e descrevia ingestão USDA específica | Plano atualizado para USDA offline e IBGE local com conversores independentes |
| Código/preparação IBGE colidiriam se apenas o código do alimento fosse usado | `externalId` composto pelos códigos originais de alimento e preparação |
| Nutrientes IBGE usam `-` e têm campos além do cálculo atual | Marcadores ausentes preservados como `null`; todos os campos e unidade original ficam nos metadados |
| Nome descritivo de referência IBGE pode exceder limite da coluna | Nome de busca fica no campo existente; descrição completa e citação vão para metadados |
| Autorização IBGE confirmada, mas documento privado não pode ir ao Git | Carga exige referência externa e responsável via ambiente operacional; registra referência sanitizada no controle existente |
| Carga poderia alcançar banco com nome correto usando role de runtime | Exigir comparação exata de `current_database()` e `current_user` com banco e role owner esperados; cobertura positiva e negativa |
| Dados incompletos poderiam ser apagados ou entrar em cálculos | Preservar registros; usar a validação atual para indicar `disponivelParaCalculo` e bloquear seleção inválida |
| Escala numérica antiga arredondava composições publicadas acima de quatro casas | Migration 1061 amplia os seis campos calculáveis a oito casas; rollback recusa reduzir quando houver perda |
| Fundação USDA contém alguns nutrientes negativos de medição | Preservar valores originais, sinalizar no manifesto e guardar `null` no campo calculável |
| Identidade poderia ser misturada por equivalência entre fontes | Fonte versionada + código externo original; sem crosswalk/deduplicação automática |
| Arquivos podem mudar entre geração e carga | SHA-256 da origem e do conteúdo normalizado; reexecução divergente falha |
| Catálogos maiores podem expor rótulo ambíguo | Código/nome da fonte, versão e base visíveis em resultados e filtros |

## Skills e fechamento

Skills: `agent-skills:planning-and-task-breakdown`,
`agent-skills:incremental-implementation`, `test-driven-development`,
`nestjs-best-practices`, `typeorm`, `postgresql-table-design`,
`database-migration`, `security-review` e `fechar-fase`.

## Fechamento local

- **PASS** — 5 suites Jest focadas, 55 testes: importadores multifonte, busca de
  planos, migration 1061, catálogo TACO existente e validação de banco/role de
  carga.
- **PASS** — typecheck backend e Web em Node 22.23.3.
- **PASS** — 3 testes Python do conversor IBGE com dependência instalada via
  hash fixado.
- **PASS** — conversão dos arquivos oficiais USDA Foundation Foods e SR Legacy,
  e do XLS IBGE POF em diretório temporário; 346, 7.793 e 1.971 registros
  normalizados, respectivamente. A validação IBGE preservou os 37 nutrientes,
  14.336 marcadores `-` e 659 registros incompletos sem torná-los selecionáveis.
- **PASS** — `pnpm security:secrets`, teste `test:migracoes-fora-de-banda` (13)
  e `git diff --check`.
- **PASS com avisos preexistentes** — lint Web terminou com zero erros e 62
  avisos existentes em arquivos não alterados nesta fase.
- **SKIPPED** — carga de catálogo, migration 1061 em banco, prova PostgreSQL/RLS,
  CI, revisão cruzada e validação de produção. Não foram autorizados/realizados
  nesta execução local; precisam ocorrer nos gates e procedimentos externos.
- **NA** — migration de rollback não executada; seu `down()` falha antes de
  reduzir escala se encontrar dados que seriam arredondados.

Próxima ação: abrir o PR desta branch para executar os gates remotos. Após merge,
confirmar banco/branch/role pelo runbook, aplicar 1061 fora de banda, conferir o
schema e só então executar cada carga com a autorização operacional e referência
documental fornecida. Se houver necessidade de rollback, suspender a fonte; não
reduzir a escala enquanto os valores excederem quatro casas decimais.
