# FOOD06 M01 — rastreabilidade factual de fontes por micronutriente

Documento de trabalho do incremento. Este arquivo registra diagnóstico, decisões,
provas e limites. Não substitui `AGENTS.md`, a matriz canônica nem decisões do
proprietário, e não promove M01 por si só.

## 1. Contexto e identificação

- Repositório `octanutri-clin/octaclin`; branch de trabalho `claude/amazing-feynman-3ujs0z`.
- Base de código: `137aa547` (HEAD da PR #455). Base documental: `cf1e52ad`
  (guia do Claude + seis relatórios reconstruídos pelo Codex).
- O código M01 anterior foi perdido no TEMP, sem commit nem push. Nada daquela
  execução (testes, pareceres, contagens) é usado como prova aqui.
- Os seis relatórios de auditoria existentes em `tasks/` são reconstruções, não os
  originais de `cfaa42f5`. Foram lidos `food06-auditoria-consolidada.md` e
  `food06-pendencias-por-criterio.md`.
- Autorização do proprietário nesta sessão: implementar o incremento, fazer push da
  branch e abrir PR, pausando após o envio até o resultado dos checks do GitHub. Merge
  **não** foi autorizado.

## 2. Diagnóstico por superfície (base `137aa547`)

Perguntas do guia, respondidas pelo código lido:

1. **Onde estão congelados composição, quantidade e metadados de origem?**
   No snapshot de composição de cada item (`SnapshotComposicao`): `origem`
   (`catalogo|manual|custom`), `fonte.{codigo,versao,baseCodigo,hashConteudo,esquemaVersao}`
   e o bloco `micronutrientes` com estado por nutriente. No registro factual persistido,
   `projetarSnapshot` (construtor) preserva esses campos em `versao.estado.refeicoes[].itens`.
2. **A origem é do alimento/composição ou comprovadamente da célula?**
   Do registro de composição do item. O bloco de micronutrientes é extraído do mesmo
   registro de fonte (`extrairMicronutrientesFonte`), mas o snapshot não guarda
   "qual base mediu este nutriente". O vínculo é, portanto, origem do registro de
   composição que contém o valor congelado, e a limitação deve ser dita.
3. **O que snapshots antigos preservam?** Itens sem `micronutrientes` caem em
   `legado_sem_composicao`; itens sem `fonte` seguem sem origem. Nada é completado
   a partir do catálogo vivo.
4. **Que serviço autorizado já leu esses dados?** O cálculo ao vivo
   (`executarCalculoCombinado`, após carteira/papel/permissão) e a leitura do registro
   (`consultarApi` → `decifrarRegistro`). Nenhuma query nova é necessária.
5. **O que sai hoje e o que se omite?** Ver tabela.

| Superfície | Comportamento existente | Lacuna demonstrada | Mudança mínima | Teste |
| --- | --- | --- | --- | --- |
| Domínio `cobertura-dietetica.ts` | Cinco estados, contagens e causas por nutriente. O classificador `classificar` decide quem é "conhecido" (inclui zero conhecido) | Não carrega nenhuma origem | Exportar o classificador, sem mudar comportamento | Spec existente permanece verde |
| API cálculo ao vivo (`analisarMicronutrientes`, `food06-factual-v1`) | `calculo`, `cobertura`, `ajuda`, `comparacoes` | Sem origem por nutriente | Campo opcional aditivo `fontes`, derivado dos mesmos itens | Novo spec de domínio + serviço |
| API registro (`projetarRegistroFactual`) | Análise/cobertura congeladas; `lerRegistroAnaliseFactual` recalcula e compara a análise com o gravado | Idem. Gravar campo novo no registro quebraria a igualdade canônica de registros antigos | Derivar na projeção a partir de `versao.estado`; não alterar envelope, hash nem versão persistida | FT07/FT12/FT17 |
| Relatório M08 (`resumirFontesRegistro`, formato 1/2) | Resumo global por tipo/versão em itens incluídos, até 50 grupos; não diz quais nutrientes cada origem sustenta | Não responde "de onde veio o subtotal de ferro" | Formato 2 recebe `fontesPorNutriente` aditivo; formato 1 e default intactos | FT14 |
| Detalhes M02 (`projetarOrigemContribuicao`) | Origem por item (tipo, versão, nome, preparo, base) | Já completo por item; não precisa mudar | Nenhuma | Regressão |
| Web tabela (`lerLinhaMicronutrienteFactual`) | Estado, contagens, causas, valor | Não exibe origem | Ler `fontes` opcional; mostrar em "detalhes" da linha | Specs web + browser |
| Web relatório (`lerRelatorioFactual`) | Valida resumo global estrito | Sem origem por nutriente | Ler `fontesPorNutriente` opcional no formato 2 | Spec web |

Regra de reconciliação (propriedade a provar): para cada nutriente, a soma das
quantidades das origens + `semOrigemDocumentada` + `fontesNaoDetalhadas` é igual a
`cobertura.contagens.conhecidos` do mesmo nutriente.

## 3. Regra de proveniência adotada

- Só contribuem os itens que o classificador existente conta como `conhecidos`.
  Zero conhecido contribui. Ausente, traço, não analisado, abaixo do LOQ, em
  reavaliação, duplicado, inválido e incompatível **não** aparecem como fonte.
- A origem é a do registro de composição congelado do item. O campo
  `vinculo = "origem_do_registro_de_composicao"` declara que isso não atesta que a
  base mediu aquele nutriente, nem que há confiança científica.
- Grupo = `tipo` (`baseCodigo`: TACO/USDA/IBGE, ou manual/custom) + `codigo` da fonte
  (separa, por exemplo, subfontes USDA) + `versao` quando presente. Versão ausente ou
  malformada permanece desconhecida. Nada é preenchido pelo catálogo atual.
- Item conhecido sem origem utilizável conta em `semOrigemDocumentada`.
- Seleção idêntica à da cobertura (`selecionarItensCombinados`): refeição desativada ou
  não selecionada não contribui; item repetido em duas refeições conta duas vezes.
- Saída por allowlist reconstruída campo a campo. Sem hash, nome livre, ID clínico nem
  ciphertext. Ordem determinística e limite de 50 grupos por nutriente com
  `fontesNaoDetalhadas`.

## 4. Plano e estado

| Etapa | Estado |
| --- | --- |
| Diagnóstico (este documento) | feito |
| Domínio `fontes-por-nutriente` com RED/GREEN | pendente |
| API cálculo ao vivo + registro + relatório formato 2 | pendente |
| Web: leitores, tabela/detalhes, relatório | pendente |
| Revisão UX (A/B/C), R4 e regressões | pendente |
| PDF real e PostgreSQL/RLS | pendente; dependem de ambiente |

## 5. FT01–FT20

Todos **NOT RUN** neste momento. Serão atualizados com comando, commit e resultado
reais. PASS só com evidência produzida neste ciclo.

## 6. Critérios

| Critério | Estado | Observação |
| --- | --- | --- |
| M01-C1 | PARCIAL ponta a ponta (domínio preservado) | Aguarda prova nas novas projeções |
| M01-C2 | PARCIAL | Aguarda origem por nutriente nas superfícies |
| M01-C3 | PARCIAL | Aguarda reconciliação API/tabela/detalhes/relatório |

Os 50% administrativos da matriz permanecem inalterados.
