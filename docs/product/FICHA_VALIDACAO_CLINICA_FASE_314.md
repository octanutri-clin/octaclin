# Ficha para revisão clínica — Fase 314

Versão de trabalho 2026-10-10. **NÃO RATIFICADA. Não implementar o
classificador com base apenas nesta ficha.** Decisões de produto foram
recebidas; a revisão clínica numérica completa e a referência computacional
neonatal permanecem abertas. Somente console; nenhum novo portal pediátrico.

## 1. Revisão necessária

Responsável/equipe: a identificar no registro de ratificação. Registrar versão,
data, decisões e eventuais correções; preservar a ficha revisada no histórico.
Fontes e hashes: [manifesto](FONTES_ANTROPOMETRIA_FASE_314.md).
Contratos e execução: [plano](../history/phases/PLANO_FASE_314.md) e
[tarefas](../../tasks/todo-fase-314.md).

| Questão | Estado |
| --- | --- |
| OMS 2006/2007 + MS/SISVAN; quatro indicadores | Escolhidos pelo proprietário |
| Técnica de medida e conversão visível de 0,7 cm | Aprovado levar à ficha |
| INTERGROWTH → OMS com idade corrigida | Escolhido para revisão clínica |
| Etapa INTERGROWTH sem rótulos SISVAN | Aprovado; escore/percentil só quando método validado |
| Elegibilidade neonatal detalhada | Equipe definirá; fora dela, medidas sem classificação |
| Transição após 64s0d | Proposta conservadora aprovada para revisão, ainda não ratificada clinicamente |
| Duração e base da correção de idade | Pergunta pendente; não assumir 24 ou 36 meses |
| Política adulta abaixo de 18 | Bloqueio aprovado para novos registros |
| Política adulta 18–19 e fórmulas | Discussão clínica pendente |

## 2. Entradas, idade e rastreabilidade

Confirmar por avaliação: nascimento civil, data da avaliação, sexo da curva,
prematuridade/IG ao nascer/origem e técnica de medida. Não deduzir pelo nome,
identidade de gênero, peso ou altura. Ausência de dados necessários mantém
medidas com motivo individual de não classificação. Corrigir contexto vale
para registros futuros; preservar snapshots anteriores e separar bases no gráfico.

Calcular datas civis, sem deslocamento de fuso/DST; nascimento posterior à
avaliação é inválido. Idade cronológica em dias = diferença civil entre datas.
O manual OMS 2006 usa mês de 30,4375 dias e distingue 730/731 dias na técnica.
**Ratificar** como conciliar esse método com aniversários civis, faixas SISVAN,
meses completos e lookup OMS 2007, inclusive bordas sem lacunas/sobreposição.
Não arredondar idade para anos nem interpolar mensalmente sem método documentado.

Referências inspecionadas:

| Indicador | Dados do fornecedor | Limite clínico a conferir |
| --- | --- | --- |
| IMC/idade | OMS 2006 dias 0–1856; OMS 2007 meses 61–228 | Mudança aos 5 anos e transição de tabela; nota SISVAN aos 19 anos |
| Comprimento/estatura/idade | Mesmas grades de idade | Não aplicar a extensão SISVAN de IMC à estatura |
| Peso/idade | OMS 2006 dias 0–1856; OMS 2007 meses 61–120 | Até 10 anos; conferir inclusão do mês final |
| Peso/comprimento | OMS 2006 45–110 cm, passo 0,1 cm | Menores de 5 anos; técnica deitada e idade apropriada |
| Peso/estatura | OMS 2006 65–120 cm, passo 0,1 cm | Menores de 5 anos; técnica em pé e idade apropriada |

Nota MS/SISVAN, página impressa 20: para IMC de 19a1m–19a11m, usar a
referência de 19 anos completos. Proprietário aprovou essa adaptação,
identificada no resultado. **Ratificar** implementação exata da idade e borda
de 20 anos. Outros indicadores fora da sua referência não são estendidos.

