# Fontes e manifesto — antropometria Fase 314

Conferência documental em 2026-10-10. Dados públicos oficiais; nenhum dado de paciente.
Este manifesto registra os artefatos inspecionados, sem incorporá-los ao runtime.
A ficha clínica e o método computacional ainda precisam de revisão/ratificação.

## OMS — planilhas oficiais

As 16 planilhas contêm 14338 linhas de dados.
Validar cabeçalho, unidade, sexo, indicador, grade, limites e hash na importação.
Os nomes externos de duas planilhas OMS 2007 de peso começam com `hfa`;
as abas internas `wfa_*` e o conteúdo identificam peso por idade. Não escolher pelo nome do arquivo.

| Grupo/aba | Linhas | Chave inicial–final | Fonte | SHA-256 |
| --- | ---: | --- | --- | --- |
| oms2006_imc / `BFA_girls_z_exp` | 1857 | 0–1856 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/body-mass-index-for-age/expanded-tables/bfa-girls-zscore-expanded-tables.xlsx?sfvrsn=ae4cb8d1_12) | `d3817262a383cdd02553b004f1c6110527d30b729c70501d032e71caadc17529` |
| oms2006_imc / `BFA_boys_z_exp` | 1857 | 0–1856 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/body-mass-index-for-age/expanded-tables/bfa-boys-zscore-expanded-tables.xlsx?sfvrsn=f8e1fbe2_10) | `58dcb2abea0e04b1c4f8ad3511d05ec1bea03741f230ac127b93f929e4cc6fc8` |
| oms2006_estatura / `LFA_girls_z_exp` | 1857 | 0–1856 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/length-height-for-age/expandable-tables/lhfa-girls-zscore-expanded-tables.xlsx?sfvrsn=27f1e2cb_10) | `6aa2876319449a6b1f4d825848128902114ff53c67b92b86a0c5140846013059` |
| oms2006_estatura / `LFA_boys_z_exp` | 1857 | 0–1856 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/length-height-for-age/expandable-tables/lhfa-boys-zscore-expanded-tables.xlsx?sfvrsn=7b4a3428_12) | `c4b1c9029ab9751a5f0888e32f35c7c0287a16d361885cf911ecf23b3f7f6b4f` |
| oms2006_peso_idade / `WFA_girls_z_exp` | 1857 | 0–1856 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-age/expanded-tables/wfa-girls-zscore-expanded-tables.xlsx?sfvrsn=f01bc813_10) | `ee3ae12cb96c6c5541cdf43665c03ce6c984f877859a183a5f6104eb06a49a6e` |
| oms2006_peso_idade / `WFA_boys_z_exp` | 1857 | 0–1856 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-age/expanded-tables/wfa-boys-zscore-expanded-tables.xlsx?sfvrsn=65cce121_10) | `b5b4748c6bfa5230e2eddafa1767629c349178b08d457f400b59422b8bfef86c` |
| oms2006_peso_altura / `WFL_girls_z_exp` | 651 | 45–110 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-length-height/expanded-tables/wfl-girls-zscore-expanded-table.xlsx?sfvrsn=db7b5d6b_8) | `ec116b8e618ad311d34a87231346badf16c75f5c4f82222ec846e05c582bf16a` |
| oms2006_peso_altura / `WFL_boys_z_exp` | 651 | 45–110 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-length-height/expanded-tables/wfl-boys-zscore-expanded-table.xlsx?sfvrsn=d307434f_8) | `1a6e9a002d2692d038161bc6572a10f8b9fa0657163808141d2981a2132c59cc` |
| oms2006_peso_altura / `WFH_girls_z_exp` | 551 | 65–120 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-length-height/expanded-tables/wfh-girls-zscore-expanded-tables.xlsx?sfvrsn=daac732c_8) | `fca340d5f04aa1556ac410b176b65b290e1b9ff467fc854a97f9b54ad94c9b8a` |
| oms2006_peso_altura / `WFH_boys_z_exp` | 551 | 65–120 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-length-height/expanded-tables/wfh-boys-zscore-expanded-tables.xlsx?sfvrsn=ac60cb13_8) | `ed3b590f9c65937a138408b13618f33684bb6406a0c56d6a2ce3fd9053a3f59f` |
| oms2007_imc / `bmi_girls_z_WHO 2007_exp` | 168 | 61–228 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/bmi-for-age-(5-19-years)/bmi-girls-z-who-2007-exp.xlsx?sfvrsn=79222875_2) | `66f5c6284b44579ad6135fc639f22c09e36fe5a695b04390377113f6a00deb72` |
| oms2007_imc / `bmi_boys_z_WHO 2007_exp` | 168 | 61–228 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/bmi-for-age-(5-19-years)/bmi-boys-z-who-2007-exp.xlsx?sfvrsn=a84bca93_2) | `0a60849673f34a06b8e2fe4defe5d00348de687b6c9fce0278f1525fff89eb6d` |
| oms2007_estatura / `hfa_girls_z_WHO 2007_exp` | 168 | 61–228 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/height-for-age-(5-19-years)/hfa-girls-z-who-2007-exp.xlsx?sfvrsn=79d310ee_2) | `df07ee16d3d2916569f1d869b7c874d7b880a41321d871215ed0254cb16679b3` |
| oms2007_estatura / `hfa_boys_z_WHO 2007_exp` | 168 | 61–228 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/height-for-age-(5-19-years)/hfa-boys-z-who-2007-exp.xlsx?sfvrsn=7fa263d_2) | `d78fa8cafcab77dcb5f03d71506d92bdcb28f89c642816b6bb0eef466b007466` |
| oms2007_peso_idade / `wfa_girls_z_WHO 2007_exp` | 60 | 61–120 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/weight-for-age-(5-10-years)/hfa-girls-z-who-2007-exp_7ea58763-36a2-436d-bef0-7fcfbadd2820.xlsx?sfvrsn=6ede55a4_4) | `d747e068fcef4238cbaf1c201dd7788f266d9903685f4495360614eed0153562` |
| oms2007_peso_idade / `wfa_boys_z_WHO 2007_exp` | 60 | 61–120 | [planilha](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/weight-for-age-(5-10-years)/hfa-boys-z-who-2007-exp_0ff9c43c-8cc0-4c23-9fc6-81290675e08b.xlsx?sfvrsn=b3ca0d6f_4) | `a6ed0d9f3cfa209747afe49f7503b7cc24a1be6b6a8e7222e85a36b7850cb99f` |

