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
| Backend, árvore `src/modulos/planos-alimentares` (rodada de fechamento de lacunas) | PASS: 89 suítes, 1.781 testes; 1 suíte SKIPPED (7 testes, integração PostgreSQL opt-in, executada no CI) |
| Backend `pnpm typecheck` e `pnpm build` | PASS |
| Web, runner `test:calculo-combinado-planos`, RED antes de cada implementação | RED funcional em cada rodada; PASS final, 134 testes (92 anteriores + 42 novos) |
| Web `test:planos-alimentares:bff` e `test:linguagem` | PASS (150 testes; linguagem aprovada) |
| Web `typecheck` e ESLint dos arquivos alterados | PASS; 1 aviso preexistente em spec que não alterei |
| Browser desktop+mobile, `food06-tabela-factual` e `food06-contexto-historico`, com `FOOD06_PDF_REAL=true`, rodada de fechamento de lacunas | 93 PASS e 1 FAIL na rodada completa: corrida de tempo preexistente no teste de PDF do relatório versionado (mobile), que afirmava o fim do PDF antes de ele terminar. Passou 12 de 12 isolado; corrigida a espera e o spec do histórico passou 22 de 22. Não foi ignorado nem pulado |
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

- **R4 independente do incremento (somente leitura):** subagente revisor sobre `9e4c1fe5`; nenhum P0 ou P1; 4 achados
  P3. Não executou testes. Ver `tasks/food06-m01-revisao-r4.md`.
- **Revisão de segurança de C2 (pode executar testes, sem editar):** subagente revisor sobre `05e7f1f8`. Confirmou que
  **não há caminho de falsa procedência** (o servidor decide `origem` e `fonte`; o DTO recusa os campos), mas encontrou um
  **defeito P1 real**: a origem exigia `baseCodigo` TACO/USDA/IBGE e versão numérica, valores que a produção não grava.
  Com dados reais todo contribuinte de catálogo cairia em "sem origem documentada", e a suíte passava porque usava
  valores sintéticos. **Confirmei nas migrações e no serviço de catálogos e corrigi** (resolvedor único por par
  `codigo`/`baseCodigo`, usado também pelo resumo global do M08, que tinha o mesmo defeito antes deste trabalho). Também
  corrigidos o resumo histórico (R4C2-02), o rótulo (R4C2-03) e a correspondência causa→categoria (R4C2-04). Ver
  `tasks/food06-m01-revisao-c2.md`.
- **UX:** a etapa A da entrega original **não** foi executada antes da implementação (lacuna). Depois, uma etapa A real
  foi feita sobre as melhorias NUX, antes de implementá-las (`etapa-a-nuxa.md`). A etapa C foi repetida com um subagente
  (papel fornecido, sem ferramentas, sem ver a interface). Paciente N/A justificado. O proprietário leu e considerou
  válidas as melhorias NUX01, 02, 03, 09, 10 e 13, que foram implementadas. NUXA11 (contagem-resumo) e a autoria da
  entrada manual ficam fora, por serem escopo novo.

## 8. Critérios e maturidade

| Critério | Estado | Observação |
| --- | --- | --- |
| M01-C1 | Provado pelo teste de contrato; **não promovido** | Zero conhecido e cobertura por nutriente, nas três superfícies do backend e nos leitores Web |
| M01-C2 | Provado pelo teste de contrato com os pares reais de produção; **não promovido** | Cinco estados com motivos, contagens e origens documentadas. O vínculo por célula **não** é afirmado. Antes da correção de R4C2-01 a prova usava valores sintéticos e **não valia para dados reais** |
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

- Backend: `aplicacao/fontes-por-nutriente-contrato.spec.ts` (13 testes; inclui o resumo histórico). Usa o código real para gerar, de um cenário
  sintético, as respostas do cálculo ao vivo, da projeção do registro e do relatório formatos 1 e 2, e as grava no
  fixture `octaclin-web/scripts/fixtures/food06-m01-contrato.json`. **Falha se o fixture divergir do que o backend
  produz hoje**; regenerar de propósito com `ATUALIZAR_FIXTURE_FOOD06_M01=true`.
- Web: `scripts/food06-m01-contrato.spec.ts` (6 testes), no runner `test:calculo-combinado-planos`. Lê o mesmo fixture
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

## 11. Limites que o contrato e as correções não cobrem

- O contrato usa os **pares reais** `codigo`/`baseCodigo` do catálogo governado, mas não foi executado contra o banco
  real; as versões de USDA e IBGE usadas nos testes são exemplos de formato, não valores confirmados.
- Snapshots históricos congelados com outra identificação de fonte aparecem como "sem origem documentada".
- Cabeçalho repetido por página em impressão de várias páginas e a continuação de uma célula longa sem o nome do
  nutriente não foram medidos (dependem do navegador; só o PDF real com 50 grupos foi verificado).

## 12. Rodada de fechamento de lacunas