## 3. Técnica e unidades

Guardar peso em kg, medida linear em cm e técnica original. Para referência
de comprimento, medida em pé recebe +0,7 cm; para referência de estatura,
medida deitada recebe −0,7 cm. Confirmar população/faixa e regra OMS antes de
aplicar; sem técnica, indicadores dependentes dela não são classificados.
Guardar valor original, normalizado, direção/valor do ajuste e referência.

IMC da curva usa medida linear normalizada quando exigido; distingui-lo do
IMC factual legado calculado sobre a medida original. Não alterar histórico.
Proposta de precisão a revisar: peso até três casas decimais e medida linear
uma casa, compatível com manual neonatal e grade OMS de 0,1 cm. Se aceitar
maior precisão, documentar lookup/interpolação oficial, sem ajuste silencioso.

Peso mínimo adulto 1 kg, altura mínima 30 cm e IMC técnico 8–100 **não
validam prematuros**. Definir limites positivos/finitos, plausibilidade e flags
por população com fonte. Medida fora da tabela mantém registro e motivo;
flag técnica não é diagnóstico nem autorização para extrapolar.

## 4. Escore, percentil e classificação OMS

LMS: `z = ((valor/M)^L - 1)/(L*S)`; caso L=0 usa logaritmo. Altura OMS
2007 tem L=1. Para indicadores de peso, o documento de cálculo OMS 2007
restringe LMS às caudas ±3:

```text
z > +3: 3 + (valor - SD(+3))/(SD(+3) - SD(+2))
z < -3: -3 + (valor - SD(-3))/(SD(-2) - SD(-3))
```

Confirmar aplicação correspondente para OMS 2006/indicadores e flags com
documentação oficial. Não presumir que INTERGROWTH usa esse mesmo método.
Documento OMS 2007 limita cálculo de percentil a z entre −3 e +3; fora,
mostrar limite textual, sem inventar percentil 0/100. Aproximação CDF deve
ter erro conhecido. Classificar pelo escore bruto, antes do arredondamento.

Proposta de intervalos derivada dos quadros MS/SISVAN 2011, páginas impressas
15–20, **a ratificar nas bordas**: a publicação tem inconsistências tipográficas
de desigualdades e equivalências percentílicas arredondadas.

| Indicador/faixa | Intervalos de z e rótulos propostos |
| --- | --- |
| Peso/idade | <−3 muito baixo; [−3,−2) baixo; [−2,+2] adequado; >+2 elevado |
| Comprimento/estatura/idade | <−3 muito baixo; [−3,−2) baixo; ≥−2 adequado |
| IMC <5 anos e peso/comprimento-estatura | <−3 magreza acentuada; [−3,−2) magreza; [−2,+1] eutrofia; (+1,+2] risco de sobrepeso; (+2,+3] sobrepeso; >+3 obesidade |
| IMC ≥5 anos/adolescentes | <−3 magreza acentuada; [−3,−2) magreza; [−2,+1] eutrofia; (+1,+2] sobrepeso; (+2,+3] obesidade; >+3 obesidade grave |

Aprovar redação completa dos rótulos e cortes exatos. Não substituir z por
percentis arredondados P3/P85/P97 para classificar. Escore sem referência
aplicável não recebe rótulo. Resultado não oferece diagnóstico/tratamento automático.

## 5. Prematuros

Idade pós-menstrual (PMA) em dias = IG ao nascer em dias + idade cronológica.
Proposta usual de idade corrigida = cronológica − (280 − IG ao nascer).
**Ratificar** fórmula, população, duração, base do limite (cronológica ou
corrigida) e eventual variação por IG. Não corrigir indefinidamente. Correção
negativa não vira zero silenciosamente; seguir referência neonatal aplicável.

