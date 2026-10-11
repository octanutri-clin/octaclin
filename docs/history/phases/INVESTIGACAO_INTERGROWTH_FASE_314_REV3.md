# Investigação INTERGROWTH e propostas clínicas — integração REV3

2026-10-10. Escopo autorizado: documentação/pesquisa. A aprovação documental
com ressalvas foi declarada pelo proprietário; **não é ratificação clínica nem
liberação de implementação**. Revisão sobre HEAD `a8db3308`, branch
`docs/fase-314-planejamento`, base local `f8c5ab66`. Worktree inicialmente limpa.
Os seis documentos consolidados foram relidos; os contratos da revisão rev2
continuam preservados. Nenhum banco/estado produtivo foi reconferido neste ciclo.

## 1. Conclusão de viabilidade

**INTERGROWTH pós-natal tem um caminho computacional contínuo viável como
candidato**, para peso e comprimento por PMA. Não é necessário inventar
interpolação dos PDFs semanais. Duas implementações publicam os mesmos
coeficientes; uma avaliação aritmética isolada concordou com o serviço oficial
Oxford em 24 resultados sintéticos no lote principal, incluindo dias
intermediários; total preservado e reconciliado: 14 casos/28 resultados.

Isso fecha a investigação de existência de um candidato e demonstra concordância
numérica amostral independente. **Não fecha G01:** faltam procedência primária
completa dos coeficientes/precisão, direitos de incorporação concretos, fechamento
OMS e aceites do método/limites. G02 e G03 permanecem BLOCKED. Não há prontidão
para implementação nem produção. Os PDFs não se tornam um modelo diário.

## 2. Fontes fixas, método e diferenças