Origem: avaliação crítica do que foi feito (NUX das etapas A, B e C e lacunas do trabalho). Itens resolvidos, com a prova:

| # | Lacuna ou erro | Resolução | Prova |
| --- | --- | --- | --- |
| 1 | A origem por nutriente só estava no relatório com contexto (formato 2), que exigia marcar "Carregar contextos registrados" e expandir o contexto; análises sem contexto só tinham o formato 1 | Botão "Conferir relatório com origem por nutriente" para toda análise sem contexto; o formato padrão da API não mudou | Teste de navegador: o pedido sai com `versaoRelatorio: 2`, a coluna aparece e o axe não acusa violação |
| 2 | O histórico não mostrava origem | O resumo histórico carrega `fontesPorNutriente`; a célula de cobertura do nutriente selecionado mostra a linha de origem | Contrato backend→leitor Web **real** do histórico; teste de navegador |
| 2b | **Erro meu, achado nesta rodada:** a mudança acima faria o leitor Web do histórico recusar o campo novo (lista estrita de chaves), quebrando a tela | O leitor passou a aceitar e validar `fontesPorNutriente`, reconciliado com as contagens do mesmo ponto | RED funcional antes da correção; teste de contrato com o leitor real |
| 3 | Rótulo "composição informada manualmente" nos detalhes por alimento (M02) | "Entrada manual (valores digitados no cadastro do alimento)" | Busca no código: nenhum texto antigo restante |
| 4 | "Fonte não catalogada" era código morto e uma fonte desconhecida virava "sem origem documentada" | O backend emite o grupo `nao_catalogada` (sem código, versão ou texto livre); a interface o trata como ponto de atenção | Testes de domínio e de leitor; canário de texto livre |
| 5 | Resumo global (M08) agrupava por tipo e versão, juntando USDA Foundation e SR Legacy | Agrupa também por código; leitor Web e relatório mostram o código | Testes backend e Web |
| 6 | Ordenação do backend dependia de ICU | Ordem por minúsculas e depois binária | Teste de ordem |
| 8 | Severidade só visual | Texto oculto "Atenção:" ou "Informação:" | Verificado no markup e no axe |
| 9 | O contrato não exercia o método real do serviço | `analisarMicronutrientes` real é chamado; só o wrapper privado é simulado | Mutação no serviço: 5 testes falham |
| — | A11 (contagem-resumo) e filtro por origem | "Entrada manual em N de 22 nutrientes", linha de "origem a conferir" e filtro "Origem dos dados" (só aparece quando a resposta traz origem) | Testes unitários e de navegador (desktop e mobile) |
| — | Prova de C1 só com valor somado | Cenário em que o **único** valor de ferro é zero: `0` estrito na tabela, no histórico e no relatório; cálcio ausente sem valor nem origem | Contrato backend e Web |

### Itens que estavam "não verificados" e o que se apurou

| Item | Resultado |
| --- | --- |
| Snapshots históricos com outra identificação de fonte | A migração 1028 define `base_codigo = codigo` para as fontes existentes e `baseCodigo` é opcional no snapshot: snapshots anteriores não têm `baseCodigo`. Passaram a ser reconhecidos pelo código; `baseCodigo` presente e divergente continua recusado |
| Versões reais de USDA e IBGE | **Não estão no repositório.** A versão de USDA é argumento livre (`--versao`) e a governança só exige que não seja vazia. O formato aceito foi relaxado para rótulo livre (letras, números, espaço e pontuação comum, até 64 caracteres, sem markup). Os valores reais de produção continuam não confirmados |
| Impressão de várias páginas | Medido em PDF real de 8 páginas (A4): o cabeçalho com a legenda se repete em todas as páginas. **Encontrado e corrigido** um defeito: as páginas que continuavam a lista longa não traziam o nome do nutriente |
| Celular real | **Não verificável aqui.** Só Chromium em viewport mobile |
| CI dos últimos commits | A falha "Governanca de repositorio" é o job do inventário de segurança: `SQ-2026-004` com revisão vencida por data (hoje, 08/11). Reproduz localmente, a branch não altera o inventário e o histórico do repositório registra a mesma falha preexistente na `main`. **Não foi alterada a data**, por ser uma revisão de segurança do proprietário |
| Resultado por teste do PostgreSQL | **Não recuperável** pelo log do CI (a saída do Jest fica fora da janela do log); só a conclusão da etapa |
| Independência das revisões | **Não resolvível por mim:** as duas revisões de segurança e a UX são de subagentes; falta revisão humana |

### Estado dos critérios

C1, C2 e C3 seguem **provados pelo teste de contrato e não promovidos** na matriz canônica; a decisão continua do proprietário. O contrato agora cobre quatro superfícies (tabela, registro, histórico e relatório), o zero conhecido como valor `0` e o método real do serviço.

## 13. Pontos remanescentes tratados em seguida