Estudo primário INTERGROWTH (Villar et al., 2015): nascidos únicos entre 26 e
antes de 37 semanas, sem malformações, restrição de crescimento fetal ou
morbidade pós-natal grave; dados originados de população de baixo risco.
Documento SBP 2017 alerta para menor representação abaixo de 33 semanas.
**A equipe define a elegibilidade**, inclusive essas situações; registrar os
dados necessários para decidir. Não inferir elegibilidade pela IG sozinha.
Casos fora da população definida mantêm medidas/histórico sem classificação
automática até existir protocolo específico aprovado.

Na etapa INTERGROWTH: peso e comprimento por PMA, referência e unidade
próprias. Não prometer quatro indicadores OMS nem aplicar rótulos SISVAN.
Não incluir perímetro cefálico neste escopo sem nova decisão de produto.

Manual: 189–448 dias (27s0d–64s0d); troubleshooting: 189–454 dias
(27s0d–64s6d). Proposta do proprietário: INTERGROWTH até 64s0d inclusive,
OMS com idade corrigida depois; **revisão clínica deve ratificar essa borda**.
Fora do intervalo inferior, salvar medidas sem extrapolar.

**Lacuna computacional G01:** tabelas semanais arredondadas não fornecem
coeficientes/modelo ou dados diários suficientes. Obter fonte oficial e termos
de uso antes de calcular z/percentil, sem interpolação inventada, ajuste LMS
às tabelas arredondadas ou dependência da calculadora externa no runtime.
Séries INTERGROWTH/OMS ficam separadas; explicar troca de referência e idade.

## 6. Fórmulas adultas — revisão específica

Bloquear cintura/RCQ interpretativas e composição adulta nos novos registros
abaixo de 18, preservando medidas e razão factual. Idade desconhecida não
comprova elegibilidade adulta. Resultados históricos não são recalculados.

| Item | Faixa atualmente declarada no código | Decisão clínica necessária |
| --- | --- | --- |
| Pollock 3 e 7 | 18–61 | Sexo/população/faixa, especialmente 18–19 |
| Faulkner | 18–60 | População/faixa/entradas, especialmente 18–19 |
| Guedes | 18–30 | População/faixa/entradas, especialmente 18–19 |
| Cintura/RCQ | Sem bloqueio etário atual | Referência por sexo/idade/população e política 18–19 |

Faixas do código são evidência técnica, **não validação clínica independente**.
Revisar cada fórmula; não autorizar todas aos 18 por conveniência nem aplicar
um bloqueio geral <20 que o proprietário não aprovou. Sem decisão, gate aberto.
Gestação preserva seus bloqueios e tem precedência; sem cálculo pediátrico
adicional baseado apenas em idade durante uma avaliação gestacional.

## 7. Exemplos e provas a ratificar

1. Exemplo publicado OMS 2007: menino de 11 anos, IMC 30, L=−1,7862,
   M=16,9392, S=0,11070. LMS direto dá aproximadamente 3,24; ajuste de
   cauda dá aproximadamente **3,35**, não 3,24. Tolerância deve considerar
   arredondamento do exemplo, independente do cálculo de produção.
2. Para cada arquivo OMS, entrada na mediana M dá z≈0/percentil≈50; verificar
   importação/sexo/unidade. Isso é prova algébrica, não revisão clínica suficiente.
3. Testar z nos cortes −3, −2, +1, +2, +3 e imediatamente abaixo/acima,
   com os rótulos aprovados; não usar valor arredondado para escolher faixa.
4. Bordas: nascimento/dia seguinte, 730/731, fim OMS 2006/início 61 meses,
   peso aos 120/121 meses, altura/IMC aos 228/229, adaptação SISVAN e 20 anos.
5. Comprimento 45/110 cm e estatura 65/120 cm, fora das bordas, técnica
   inversa e ausente; comprovar +0,7/−0,7 e original preservado.
