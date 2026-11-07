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

## 4. O que foi implementado

- `dominio/fontes-por-nutriente.ts` (novo): `analisarFontesPorNutriente(planos)`. Mesma seleção
  (`selecionarItensCombinados`) e mesmo classificador da cobertura, agora exportado como
  `classificarContribuicao` sem mudar comportamento. Contribuinte = item `conhecidos`.
- Backend: campo aditivo `fontes` no cálculo ao vivo (`food06-factual-v1`, motor inalterado),
  `fontesPorNutriente` em `projetarRegistroFactual` e no relatório formato 2. Relatório formato 1 e
  o padrão ficam sem o campo. Nada novo é gravado: o registro persistido, seu hash e a igualdade
  canônica de `lerRegistroAnaliseFactual` não mudam; a origem é derivada na projeção.
- Web: `lerFontesPorNutrienteFactual` estrito e fail-closed, reconciliado com as contagens da mesma
  resposta; componente `origem-nutriente-factual.tsx`; detalhes da tabela e coluna "Origem
  registrada" no relatório formato 2. Resposta sem o campo continua legível e diz que a origem não
  foi disponibilizada, sem presumir fonte.
- Sem migration, dependência, lockfile, workflow, DRI ou alteração do BFF (o proxy repassa o corpo).

Exemplo sintético (cálcio, dois itens TACO 4.1 com zero conhecido): origem registrada com
"TACO · NEPA/Unicamp · versão 4.1 · 2 alimentos", `semOrigemDocumentada: 0`.

## 5. Evidências deste ciclo

Ambiente: Node 22.23.4, pnpm 11.25.0, dependências instaladas com `--frozen-lockfile` (lockfile
inalterado). Cada linha foi executada neste ciclo.

| Gate | Resultado |
| --- | --- |
| Backend, domínio novo (`fontes-por-nutriente.spec.ts`), RED antes da implementação | RED funcional: 21 falhas e 2 passes triviais; depois GREEN, 23 testes |
| Backend, integração das projeções (`fontes-por-nutriente-registro.spec.ts`) | PASS, 7 testes. Mutação comportamental da projeção: 3 falham, confirmando sensibilidade |
| Backend, árvore `src/modulos/planos-alimentares` | PASS: 87 suítes, 1.744 testes; 1 suíte SKIPPED (7 testes, integração PostgreSQL opt-in) |
| Backend `pnpm typecheck` e `pnpm build` | PASS |
| Web, runner `test:calculo-combinado-planos`, RED antes da implementação | RED funcional (13 e 3 falhas); depois PASS, 112 testes (92 anteriores + 20 novos) |
| Web `test:planos-alimentares:bff` e `test:linguagem` | PASS (150 testes; linguagem aprovada) |
| Web `typecheck` e ESLint dos arquivos alterados | PASS; 1 aviso preexistente em spec que não alterei |
| Browser desktop+mobile, `food06-tabela-factual` e `food06-contexto-historico` | 74 PASS, 8 SKIPPED (PDF real sem opt-in), 0 FAIL |
| Browser, PDF real com `FOOD06_PDF_REAL=true` (opt-in, `pdftotext`) | PASS, 8 testes; teste M01 do relatório com extração de texto do PDF também PASS |
| axe nas áreas alteradas (tabela e prévia do relatório) | Sem violações; não equivale a PDF/UA nem a leitor de tela humano |
| Web `pnpm build` (Next 16) | PASS, 196 páginas estáticas geradas |
| `scan-secrets` e `git diff --check` | PASS antes de cada commit |

Limite do PDF: `pdftotext` intercala linhas quebradas de células vizinhas; por isso o teste conta
o prefixo "Sem valor" (21 ocorrências) em vez da frase inteira.

Limite do CI: o resultado da etapa do Testcontainers foi lido pelo conclusão da etapa, não por teste individual. O script liga `FOOD06_REGISTRO_TESTCONTAINERS`, então a suíte do registro factual executa nessa etapa.

Não executados localmente:

- **PostgreSQL/Testcontainers/RLS: BLOCKED localmente.** O cliente Docker existe, mas o daemon não está
  acessível. A prova veio do CI (ver FT07, FT15, FT16 e FT17).
- `test:authz`: NA, nenhum BFF, permissão ou autorização foi alterado.
- HawkScan: NA. É DAST e esta mudança não cria rota nem endpoint novo; a chave também está ausente.
- CI: verde em `9e4c1fe5` (21 checks com sucesso e 1 SKIPPED, o Provenance do SBOM, SKIPPED também no histórico). Os commits posteriores ainda não têm CI.

## 6. FT01–FT20

| FT | Estado | Prova ou motivo |
| --- | --- | --- |
| FT01 | PASS | Spec de domínio e de projeção |
| FT02 | PASS | Fontes separadas e ordenadas, inclusive USDA Foundation e SR Legacy |
| FT03 | PASS | Só contribuintes conhecidos aparecem |
| FT04 | PASS | Zero conhecido contribui; browser mostra "0 mg" com origem |
| FT05 | PASS | Ausência não vira fonte nem zero |
| FT06 | PASS | Vínculo declarado como origem do registro; ferro desconhecido não herda a fonte do cálcio; limitação visível |
| FT07 | PASS | Em memória e em PostgreSQL (fonte e porção alteradas após o registro; relatório formato 2 idêntico antes e depois). Etapa do Testcontainers concluiu com sucesso: [run 42417421782, job Backend NestJS, commit `9e4c1fe5`](https://github.com/octanutri-clin/octaclin/actions/runs/42417421782/job/128538564935) |
| FT08 | PASS (domínio) | Quantidade, rendimento e fator no snapshot não alteram contagem nem origem. A matemática da receita não faz parte desta função |
| FT09 | PASS (escopo da função) | Só o que o seletor entrega contribui; refeição não selecionada fica fora. A escolha principal ou alternativa pertence ao seletor de M02, fora deste incremento |
| FT10 | PASS | Repetição em duas refeições conta duas vezes |
| FT11 | PASS | Estados incompatíveis não contribuem como fonte |
| FT12 | PASS | Item legado e resposta sem o campo continuam aceitos, com incerteza explícita |
| FT13 | PASS (contrato) | Teste de contrato: backend gera as respostas com o código real e a Web as lê com os leitores reais, comparando as mesmas linhas. Não passa por HTTP nem por banco; ver seção 10 |
| FT14 | PASS (contrato e navegador) | Relatório formato 2 no contrato, na prévia e no PDF real, inclusive com 50 grupos de fonte e com origem ausente. Respostas simuladas, sem HTTP real |
| FT15 | PASS | Negativas do formato 2 (outro paciente 404, outro tenant 403, sem permissão de gerenciar 403) no spec PostgreSQL; etapa do Testcontainers com sucesso no CI ([run 42417421782, job Backend NestJS, commit `9e4c1fe5`](https://github.com/octanutri-clin/octaclin/actions/runs/42417421782/job/128538564935)) |
| FT16 | PASS | Revogação por transferência de carteira no relatório formato 2 pela API real (404), no spec PostgreSQL; etapa do Testcontainers com sucesso no CI ([run 42417421782, job Backend NestJS, commit `9e4c1fe5`](https://github.com/octanutri-clin/octaclin/actions/runs/42417421782/job/128538564935)) |
| FT17 | PASS | Cipher inalterado após alteração da fonte, em PostgreSQL; etapa do Testcontainers com sucesso no CI ([run 42417421782, job Backend NestJS, commit `9e4c1fe5`](https://github.com/octanutri-clin/octaclin/actions/runs/42417421782/job/128538564935)) |
| FT18 | PASS | Manual e custom só com o tipo, sem versão ou código fictícios |
| FT19 | PASS | Limite de 50 grupos, não detalhadas reconciliadas, ordem determinística (backend e Web) |
| FT20 | PASS | Referências continuam indisponíveis; nenhum percentual ou RDA/AI/UL |

## 7. Revisões

- **R4 independente (somente leitura):** feita por um subagente revisor, que não escreveu o código, sobre `9e4c1fe5`.
  Nenhum P0 ou P1; 4 achados P3. Ele **não executou testes**. Ver `tasks/food06-m01-revisao-r4.md`. Não substitui
  revisão humana de segurança.
- **UX:** a etapa A **não** foi executada antes da implementação (lacuna). A etapa C foi repetida com um subagente
  de runtime com o papel de nutricionista, sem ferramentas e sem ver a interface (modalidade "papel fornecido").
  Paciente N/A justificado. Ver `docs/agents/ux/reports/FOOD06-M01-BC-2026-11-07/`. O subagente não encontrou defeito
  comprovado e pediu NUX06 e NUX07 como condição de aceite; ambos foram cobertos por teste de navegador. NUX01 a 03,
  09, 10 e 13 seguem para decisão do proprietário.

## 8. Critérios e maturidade

| Critério | Estado | Observação |
| --- | --- | --- |
| M01-C1 | Provado pelo teste de contrato; **não promovido** | Zero conhecido e cobertura por nutriente, nas três superfícies do backend e nos leitores Web |
| M01-C2 | Provado pelo teste de contrato; **não promovido** | Cinco estados com motivos, contagens e origens documentadas. O vínculo por célula **não** é afirmado |
| M01-C3 | Provado pelo teste de contrato; **não promovido** | Subtotal parcial sem total nem percentual; mesmos dados em API ao vivo, registro e relatório formato 2; legados legíveis |

"Provado pelo teste de contrato" significa: verificado por teste automatizado com dados sintéticos, sem HTTP real
entre processos. Fechar o critério na matriz canônica é decisão do proprietário e a matriz não foi alterada. Os 50%
administrativos permanecem inalterados. M02, M03, M05 e M08 não recebem promoção.

Três eixos: **implementação** concluída para o escopo; **validação** forte (domínio, projeções, contrato, PostgreSQL
no CI, navegador e PDF real); **dependências** abertas: revisão humana, decisão do proprietário e CI dos commits novos.

## 9. Próxima tarefa única recomendada

Decisão do proprietário sobre fechar M01-C1, C2 e C3 na matriz canônica e sobre o backlog de UX (M01-NUX10 em
especial). Não iniciada.

## 10. Teste de contrato de M01-C1, C2 e C3

- Backend: `aplicacao/fontes-por-nutriente-contrato.spec.ts` (12 testes). Usa o código real para gerar, de um cenário
  sintético, as respostas do cálculo ao vivo, da projeção do registro e do relatório formatos 1 e 2, e as grava no
  fixture `octaclin-web/scripts/fixtures/food06-m01-contrato.json`. **Falha se o fixture divergir do que o backend
  produz hoje**; regenerar de propósito com `ATUALIZAR_FIXTURE_FOOD06_M01=true`.
- Web: `scripts/food06-m01-contrato.spec.ts` (5 testes), no runner `test:calculo-combinado-planos`. Lê o mesmo fixture
  com os leitores reais da tabela e do relatório.
- Cenário: três alimentos (TACO 4.1, USDA Foundation 2025.4, composição manual) que produzem COMPLETO (zinco),
  PARCIAL (cálcio e ferro, este com zero conhecido), DESCONHECIDO (magnésio), INCOMPATIVEL (manganês) e, em um segundo
  cenário sem alimentos, INDISPONIVEL.
- O que o teste prova: C1 (zero conhecido contribui, ausência não; contagens diferentes por nutriente com os mesmos
  alimentos), C2 (cinco estados, motivos, contagens, origens separadas por tipo e fonte, reconciliação), C3 (subtotal
  parcial sem total, sem chave de percentual ou referência, cobertura e origem idênticas nas três saídas, formato 1 e
  respostas antigas legíveis, adulteração recusada).
- Limite: não passa por HTTP nem por banco; isso é coberto pelo spec PostgreSQL e pelos testes de navegador, que
  usam respostas simuladas. O teste de contrato impede que o backend e a Web divirjam, mas não prova a rede real.