Fontes científicas: Villar et al. (2015), DOI
[10.1016/S2214-109X(15)00163-1](https://doi.org/10.1016/S2214-109X(15)00163-1),
PMID 26475015. Resumo bibliográfico recuperado por **título** no Europe PMC;
a busca anterior vazia por DOI não demonstrava ausência. O resumo descreve
regressão polinomial fracionária de segundo grau em estrutura multinível,
considerando medidas repetidas; 201 prematuros, únicos, nascidos de 26 a <37
semanas, sem malformações/RCIU/morbidade pós-natal grave, mães selecionadas de
baixo risco. As curvas pós-natais diferem das curvas de tamanho ao nascer e
convergem às OMS perto de 64 semanas de PMA.

Ambos os arquivos R atribuem as equações ao artigo. `gigs` inclui Ohuma como
contribuidor e cita também o artigo do pacote JOSS 10.21105/joss.07655; isso
reforça rastreabilidade, **não substitui suplemento primário nem licença**.
O texto completo/suplemento não foi obtido neste ambiente (Elsevier/Lancet403);
não se afirma que os coeficientes foram diretamente conferidos no suplemento.
A tentativa de URL de suplemento foi exploratória, não fonte identificada.

| Propriedade | ropensci/gigs | ki-tools/growthstandards |
| --- | --- | --- |
| Commit consultado | `fb58fe6596d4b289d5362c5efe00f882984d3186` | `d06a4898c286a3ab9111a5e3525c3b9d0e9ae8aa` |
| Arquivo | `R/ig_png.R` + `R/gigs_zscoring.R` | `R/standard_igprepost.R` |
| Versão DESCRIPTION | 0.5.2.9000, desenvolvimento | 0.1.7 |
| Licença código declarada | GPL (>=3); LICENSE.md recuperado | MIT + LICENSE; texto MIT em LICENSE.md |
| Entrada no núcleo | PMA em semanas exatas | PMA em dias, dividida por 7 |
| Limite efetivo consultado | [27,64] semanas no roteador | [168,454] dias = 24s0d–64s6d |
| Peso/comprimento | log natural, média/desvio por PMA | Mesmas equações e coeficientes |
| Conversão para z | `(ln(y)−μ)/σ` diretamente | z passa por percentil normal e inversa normal |
| Extremos | Cálculo direto evita essa ida/volta | `pnorm` pode saturar 0/1 e `qnorm` devolver infinito |
| Medida ao nascer | Roteamento distinto Newborn Size, primeira <3 dias | Função pós-natal não recebe idade cronológica para distinguir nascimento |
| OMS após 64 | Idade cronológica explicitamente não corrigida | Arquivo isolado não determina política de transição OMS |

O comentário em growthstandards sobre usar Very Early Preterm em 24–33 semanas
não corresponde a um ramo de troca neste arquivo: mesmas equações são usadas.
Não importar essa extensão/comentário como validação. A discordância de limite
não autoriza OctaClin a ampliar a proposta 27s0d–64s0d. O núcleo interno gigs
não aplica sozinho todos os guards; distinguir núcleo e API/roteador público.
Nenhum pacote R foi executado, instalado ou acrescentado como dependência.

### 2.1 Equações candidatas, exclusivamente para revisão

`w = PMA_dias / 7`; `s=1` masculino, `s=0` feminino. Peso `y` em kg,
comprimento `y` em cm. μ e σ referem-se ao **log natural da medida**, não a kg/cm:

```text
Peso:
μ = 2.591277 − 0.01155√w − 2201.705/w² + 0.0911639s
σ = 0.1470258 + 505.92394/w² − 140.0576 ln(w)/w²
Comprimento:
μ = 4.136244 − 547.0018/w² + 0.0026066w + 0.0314961s
σ = 0.050489 + 310.44761/w² − 90.0742 ln(w)/w²
z = (ln(y)−μ)/σ; y(z) = exp(μ+σz); percentil = 100Φ(z)
```

São equações candidatas transcritas para confrontação documental, **não código
incorporado ao runtime nem coeficientes certificados por leitura primária**.
Não aplicar LMS/caudas OMS a essas equações. Não incluir perímetro cefálico,
peso/comprimento neonatal ou Newborn Size no escopo aprovado só por existirem
nos pacotes. A equação WFL de gigs é atribuída a comunicação direta de Ohuma,
fora da referência citada; não adotada nesta fase.

## 3. Concordância independente, apenas dados sintéticos

Oráculo: [calculadora oficial Oxford](https://intergrowth21.ndog.ox.ac.uk/preterm),
ligada pela [página oficial de aplicações](https://intergrowth21.tghn.org/fetal-preterm-and-newborn-applications/).
GET do formulário e POST a `/preterm/en/ManualEntry/Compute`, sem identificador,
data de nascimento, paciente ou credencial. Nenhum instalador/script remoto
executado. A resposta calcula no servidor e inclui arrays `scores`/`centiles`;
foram lidos como números, sem executar JavaScript nem gráficos externos.

Pesquisa local em Python stdlib, isolada em `/tmp/f314-rev3/research.py`:
PMA 27s0d, 27s1d, 36s3d, 40s0d, 63s6d e 64s0d, ambos os sexos;
medidas sintéticas construídas nas proximidades de z −3, −2, 0, +1, +2, +3,
arredondadas a 0,001 kg/0,1 cm antes de consultar o oráculo. São 12 casos,
24 pares de z/percentil. O fato de a entrada ser gerada pela equação não torna
o oráculo independente tautológico: a resposta é calculada pelo serviço oficial;
a prova de ida/volta local, sozinha, não seria suficiente.

- PASS amostral: maior erro absoluto z `1.2101430968414206e-14`;
  percentil `3.126388037344441e-13` pontos percentuais. Comparação descritiva,
  não tolerância clínica definitiva; adotar futura tolerância só após CL-03/06.
- Caso inicial sintético masculino PMA36s3d, 2,65 kg/47,2 cm:
  z peso `0.14070816748856857`, percentil `55.594975371382006`;
  z comprimento `0.09645172112773262`, percentil `53.841909197906723`.
- Quatro PDFs oficiais rebaixados: hashes iguais ao manifesto. Comparados
  38×7×2×2 = **1.064 quantis semanais**, sem pacientes. Erro máximo comprimento
  masculino `0.0498402 cm`, feminino `0.0499110 cm`; peso feminino `0.00496637 kg`.
- **Ressalva real:** peso masculino,55 semanas,z−3: PDF4,40 kg, equação
  `4.405026478034957 kg`; erro `0.005026478034957 kg`, ligeiramente superior
  à meia unidade de arredondamento 0,005 kg. Não ajustar coeficiente/tolerância
  depois de observar o desvio para declarar PASS. Conferir precisão original
  e fechar a discrepância antes de G01. Consulta adicional oficial de4,40 kg
  em55s0d masculino devolveu z `−3.0088689219142397`, igual à equação
  (`−3.00886892191424`). Portanto, oráculo favorece a equação neste ponto,
  mas não explica por que a tabela arredondou4,40 em vez de4,41 kg.
  [Evidência adicional](reviews/fase-314-rev3/quantil55-oraculo-sintetico.json).

Total de consultas sintéticas: 14 casos/28 resultados (lote12/24, caso inicial
36s3d/2 e ressalva55s/2), sem nomes ou identificadores.
[Consulta inicial preservada](reviews/fase-314-rev3/consulta-inicial-sintetica.json).

Arquivos preservados em [evidências REV3](reviews/fase-314-rev3/fontes-pesquisa.json)
e [resultados sintéticos](reviews/fase-314-rev3/comparacao-sintetica.json):
URLs, commits, SHA-256, limites de acesso, entradas e saídas numéricas.
Hashes HTML certificam apenas bytes daquela resposta; serviço oficial não
expõe versão do motor e pode mudar. Não afirmar validação integral diária,
caudas extremas, população, algoritmo OctaClin ou todos os dias por amostragem.
Próxima prova (refinada REV4): fonte/edição confirmada, conjunto finito de
vetores contra oráculo oficial e provas locais de propriedades em todos os
dias. Não consultar centenas de casos externos nem depender da rede emCI;
tolerância definida antes do novo confronto.
Percentis nas caudas devem ter apresentação sem falso 0/100 ou precisão excessiva;
limite OMS±3 não é automaticamente política neonatal (CL-03/06).

## 4. Nascimento, pós-natal e transição

**Histórico REV3:** a conclusão abaixo sobre ausência de fonte para prazo
foi superada pela evidência Elmrayed2025 na seção8 e na CL-07 atualizada.

Tamanho ao nascer é comparação transversal por IG; crescimento pós-natal é
acompanhamento longitudinal por PMA. O estudo primário adverte que curvas de
nascimento não devem monitorar crescimento pós-natal. `gigs` considera nascimento
a **primeira medida** com idade cronológica <3 dias, e avisa se >0,5 dia.
Isso é política do pacote, não prova de corte clínico universal em72horas;
medidas posteriores dentro da mesma janela podem seguir outro ramo no pacote.

**Preferência proposta CL-05:** excluir day0 e medidas identificadas como
nascimento da classificação pós-natal; 0–2 dias sem classificação automática
até ratificar protocolo específico, conservar medidas e motivo. Não deduzir
“ao nascer” da primeira avaliação cadastrada, que pode ocorrer semanas depois.
Ratificar necessidade de campo explícito do contexto da medida e a janela
inicial; data civil não resolve idade em horas. Nenhuma coleta de hora nova
ou curva Newborn Size está implicitamente autorizada. Alternativa: protocolo
explícito de medidas pós-natais nessa janela com evidência clínica adicional.

O resumo primário recomenda OMS após 64 PMA, mas não resolve no trecho obtido
idade corrigida/cronológica nem prazo. `gigs` escolhe **cronológica**. O produto
OctaClin escolheu **corrigida para revisão**; manter essa proposta até revisão
clínica, identificando divergência. Não copiar roteamento gigs.

**Preferência CL-07:** manter 64s0d inclusive, OMS corrigida em64s1d após
ratificação, PMA=IG+dias, corrigida=cronológica−(280−IG). Exemplo sintético
IG32s0d: em64s1d, cronológica225dias e corrigida169dias, diferença56dias.
Não conectá-las como uma única curva nem zerar idade corrigida negativa.
Alternativa explícita: cronológica conforme GIGS, sujeita a nova decisão e
impacto nos escores; nunca alterar silenciosamente a preferência de produto.

Prazo24/36 meses e base do encerramento continuam sem fonte clínica acessível
que os feche neste ciclo: AAP/HealthyChildren403; SBP 2017 não determina aqui
um prazo completo. **Não há preferência fundamentada para um número específico
sem essa evidência.** Preferir uma política única versionada ratificada pela
equipe com diretriz recuperada, sem seletor livre/alternância ad hoc na UI.
Séries separadas ao fim da correção; aplicar técnica/roteamento à idade
ratificada, conservando ambas. Fora da elegibilidade INTERGROWTH, não concluir
que OMS é automaticamente adequada por a criança ter cruzado64 PMA.

## 5. Direitos e cadeia de fornecimento

| Camada | Evidência | Condição necessária |
| --- | --- | --- |
| Código gigs | DESCRIPTION GPL>=3 + texto GPL | Leitura não impõe adição ao runtime; evitar tradução/cópia do código sem avaliar obrigações |
| Código growthstandards | DESCRIPTION MIT+LICENSE + texto MIT | Preservação de avisos se houver uso autorizado; MIT não concede direitos de dados IG |
| Equações/fatos científicos | Atribuição Villar 2015 nas implementações, oráculo concordante | Obter artigo/suplemento ou confirmação documentada do fornecedor, precisão/origem; avaliar forma de incorporação |
| PDFs/dados/coleções IG | Disponibilidade pública, © Oxford no serviço | Disponibilidade não demonstra licença comercial/redistribuição; esclarecer permissões/atribuição separadamente |
| Obras MS/OMS e datasets | Condições específicas já registradas rev2 | Parecer de direitos para dados/textos efetivamente incorporados, não assumir licença do código vale para tudo |
| Pesquisa interna | Consulta sintética sem dados reais | Não redistribuir instaladores/datasets por inferência; nenhuma dependência executada |

GPL não torna automaticamente equações científicas indisponíveis; MIT não
transforma dados de terceiros em MIT. Preferência: implementação própria
futura a partir da fonte científica autorizada, com atribuição e provas,
sem dependência R/serviço online. Nenhuma decisão jurídica conclusiva feita.

## 6. Integração das ressalvas N01–N06

| REV3 | Conclusão/evidência | Integração |
| --- | --- | --- |
| N01 | Equações contínuas encontradas; oráculo diário sintético concordante (28 resultados, contagem corrigida REV4), fonte primária detalhada ainda aberta | Manifesto/ficha/T01-C/T09; G01 avança parcialmente, continua BLOCKED |
| N02 | gigs usa primeira medida <3 dias; nascimento difere do pós-natal | CL-05 exige política explícita day0/0–2 dias, sem adicionar Newborn Size |
| N03 | Fonte/código gigs WHO sem correção depois64 | CL-07 preserva proposta corrigida e exige ratificação da divergência/prazo |
| N04 | MIT/GPL verificados em textos distintos; direitos dataset não estabelecidos | G00-fonte/direitos decomposto; nenhum pacote incorporado |
| N05 | Descoberta de biblioteca não autoriza fase parcial OMS | T03–T18 bloqueadas; decomposição de escopo somente por decisão expressa futura |
| N06 | CI/merge não prova migration1068 | G00-operação1068 separado, bloqueio de rollout; sem DB consultado |

Propostas CL completas, com fontes/alternativas/impactos/riscos/ratificação, na
[ficha seção10](../../product/FICHA_VALIDACAO_CLINICA_FASE_314.md#10-propostas-para-ratificação--integração-rev3).
Todos os dez itens exigem decisão humana; nenhuma resposta clínica inferida.

## 7. Gates, cronograma e verificações

G00 global BLOCKED; G00-fonte/direitos BLOCKED (integridade parcialPASS),
G00-operação1068 BLOCKED (consultaSKIPPED). G01/G02/G03 BLOCKED;
G04 SKIPPED; G05 BLOCKED. T01-C pesquisa avançou; T02 ratificação pendente;
T03–T18 não iniciadas. Ordem/IDs/contratos rev2 preservados, refinamentos nos
aceites T01/T02/T09/T10, sem runtime/migrations. Revisão R4 de implementação
continua futura; esta investigação não é revisão independente de código produzido.

Executados: leitura integral REV3/seisdocs; gitstatus/branch/log/diff;
GitHub API/read-only/raw de commits/arquivos/árvores/licenças;
Python urllib/hashlib/HTMLParser e aritmética sintética isolada;
POST de cálculo oficial exclusivamente sintético, quatro PDFs oficiais;
checks documentais e scanner de secrets registrados no handoff.
Tentativas bloqueadas: AAP/HealthyChildren/Elsevier/Lancet403, LICENSE gigs
sem extensão404 corrigido com LICENSE.md; GitHub tags growthstandards401
(não declarar tags/release conferidos). Latest release gigs observadov0.5.2;
commit consultado é desenvolvimento, não release clínico selecionado.
Nenhum R/JS/instalador externo executado; nenhum teste/build do software,
DB/DDL/migration/staging/produção/merge/deploy; todos SKIPPED por escopo.

Parecer original preservado byte a byte em
[ZIP](reviews/fase-314-rev3/parecer-original.zip). Seu hash e o do ZIP estão
no manifesto. Relatórios rev2 continuam históricos; este relatório apresenta
o avanço REV3 sem reescrever a evidência anterior como se sempre existisse.

**Prioridade:** (1) recuperar fonte primária/direitos e ponto55semanas;
(2) equipe ratificar CL-05/06/07 e demais CL com versão/hash;
(3) completar fechamento OMS/G01; (4) registrar G02, solicitar autorização
G03 e escopo de testes; (5) implementar sequência só após esses gates, com Sol 6.1 médio.
Luna alto apenas UI com contratos fechados e troca manual avisada/pausada.
1068/roles/RLS/grants exigem evidência operacional autorizada antes de rollout.

## Verificações da consolidação REV3

PASS: `git diff --check`; Python stdlib conferiu links locais/âncoras e
colunas Markdown, CL-01–CL-10/IDs T01–T18 e ZIP byte a byte. PASS:
`pnpm security:secrets`, sem segredo real; aviso Node24/pnpm11 fora da faixa
do projeto registrado, sem afirmar compatibilidade do software.
PASS documental: integridade das fontes, amostras sintéticas contra oráculo;
ressalva semanal55s permanece explícita. Nenhuma dessas provas é teste do
runtime OctaClin. SKIPPED: Jest/PG/authz/Playwright/builds/CI314 e qualquer
banco/migration/staging/produção/merge/deploy. Diff limitado à documentação314.

## 8. Fechamento objetivo REV4 — evidência, contagens e direitos

Revisão sobre worktree **já modificada pelaREV3**, branchdocs/fase-314-planejamento,
HEADa8db3308; sem reset/rebase/merge. Sete documentos anteriores preservados
byte a byte em [snapshotpréREV4](reviews/fase-314-rev4/documentos-antes-rev4.zip).
[ParecerREV4 original](reviews/fase-314-rev4/parecer-original.zip) preservado;
[hashes dos arquivos](reviews/fase-314-rev4/arquivos-preservados.json).
Declarações históricas da seção4 de falta de fonte24/36 foram superadas por
Elmrayed 2025; CL-07 vigente está na ficha atualizada, não nessa conclusãoREV3.

### 8.1 Contagens corrigidas e diferença55semanas

[Reconciliação direta dos três JSONs](reviews/fase-314-rev4/reconciliacao-resultados.json):

| ArtefatoREV3 intacto | Casos | Resultados de indicador |
| --- | ---: | ---: |
| comparacao-sintetica.json/daily | 12 | 24 |
| consulta-inicial-sintetica.json | 1 | 2 |
| quantil55-oraculo-sintetico.json | 1 | 2 |
| Total (14 entradas distintas por sexo/PMA/peso/comprimento) | 14 | 28 |

Cada resultado traz z epercentil, portanto não contar como56. Menções26 eram
editoriais, somando lote ecaso55 e omitindo oinicial; ficha/plano/handoff/checklist
corrigidos. JSONs e hashes originais preservados. Nenhuma nova consultaOxford
realizada nestaREV4, nenhum teste doOctaClin. Máximos dos28resultados recontados:
erro z1,2101430968414206e−14 epercentil3,126388037344441e−13 pontos percentuais.

Ressalva55smasculino,z−3 permanece: PDF4,40 kg versus equação4,405026478 kg.
O oráculo para4,40 kg dáz−3,0088689219, favorece o modelo mas não explica o
quantil arredondado. Diferença acima de meia unidade:0,000026478 kg
(0,026478 grama). **Hipóteses**, sem confirmação: precisão interna diferente
ou arredondamento/transcrição do PDF. Não alterar coeficiente ou aumentar
limiar0,005 kg; solicitar precisão/errata ao fornecedor. Se não houver explicação,
exceção documental com prioridade da equação precisa de justificativa técnica,
aceite clínico e procedência comprovada, sem reclassificar o testePDF comoPASS.

### 8.2 Protocolo independente finito e offline — proposto, não executado

Substitui pedido genérico de todos os dias contra site. Não tornar serviço
Oxford dependência de CI/runtime; não pedir milhares de respostas remotas.

1. Congelar os14casos/28 resultados existentes com origem/input/output/hash,
   distinguir12entradas geradas pelo candidato e2entradas manuais; cálculo
   próprio comparado a saída oficial é evidência externa, não ida/volta local.
2. Proposta de complemento **limitado a8casos** (quatro conjuntos manuais
   abaixo, cada um para masculino/feminino). Obter saídas oficiais somente
   após verificar condições de uso, com captura mínima/registro de versão se
   disponível; não afirmar que já foram consultados. Teto22casos/44 resultados,
   revisão da cobertura pelo responsável técnico antes da aquisição.

| PMA | Peso sintéticokg | Comprimento sintéticocm |
| --- | ---: | ---: |
| 30s2d | 1,20 | 40,4 |
| 48s5d | 5,50 | 60,2 |
| 55s1d | 6,10 | 64,0 |
| 60s4d | 7,20 | 68,0 |

3. Tolerâncias **prospectivas candidatas**, para aprovação técnica/CL-03/06
   antes das novas provas: saídas oficiais alta precisão, erro absolutoz<=1e−8,
   percentil<=1e−6 pontos percentuais. Fonte com2casas: comparar valor publicado
   com meia unidade0,005+erro aritmético1e−12, não exigir precisão inexistente.
   PDFpeso:0,005 kg+1e−12; comprimento:0,05 cm+1e−12. Ressalva55continuaFAIL
   nesse critério. Esses valores não certificam erro clínico/erro de medida;
   são limites de concordância computacional. Não foram pré-fixados naREV3.
4. Testes locais futuros exaustivos: todos osPMA_dias189–448, dois sexos,
   μ/σfinitos,σ>0, valores positivos, zmonótono na medida a PMA fixa, ida/volta
   e mediana, extremos numéricos, domínio188/189/448/449/454, NaN/infinito/zero/
   negativo. Não assumir monotonicidade deσ ouzcom aidade; essas propriedades
   não seriam válidas por conveniência. Ida/volta/mediana não são validação
   clínica independente; sem chamadas externas nesse loop.
5. Testes da política (posteriores a G02/G03): nascimento/janela0–2,IG ausente,
   elegibilidade, transição64s0d/64s1d,IG31s6d/32s0d, fim24/36 corrigidos e
   dia seguinte, técnica730/731, flags/edema, estados parciais, série/versionamento.
   Política, cálculo e apresentação em camadas distintas; não esconder outros
   indicadores quando umestiver semclassificação. RegraSISVAN pelozbruto.

Não foi adicionado arquivo de teste/runtime ou dependência. Provas de RLS,
carteira/replay/DELETE/grants/ciphertext/cursor emPGreal continuam nas tarefas
T16-A/B/C, sem antecipar banco ou declarar implementaçãovalidada.

### 8.3 Procedência e direitos — tarefas fechadas para decisão

Crossref do editor confirma licença **CCBY-NC-ND4.0** para obraVillar2015
(content-versionvor), distinta daTDM. PáginaNature deElmrayed declaraCCBY4.0.
Não confundir essas obras nem assumirGPL/MIT do R transfere direitos dos dados.
G00-fonte/direitosBLOCKED; leitura e publicação de conclusão científica não
são cópia autorizada de programa/quadros/datasets em SaaS.

**Pendências objetivas para responsável por direitos/fornecedor:**
- Confirmar equações/coeficientes/precisão em artigo/suplemento identificável ou
  declaração técnica do fornecedor com edição/data, não consenso entre bibliotecas.
- Esclarecer caso55semanas−3 equalfonte é normativa para cálculo diário.
- Avaliar implementação própria das equações como fatos/método, distinta de
  copiar/traduzirGPL/MIT; avaliar separadamente redistribuição de coeficientes,
  tabelas/dados/coleções/figuras/textos e atribuição comercial pretendida.
- Obter permissão escrita ou parecer de direitos fundamentado para cada
  artefato realmente incorporado, conforme necessário. NC-ND não licencia
  automaticamente obra comercial; tampouco prova proibição de usar método.

Roteiro de consulta **preparado, NÃO ENVIADO**: informarSaaSclínico comercial,
implementação própria offline apenas peso/comprimento pós-natal, pedir fonte
normativa/coeficientes/precisão/limites, esclarecer55s, condições de uso e
redistribuição de parâmetros/resultados/gráficos e atribuição; solicitar
resposta escrita e edição. Sem dados/paciente/PII real; envio a terceiros
exige autorização explícita que não existe nesta execução.

### 8.4 CL-07 e saída da rodada

[Elmrayed 2025](https://www.nature.com/articles/s41372-024-02202-z) foi lido
integralmente: evidência específica36meses **corrigidos**, população<32,
sem32–36; análise secundária de1.416 sobreviventes Canadá, perda22,1% aos 36.
OMS usado após40PMA no estudo não muda automaticamente a transição64PMA
aproximada do produto; população de UTI com morbidades também não amplia
INTERGROWTHlowrisk. WFLsem dependência direta de idade e diferença deefeitos
por indicador impedem afirmar benefício idêntico nosquatro indicadores.

RCPCHpágina oficial confirma instrumento até 24 corrigidos, não ausência de
benefício depois24. SBP 2023/desenvolvimento segue secundária naREV4 (403);
SBP2017local hashPASS/re-download403 confirma64PMA, sem prazo24/36completo.
FichaCL-07 propõe36corrigidos<32 eopção24corrigidos32–<37 como decisão local
provisória, identificando lacuna desteestrato. Não há política universal aceita.

**Lista final:** clínica = equipe responderCL-01–CL-10 da matriz, especialCL-07/08;
técnica = procedência/precisão, protocolo finito/tolerâncias, exceção55 efechamento
OMS; direitos = forma concreta de uso/atribuição/permissões. Operação1068 permanece
etapa separada de rollout. G01/G02/G03BLOCKED, G04SKIPPED, G05BLOCKED.
Próxima interação deve trazer respostas/artefatos desses itens, não repetir
inventário arquitetural ou gerar outra rodada genérica de planejamento.

### Verificações efetivamente executadas na REV4

PASS: leitura do parecer/documentos e inspeção Git; consultas públicas Nature,
RCPCH, EuropePMC, Crossref e recursosINTERGROWTH; leitura científica sem dados
individuais; hashes dos downloads/documentos e preservação do parecer.
PASS: recontagem dos trêsJSONs originais,14casos únicos/28resultados e hashes
intactos; nenhuma consulta nova ao oráculo e nenhuma saída recalculada como
novo resultado oficial.
PASS: conferência Python de55links locais/âncoras, colunas Markdown, dezCL e
IDs T01–T18; `git diff --check` e `pnpm security:secrets` sem segredo real.
Aviso Node24/pnpm11fora da faixa do projeto é limite do ambiente; não houve
teste de compatibilidade do runtime.
BLOCKED403: SBP2023 com/semwww, novoSBP2017 eScienceDirect; SBP2017 local
revalidado não equivale are-downloadPASS.
SKIPPED: testes de implementação/Jest/PG/BFF/UI/builds/CI314, migrations/DDL,
staging/produção, contato a terceiros, push/PR/merge/deploy. Escopo apenas
documentos314; contratos/migrations/runtime deoutras fases preservados.