6. Prematuro sintético: IG 32s0d e idade cronológica 28 dias → PMA 36s0d,
   correção usual −28 dias; não classificar automaticamente como OMS no dia 0.
   Elegibilidade desse exemplo depende da decisão clínica, não é presumida.
7. PMA 26s6d/27s0d/64s0d/64s1d/64s6d; limite de correção quando decidido;
   ambos os sexos, múltiplos/RCIU/morbidade e informações incompletas.
8. Dados de prematuros <1 kg/<30 cm: conferir medidas e motivos sem impor
   faixa adulta; não tratá-los como clinicamente elegíveis por passarem no DTO.
9. Contexto corrigido após avaliação: snapshot anterior intacto, nova base
   separada no gráfico, replay idempotente retornando o resultado original.

## 8. Registro de ratificação (a preencher)

- [ ] Método de idade/lookup/intervalos e tabela aplicável fechado.
- [ ] Técnica, precisão, unidades, ajuste e plausibilidade ratificados.
- [ ] Caudas/percentis/flags e exemplos independentes conferidos.
- [ ] Bordas e redação SISVAN aprovadas por indicador/faixa.
- [ ] Elegibilidade INTERGROWTH e dados oficiais suficientes aprovados.
- [ ] Transição, duração e base de idade corrigida aprovadas.
- [ ] Limites específicos de fórmulas adultas, inclusive 18–19, definidos.
- [ ] Responsável, data, versão e resultado da revisão registrados.

Nenhum item marcado por inferência a partir das respostas de produto.

## 9. Consolidação rev2 — matriz CL-01 a CL-10

Integração técnica dos anexos rev1 em 2026-10-10. **Todas as ratificações
CL permanecem BLOCKED**; envio de parecer não é aceite clínico. Decisões de
produto da seção 1 permanecem válidas. Fontes abaixo estão no manifesto;
`anthro`/`anthroplus` foram apenas lidos, não executados nem incorporados.

Tipos de afirmação: **F** fato documental/código; **P** produto aprovado;
**T** recomendação técnica; **C** decisão clínica pendente. Recomendações
abaixo não autorizam alteração do classificador nem de usuários/permissões.