OMS 2006: idade em dias (0–1856); comprimento 45–110 cm e estatura 65–120 cm,
grades de 0,1 cm. OMS 2007: meses 61–228 para IMC/estatura e 61–120 para peso.
Esses limites do fornecedor não substituem as faixas SISVAN, a técnica e a política de idade.

## Manuais e classificação

| Artefato | Fonte | SHA-256 |
| --- | --- | --- |
| OMS 2006 — instruções | [documento](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/instructions-en.pdf?sfvrsn=5cec8c61_23) | `a1781a767cec18ed56b6cb9430af2d74e1a9a9b19fc21b1dab64b0238a9fa773` |
| OMS 2007 — instruções | [documento](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/readme-who2007-exp.pdf?sfvrsn=ffaf2d06_4) | `eb88e732bfd3582ff1aa5d708d4651c7dfedd2e82368cb9cd172754d65f87af9` |
| OMS 2007 — cálculo | [documento](https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/computation.pdf?sfvrsn=c2ff6a95_4) | `ebbdc96a274c3cf44a5ccaf93baad74ad974038a4850035ca37f6edf4baada98` |
| MS/SISVAN 2011 | [documento](https://bvsms.saude.gov.br/bvs/publicacoes/orientacoes_coleta_analise_dados_antropometricos.pdf) | `5c6d2307626d82e2f810d3f48e7aced361284206a12633e903bff3b3d90c66e4` |
| SBP — monitoramento de prematuros 2017 | [documento](https://www.sbp.com.br/fileadmin/user_upload/2017/03/Neonatologia-Monitoramento-do-cresc-do-RN-pt-270117.pdf) | `445a0c09a390d12fdc3abd9c813fa544335f4ca584a7126a0a93afe066576289` |

## INTERGROWTH-21st

[Página oficial pós-natal](https://intergrowth21.com/tools-resources/postnatal-growth-preterm-infants).
[Estudo primário, Villar et al., 2015](https://doi.org/10.1016/S2214-109X(15)00163-1).
O estudo usa modelos polinomiais fracionários; não presumir LMS OMS para essa referência.

| Artefato | Fonte | SHA-256 |
| --- | --- | --- |
| grow_preterm-zs-boys_bw_table.pdf | [documento](https://intergrowth21.com/sites/default/files/2023-02/grow_preterm-zs-boys_bw_table.pdf) | `9092b6b5409c01e40fae424ed489053e707f31a465b646f157ef3d6b324d5d54` |
| grow_preterm-zs-girls_bw_table.pdf | [documento](https://intergrowth21.com/sites/default/files/2023-02/grow_preterm-zs-girls_bw_table.pdf) | `c651faf16caf61c68dc54c000897f106066289db2bdfa0c139965aa4d1b178dc` |
| grow_preterm-zs-boys_lt_table.pdf | [documento](https://intergrowth21.com/sites/default/files/2023-02/grow_preterm-zs-boys_lt_table.pdf) | `e56115d43d5a27728229b4c2515777e72b43e7c0696feeeb1dbed7a7099cd9d2` |
| grow_preterm-zs-girls_lt_table.pdf | [documento](https://intergrowth21.com/sites/default/files/2023-02/grow_preterm-zs-girls_lt_table.pdf) | `9a8c482e20578a2b92b0158f3a3bbb81f555dabbd275cc6185653869e9dc19a8` |
| preterm_app_-_instructions_faq_2017_04_13.pdf | [documento](https://intergrowth21.com/sites/default/files/2023-02/preterm_app_-_instructions_faq_2017_04_13.pdf) | `d3e692e532c52ff01c8ec8be6a9a586ab6a7735e048fad1db3968323f36b69f4` |
| preterm_postnatal_troubleshooting_-_new.pdf | [documento](https://intergrowth21.com/sites/default/files/2023-02/preterm_postnatal_troubleshooting_-_new.pdf) | `15a1ed8853547ab2a5aeb9213203748b2ed8668ca88a1fbf530110a7f5735981` |

Quatro tabelas de peso/comprimento, dois sexos, 38 semanas (27–64) cada,
com quantis −3…+3 arredondados. Não fornecem coeficientes nem dados diários
suficientes para calcular escores individuais contínuos. Esse requisito permanece aberto (G01).
O manual delimita 189–448 dias; o troubleshooting diz 189–454. O proprietário
aprovou levar à revisão a borda conservadora 64s0d (448 dias), OMS depois dela.

## Exemplo neonatal e limite de acesso

[CSV de exemplo oficial](https://intergrowth21.com/sites/default/files/2023-02/preterm_postnatal_example_-_new.csv),
SHA-256 `528b5e9c20939eafbb81f4a652cff9766258c398faf37fcde55fee3ea8e5ecd0`.
Inspecionado: quatro entradas de sexo/PMA/peso/comprimento/perímetro, **sem
saída esperada nem coeficientes**. Não serve sozinho como oráculo do cálculo.
A página oficial do estudo primário foi lida; o acesso ao destino do DOI foi
bloqueado por HTTP 403 neste ambiente. Não afirmar leitura de suplemento
completo nem ausência definitiva de coeficientes na literatura; sua obtenção
permanece uma tarefa concreta de G01.

## Reprodução e procedência

A disponibilização de gráficos para uso clínico não comprova sozinha permissão
para redistribuir dados ou código de calculadoras em produto comercial. Conferir
termos dos artefatos e atribuição em G01; registrar resolução antes de incorporá-los.
Não baixar/executar instaladores nem copiar código de calculadoras para preencher lacunas.
Fenton não foi escolhido; o fornecedor solicita contato para dados de uso comercial.

Fontes originais são externas e podem mudar. O implementador deverá recuperar
os artefatos pelos links e comparar hashes, registrando divergências, sem aceitar
mudança silenciosa. Os downloads temporários não são dependência do handoff.

Ver [ficha clínica](FICHA_VALIDACAO_CLINICA_FASE_314.md) e
[plano](../history/phases/PLANO_FASE_314.md).

## Reconferência técnica rev2 — 2026-10-10

PASS local: os 16 XLSX preservados da pesquisa anterior foram reabertos com
openpyxl (read-only/data-only): 14.338 linhas, abas/grades e L/M/S numéricos,
M/S positivos, SHA-256 iguais ao manifesto. Isso comprova os bytes locais,
não atualidade clínica nem direitos de redistribuição. As 16 novas tentativas
pelas URLs CDN foram bloqueadas (HTTP 403); não afirmar re-download aprovado.

### Implementações OMS consultadas, sem execução nem incorporação

Repositórios oficiais `WorldHealthOrganization/anthro` e `anthroplus`.
Commits consultados: `b776d8a12b1c97369c748b561159fd2ec4f4db58` e
`7cfcdb39026e9a55de55732bc3cf14c82261bcf7`. DESCRIPTION: versão de
trabalho `1.1.0.9000`, não release escolhido para produção. Licenças declaradas
GPL-3 / GPL (>=3). A leitura serve de evidência; não copiar código/dados
GPL ou adicionar pacote ao runtime sem avaliar obrigações e compatibilidade.
Termos de cada planilha externa não são estabelecidos pela licença do pacote.

| Artefato oficial | Fonte fixa | SHA-256 |
| --- | --- | --- |
| oms2007_zscores.R | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/R/zscores.R) | `43bfdb016455c057b0ee986c0d4fb0b2a7733e19f0e74821aee9d3d0aece0c41` |
| oms2007_description | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/DESCRIPTION) | `e65923b9ce67b118e29c28077161ed47f557a2c04cc62543daa4c39a63f906c5` |
| oms2006_helper.R | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthro/b776d8a12b1c97369c748b561159fd2ec4f4db58/R/z-score-helper.R) | `a5c9889721d1194552c9a07f84aeb01ad2cbf748082320fcdbbec17d96cebd67` |
| oms2006_zscore.R | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthro/b776d8a12b1c97369c748b561159fd2ec4f4db58/R/z-score.R) | `4547b068083e276db3799679b9e488fcc8a8da89e4142ae9f45a7ba75354155c` |
| oms2006_api.R | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthro/b776d8a12b1c97369c748b561159fd2ec4f4db58/R/api.R) | `181f9e9d4ab886f496c1e516c606c406ffadac1794a335b61b85089ebf5d0be1` |
| oms2006_utils.R | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthro/b776d8a12b1c97369c748b561159fd2ec4f4db58/R/utils.R) | `deb236da3fb7f8445febad61b61a04def980d4b92452d597274025311a6ae249` |
| oms2006_wfl.R | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthro/b776d8a12b1c97369c748b561159fd2ec4f4db58/R/z-score-weight-for-lenhei.R) | `10bcca5384aaf51ffc43fd5286984ce81c129f2582f91f98f15d91fb8110d4cb` |
| oms2006_description | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthro/b776d8a12b1c97369c748b561159fd2ec4f4db58/DESCRIPTION) | `a2f8289d628e2a2754cb9528c526a8569a7d226eec8dab97fe94bca47d7a14a5` |
| data-raw/growthstandards/bfawho2007.txt | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/growthstandards/bfawho2007.txt) | `70ef3260df08e48ce560c28cff4e733db78fb952cbd881eba63c9d3a15f38a6a` |
| data-raw/growthstandards/hfawho2007.txt | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/growthstandards/hfawho2007.txt) | `9ac02aa4908f8ec3c6ba2362a4c7e1356043408b2873548ca22eedc016c235ad` |
| data-raw/growthstandards/wfawho2007.txt | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/growthstandards/wfawho2007.txt) | `9234dc640ba54001a9afd42ef15ab675b211a721c8f3c0a07c3431fd9cea0e1c` |
| tests/testthat/test-zscores.R | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/tests/testthat/test-zscores.R) | `5a2d3f424645f9f1cbe9cd9ad66c60df9437b644f9edd000dcd57be5e0ea7821` |
| data-raw/survey_who2007_z.csv | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/survey_who2007_z.csv) | `404377020c89f734881e8a2e3004f7ad616bdfdec616935a596f64d60191371c` |
| data-raw/Survey_WHO2007.csv | [fonte](https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/Survey_WHO2007.csv) | `af956354d12b1c5666e91c36e87f34caf839d7bb4e199c9e3058b49d63378eab` |