### Ponto 2: versão de fonte com caracteres fora do conjunto aceito
A coluna `fontes_composicao_alimentos.versao` é `varchar(80)` e a governança só exige que a versão não seja vazia; a regra
anterior (rótulo "seguro" de até 64 caracteres) descartaria versões legítimas e mostraria "versão não informada" mesmo com
versão registrada. Nova regra, igual no backend e na Web: qualquer caractere imprimível, até 80, sem espaço nas pontas;
recusa markup (`<`, `>`) e caracteres de controle. Testes com `#`, `&`, acentos, travessão e 80 caracteres (aceitos) e com
81 caracteres, markup, controle, quebra de linha e espaço nas pontas (recusados).

### Ponto 4: origem derivada na leitura muda retroativamente se o mapa mudar
Não foi gravado o campo no registro (mudaria o envelope persistido, R4). O mapa de fontes agora é **append-only e
congelado por teste** (`dominio/fonte-catalogo.spec.ts`): as quatro entradas, um corpus de 14 snapshots históricos com
resultado esperado e a imutabilidade em execução. Alterar uma entrada existente quebra o CI (verificado por mutação: 2
testes falham). Acrescentar uma entrada exige decisão do proprietário, nova versão do mapa e novas linhas no teste.
Alternativa não adotada: gravar a origem no registro, o que exigiria nova versão de envelope e aprovação própria.

### Ponto 5: deploy desencontrado entre Web e backend
Havia duas quebras com uma Web antiga e o backend novo: o leitor do histórico recusa chaves extras e o resumo global do
relatório recusa grupos que só diferem por código. Resolvido com o padrão que o código já usa para `incluirContexto`:
`incluirOrigem` é **opt-in booleano** no histórico e no relatório (este só no formato 2). Sem a flag, a resposta é a de
antes, byte a byte no formato (o resumo global volta a agrupar por tipo e versão, sem `codigo`). A Web nova pede a origem.

**Ordem de implantação: backend primeiro, depois a Web.** Uma Web nova contra um backend antigo recebe 400 do DTO (campo
não permitido) ao pedir a origem. O inverso (Web antiga, backend novo) funciona sem mudança.

### Ponto 6: tamanho da resposta do histórico
Não há teto de resposta no BFF nem no backend (os limites existentes são de corpo de pedido: 16 KiB no BFF e 100 KiB no
backend; o único limite do servidor é 10 MiB de texto cifrado lido por página). Medido (bytes, uma página de 10 análises):

| Cenário | Sem origem | Com origem | Relatório formato 2 | `fontes` ao vivo |
| --- | --- | --- | --- | --- |
| Típico (3 fontes) | 58.144 | 120.104 | 17.383 | 6.174 |
| Realista alto (15 grupos por nutriente) | 58.814 | 302.274 | 36.493 | 24.324 |
| Limite do contrato (50 grupos) | 58.794 | 971.934 | 106.487 | 91.292 |

A origem **dobra** a página mesmo no caso típico, porque é enviada para os 22 nutrientes e a tela mostra um por vez. O pior
caso do contrato fica abaixo de 1 MiB. Orçamentos fixados em teste (`projecao-historico-tamanho.spec.ts`, com ~25% de
folga) e a página sem origem protegida para clientes que não a pedem. O gzip local (2 a 16 KB) é só um limite inferior,
pois comprimiu cópias idênticas; não há compressão configurada no backend. Opções futuras, não feitas: enviar a origem só do
nutriente selecionado ou uma tabela de fontes única referenciada por índice.

### Inventário de segurança (`SQ-2026-003` / `SQ-2026-004`)
- **`SQ-2026-003` não existe** no inventário. IDs: `SQ-2026-004`, `139`, `239` a `249`.
- Vencidas por data em 07/11: `SQ-2026-004`, `SQ-2026-240` e `SQ-2026-248` (as três críticas). Vencem hoje (08/11): `139`,
  `239`, `241`, `242`, `243` e `244`.
- O validador limita `revisarEm` a um teto (14 dias para crítica) contado a partir de `capturadoEm` (24/10). Estender a data
  sem **recapturar** os alertas exige uma `excecao` rastreável, e o próprio repositório descreve isso como "a máquina de falso
  verde que o inventário existe para impedir".
- Disparei o workflow de captura do repositório (somente leitura). O passo "Capturar inventário" falhou com
  **`401 Bad credentials`** em `/branches/main`: o segredo `INVENTARIO_GITHUB_TOKEN` existe, mas está inválido, expirado ou
  revogado. Sem ele não há dados novos de alertas e a revisão não pode ser feita de forma legítima. **Nenhum campo do
  inventário foi alterado.**
- Ação do proprietário: renovar o token (Dependabot alerts: read, Code scanning alerts: read, Secret scanning alerts: read),
  reexecutar o workflow `Inventario Security & Quality` e então triar as nove causas acima com a captura nova.