| ID | Evidência e proposta fundamentada | Impacto técnico e risco | Decisão formal necessária / prova prevista |
| --- | --- | --- | --- |
| CL-01 | F: `anthro` usa dias/30,4375 e idade <60 meses; `anthroplus` interpola L/M/S mensal, intervalo [60,229), WFA [60,121); XLSX e dados TXT têm grades distintas. P: adaptação SISVAN de IMC aos 19 anos. T: separar idade civil, idade estatística e idade efetiva SISVAN; usar interpolação oficial com âncoras verificadas. | T03/T04/T05/T10; lookup inteiro muda escores; calendário civil e idade estatística podem mudar referência em dias diferentes. Não escolher 1857 dias como transição só por fim do XLSX. | C: ratificar edição/método, transição (60 meses estatísticos versus aniversário), inclusão da fração de 120/228 meses e adaptação aos 19. Tabela de verdade com 29/02, 730/731, 1826/1827, 1856/1857, 60/61, 120/121, 228/229 e 20 anos. |
| CL-02 | F: código OMS ajusta +0,7 antes de 731 dias para em pé, −0,7 depois para deitado; marca técnica em pé com idade <9 meses como inconsistente. P: técnica explícita e original preservado. T: exigir reconferência, suspender indicadores lineares afetados e conservar WFA quando aplicável. | T03/T05/T06/T07; ajuste duplo altera IMC; suprimir todos os indicadores lineares é política clínica conservadora adicional, não reprodução literal completa do pacote. Sem técnica explícita não usar inferência OMS por idade/87 cm. | C: aprovar tratamento <9 meses, idade cronológica/corrigida para técnica, unidade/precisão, indicadores suprimidos e reconferência por novo snapshot. Bordas 9 meses e 730/731, ajuste único. |
| CL-03 | F: helpers OMS ajustam caudas de indicadores de peso; HFA usa LMS simples; percentil ±3 consta do documento OMS 2007. `anthroplus` interpola parâmetros e arredonda z a 2 casas antes de flags. T: conservar z bruto e z de exibição separados; classificar SISVAN pelo bruto, comparar referência na precisão que ela publica. | T04/T05/T07/T08/T09; igualar flags brutas às flags arredondadas sem declarar a política cria discrepância na borda. L=0/log é robustez matemática, não evidência de ocorrência nas tabelas. | C: ratificar caudas por indicador/edição, erro numérico/tolerância, flags bruto versus arredondado, percentil em `abs(z)=3` e caudas. Confrontar exemplos oficiais por sexo e indicador; sem validação por mediana apenas. |
| CL-04 | F: MS 2011 quadros 5–9/13 e MS 2008 usam algumas desigualdades diferentes/imprecisas; peso elevado não diagnostica obesidade. T: usar terminologia completa e intervalos sem sobreposição; documento 2011 como candidato principal, divergências explícitas. | T05/T07/T08; z exato −2/+1/+2/+3 pode mudar rótulo; percentil arredondado não substitui escore. | C: ratificar fonte prioritária e cortes da seção 4, inclusive igualdade. Rótulos: “Muito baixo peso/Baixo peso/Peso adequado/Peso elevado para a idade”; “Muito baixa estatura/Baixa estatura/Estatura adequada para a idade”. Confirmar grupos <5, 5–<10 e adolescentes. |
| CL-05 | F: Villar 2015/SBP 2017, população selecionada, menor representação <33 semanas; início da grade em PMA 27 semanas não define sozinho IG elegível ao nascer. P: equipe define elegibilidade, fora dela medidas sem classificação. T: condições explícitas e desconhecido impede afirmar elegibilidade. | T03/T06/T09/T10; IG isolada não decide múltiplos/RCIU/morbidade; transportar critérios do estudo literalmente pode excluir cuidados sem fundamento clínico. | C: definir IG/população, múltiplos, malformações, RCIU e morbidade grave; critérios/origem e campos mínimos. Não criar corte automático de 33 semanas sem ratificação. |
| CL-06 | F: quatro PDFs semanais arredondados/CSV de entradas não constituem modelo neonatal diário; novos links oficiais não fecharam a lacuna. T: obter algoritmo/coeficientes ou grade diária oficial com termos e oráculo independente. | T01/T04/T09; escore aparentemente plausível por interpolação inventada compromete validade clínica. Não usar LMS/caudas OMS por analogia. | C/T: aprovar fonte/método comprovado, precisão e termos após obtenção. Enquanto ausente, G01 BLOCKED. Se inviável, renegociar escopo expressamente; não substituir a entrega aprovada por curva aproximada ou retirar prematuros em silêncio. |
| CL-07 | F: manuais INTERGROWTH divergem 448/454 dias; SBP propõe transição perto de 64 semanas. P: levar 64s0d inclusive à revisão. T: PMA=IG+dias; corrigida=cronológica−(280−IG), sem clamp. Prazo AAP de 3 anos alegado no anexo não foi confirmado diretamente (403). | T03/T06/T09/T10/T15; prazo/base ou técnica indefinidos alteram série; elegibilidade OMS após etapa neonatal também precisa ser definida. | C: ratificar transição 64s0d/64s1d, começo/fim e prazo da correção, limite cronológico ou corrigido, variação por IG, critério para OMS após a transição e tratamento dos casos inicialmente não elegíveis. Não assumir 2/3 anos. |
| CL-08 | F: código declara Pollock 3/7 18–61, Faulkner 18–60, Guedes 18–30 e ainda calcula com avisos; não prova amostra por sexo/população. P: bloquear <18, discutir 18–19; gestação já bloqueia interpretações adultas. T: elegibilidade por fórmula, sem idade desconhecida autorizar composição. | T06/T11; bloquear tudo <20 contrariaria decisão de produto; permitir automaticamente aos 18 trataria faixa do código como revisão clínica. Preservar idoso/histórico e RCQ factual. | C: decisão individual para Pollock 3, Pollock 7, Faulkner, Guedes, cintura e RCQ nos 18–19, com fonte/amostra/sexo e precedência gestacional. Faixas gerais adultas mantidas salvo novo fato ratificado. |
| CL-09 | F: flags oficiais estritas HFA <−6/>+6; WFA <−6/>+5; WFL/H e BFA <−5/>+5; arredondamento antes das flags no código consultado. Edema declarado suprime z ligados a peso; regras de prevalência não são diagnóstico individual. T: medida preservada, flag/motivo por indicador e reconferência. | T05/T06/T07/T08; “fora de faixa” pode ser erro técnico, extrema medida ou referência inadequada. Flag não apaga dado, não diagnostica; edema não deve virar escore <−3 individual por regra de survey. | C: aprovar flags e precisão, visibilidade de z/rótulo flagado, edema sim/não/desconhecido e indicadores afetados. Definir limites técnicos pediátricos, sem impor 1 kg/30 cm/IMC8–100. |
| CL-10 | F: controlador atual aceita Professional, Collaborator e SuperAdmin autorizados; somente Professional é filtrado por carteira. Responsável cadastral não concede acesso autenticado. P: console, sem novo portal. T: reutilizar guardas/ExecutorTenant/RLS e DTO mínimo; não copiar exclusividade de emissão da Fase 312. | T06/T12/T13/T16; “só o responsável” sem decisão seria mudança de papel; endpoint legado projeta resultado cifrado inteiro, então novos campos exigem inventário de consumidores e allowlist. Dados de menores requerem finalidade/sigilo e minimização. | C/governança: ratificar adequação dos papéis atuais à finalidade clínica; eventual restrição exige decisão explícita e revisão de contrato. Confirmar responsáveis internos, retenção/retificação e sigilo sem novo opt-in/portal/fluxo legal inventado. |