Os três TXT computacionais têm ambos os sexos: BFA/HFA 340 linhas cada
(meses 60–229), WFA 124 (60–121). Incluem âncoras 60 e finais 229/121;
as últimas repetem L/M/S de 228/120. As seis planilhas OMS 2007 iniciais
não incluem essas âncoras: **não são suficientes para reproduzir sozinhas o
pacote nos intervalos fracionários de borda**. T01/T04 deverão resolver origem,
termos e dados complementares sem extrapolar/inventar linhas.

Código consultado interpola L, M e S entre meses adjacentes e entre grades
lineares de 0,1 cm; não interpola z/percentis. `anthro` recente restringe
idade <60 meses apesar de sua grade diária chegar a 1856. `anthroplus`
aceita idade >=60 e <229 (<121 para WFA). Não confundir grade de arquivo,
população da referência e faixa clínica escolhida (CL-01).

Os CSV de survey oficiais foram inspecionados como artefatos públicos, sem
imprimir casos nem adotá-los como fixtures. Sua origem não está certificada
como sintética. Ensaios OctaClin devem usar apenas exemplos sintéticos
explícitos, como os casos numéricos em `tests/testthat/test-zscores.R`.

### Documentos complementares e limites de acesso

- ig_artigo.html: [fonte](https://intergrowth21.tghn.org/articles/intergrowth-21st-postnatal-growth-standards-and-z-scores-preterm-infants/), SHA-256 `6ce2525c72526acef646a2f4db38a6c3f5c189a3f2ca802f4d1500b62a160ff8`.
- ig_oficial.html: [fonte](https://intergrowth21.com/tools-resources/postnatal-growth-preterm-infants), SHA-256 `d93cd32c49b6213127b7fc30024fd4adccbba186b9152a5142613ae75b7d7c5f`.
- protocolo.pdf: [fonte](https://www.gov.br/saude/pt-br/composicao/saps/vigilancia-alimentar-e-nutricional/arquivos/protocolos-do-sistema-de-vigilancia-alimentar-e-nutricional-sisvan/@@download/file), SHA-256 `0b0cda906af20adf1160741874a124b30ab9b8c9ae7fceed0b585a8634ffd453`.
- ig_termos.html: [fonte](https://intergrowth21.com/privacy-policy), SHA-256 `f84c8caae3422a559e7f6f9a299a0cf99bd98307cab658b5448897c6b726b830`.

Protocolos SISVAN 2008 e orientações 2011 não são intercambiáveis: os
quadros têm desigualdades/terminologia diferentes em bordas. A ficha deve
ratificar a precedência e a tabela de verdade, sem copiar condutas automáticas.
Página de privacidade INTERGROWTH não concede licença de redistribuição.
Reabertura das páginas confirma disponibilidade; não fecha termos/modelo diário.

AnthroPlus manual, Survey Analyser quickguide e página AAP responderam 403
neste ciclo, inclusive os dois manuais tentados pelo CDN. Suas alegações no
parecer são propostas com evidência complementar no código consultado;
**AAP “até três anos” não foi confirmado diretamente**. Recuperar edição
verificável antes de ratificar duração. Busca bibliográfica Europe PMC pelo DOI
não retornou resultado; isso não prova ausência de suplemento/coeficientes.

### Estado por família de referência

| Família | Integridade/proveniência | Direitos/população/método | Estado para incorporação |
| --- | --- | --- | --- |
| OMS 2006 XLSX | PASS local, download atual 403 | Modelo/documentação conhecidos; técnica/idade/flags e termos precisam de fechamento | BLOCKED G01/G02 |
| OMS 2007 XLSX/TXT | PASS local XLSX; TXT oficial obtido e hash registrado | Interpolação e âncoras confirmadas; escolha de edição/termos/routing pendentes | BLOCKED G01/G02 |
| MS/SISVAN 2011 + 2008 | 2011 hash do manifesto; 2008 obtido no portal oficial | Precedência/igualdades/nomes e revisão clínica pendentes | BLOCKED G02 |
| INTERGROWTH 2015/2017 | Tabelas/manuais públicos identificados; não constituem modelo diário | Licença, elegibilidade, algoritmo diário e duração de correção pendentes | BLOCKED G01/G02 |

Nenhum runtime/dependência alterado. A conferência documental não certifica
clinicamente o conjunto completo nem encerra G01/G02.

### Condição de uso MS que não pode ficar implícita

Os dois PDFs MS consultados (2008 e 2011) permitem reprodução com atribuição,
mas a declaração limita reprodução para venda/finalidade comercial. Isso não
é prova de proibição de usar fatos científicos ou métodos no produto; tampouco
é licença irrestrita de copiar textos, imagens, quadros ou distribuir os PDFs.
Registrar análise jurídica/de direitos para a forma concreta de incorporação
comercial antes do runtime. Não embutir obras nem copiar tabelas gráficas por
inferência de que a fonte é governamental. O gate de direitos fica aberto.

PASS nesta reconferência: quatro PDFs INTERGROWTH e dois manuais foram
baixados novamente; todos os seis hashes iguais ao manifesto. As 38 linhas
semanais não se transformaram em dados diários por essa verificação.