### 9.1 Detalhes que corrigem simplificações do parecer

- O código oficial recente `anthro` troca `cmeasure` por NA em pé <9 meses,
  mas não transforma automaticamente a medida linear inteira em NA antes de
  calcular HFA/BMI. Portanto, a supressão seletiva proposta para OctaClin precisa
  de decisão CL-02, não de afirmação de equivalência literal ao software OMS.
- Regra vigente do produto exige técnica explícita. Não incorporar fallbacks
  de posição/edema desconhecido do software estatístico sem decisão clínica.
- Grade diária até 1856 e XLSX mensal a partir de 61 descrevem arquivos;
  pacote recente usa corte 60 meses. As três coisas permanecem distintas.
- Comparação matemática documental com os dois exemplos sintéticos oficiais
  femininos: 60,32 meses/113,8 cm/18,7 kg → WFA 0,21, HFA 0,96, BFA −0,58;
  60,911701 meses/113,6 cm/20,5 kg → 0,79/0,85/0,42. Valores coincidem a
  duas casas. Lookup inteiro daria WFA 0,23/0,86 e HFA 1,00/0,96.
  Evidência de interpolação, não teste do OctaClin nem validação clínica completa.
- Propostas da tabela SISVAN acima continuam pendentes; nomes completos aqui
  corrigem apresentação, não aprovam cortes novos. Usar peso elevado para a idade
  como obesidade é proibido pela própria nota MS 2011.

### 9.2 Registro de ratificação consolidada

Responsável/competência e evidências clínicas devem ser registrados em canal
interno protegido, sem PII real na documentação pública. Publicar apenas status,
versão/hash da ficha pública, data e referência opaca ao aceite interno.
Cada CL requer resposta explícita/evidência; T02 não deve usar um “sim” genérico
como confirmação de regras ainda ausentes. G01/G02 permanecem BLOCKED.
