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

## 10. Propostas para ratificação — integração REV3

**NÃO RATIFICADAS.** A aprovação documental com ressalvas não encerra CL-01–CL-10.
Esta seção refina a matriz rev2, sem apagar decisões/histórico. Fonte comum:
[manifesto](FONTES_ANTROPOMETRIA_FASE_314.md) e
[investigação com evidências](../history/phases/INVESTIGACAO_INTERGROWTH_FASE_314_REV3.md).
Fato, produto e preferência técnica/clínica continuam distintos. Todas as
recomendações abaixo exigem resposta humana explícita para esta versão.

### CL-01 — Idade e edição OMS

- **Preferência:** datas civis para idade real; eixo estatístico dias/30,4375 e
  interpolação L/M/S da edição oficial selecionada, sem lookup inteiro.
  Candidato de routing: OMS2006 <60 meses estatísticos, OMS2007 >=60; conservar
  idade civil e efetiva SISVAN separadas, com adaptação de IMC aos19 aprovada.
- **Fonte/justificativa:** código oficial anthro/anthroplus e manuais no
  manifesto; os TXT têm âncoras60/229/121 que não existem nos XLSX iniciais.
  Separar cobertura computacional de limite clínico por indicador.
- **Alternativa:** transição por quinto aniversário civil, somente com regra
  explícita e tabela de continuidade que resolva diferença de dias; não
  extrapolar curvas nem usar fim da planilha como aniversário.
- **Impacto/risco:** T03/T04/T05/T10, referência pode mudar em dias distintos;
  peso/idade até10 e altura/idade até19 dependem de borda ratificada, não só
  intervalo aceito pela implementação estatística.
- **Ratificar:** edição, routing, frações120/228 meses, borda20anos e SISVAN;
  29/02, 730/731,1826/1827,1856/1857,60/61,120/121,228/229 na tabela de verdade.

### CL-02 — Técnica e normalização

- **Preferência:** técnica explícita e ajuste único ±0,7 cm antes do IMC,
  preservar original; para OMS técnica segundo idade efetiva de referência
  ratificada. Na etapa INTERGROWTH usar comprimento deitado, sem transportar
  automaticamente ajuste OMS a uma curva neonatal.
- **Fonte/justificativa:** manual/helper OMS730/731 dias, regra<9 meses,
  referência INTERGROWTH comprimento. O helper em pé<9 meses não suprime todos
  os indicadores lineares sozinho; suspensão é política conservadora OctaClin.
- **Alternativa:** reproduzir literalmente todas as inferências do pacote;
  não preferida porque produto exige técnica explícita. Aceitar técnica inversa
  neonatal exigiria evidência específica, não só analogia com OMS.
- **Impacto/risco:** T03/T05/T07/T14; mudança de idade corrigida/cronológica
  pode mudar posição requerida e IMC. Não converter duas vezes nem apagarWFA.
- **Ratificar:** idade que rege técnica, em pé<9 meses suspender HFA/BFA/WFL-H
  e pedir nova conferência; WFA continua quando aplicável. Precisão0,001 kg e
  0,1 cm como candidata; maior precisão depende do lookup documentado.

### CL-03 — Estatística, precisão e percentis

- **Preferência:** z bruto preservado; SISVAN pelo bruto; apresentação a2casas.
  OMS: LMS/caudas de peso conforme edição, HFA sem cauda restrita; percentil
  numérico em |z|<=3 e indicação textual fora conforme manual2007.
  INTERGROWTH: z direto lognormal; sem ida/volta via percentil e sem LMS OMS.
- **Fonte/justificativa:** manuais/helpers oficiais e equações candidatas
  corroboradas pelo oráculo Oxford em 28 resultados sintéticos (14 casos únicos). Concordância
  numérica de amostra não ratifica aplicação clínica nem toda precisão.
- **Alternativa:** z arredondado governa todas as decisões, conforme algumas
  rotinas de survey; não preferida para cortar SISVAN por aproximação. Para
  percentil neonatal, apresentação numérica só em região ratificada com
  limite textual nas caudas; não herdar ±3OMS como fato neonatal.
- **Impacto/risco:** T05/T07/T08/T09; CDF extrema pode saturar0/100; falsa
  precisão e igualdade de borda. Flag técnica distinta da classificação.
- **Ratificar:** erro tolerado previamente por família/oráculo, caudas,
  apresentação neonatal/limites, igualdade±3 e política bruta versus2casas;
  não adotar tolerância depois de ver resultado discrepante.

### CL-04 — Terminologia e cortes SISVAN

- **Preferência:** orientaçõesMS 2011 como candidato principal e intervalos
  completos da seção4, sem lacunas/sobreposição; nomes completos da matrizrev2.
  Classificar pelo z, nunca por percentisP3/P85/P97 arredondados.
- **Fonte/justificativa:** quadros5–9/13MS 2011; MS 2008 é evidência complementar
  com divergências de desigualdade. Peso elevado/idade não significa obesidade.
- **Alternativa:** MS 2008 como edição prioritária se equipe assim decidir e
  revalidar tabela de verdade inteira; não misturar versões em cortes isolados.
- **Impacto/risco:** T05/T07/T08/T14; igualdade−3,−2,+1,+2,+3 muda rótulos;
  IMC<5 e>=5 tem terminologia diferente; IG não recebe rótuloSISVAN inicial.
- **Ratificar:** fonte prioritária, todos os intervalos/igualdades, grupos
  etários e redação; não transformar nota de vigilância em conduta automática.

### CL-05 — Elegibilidade e nascimento versus pós-natal

- **Preferência:** perfil explícito e conhecido compatível com população
  selecionada Villar 2015; IG isolada não comprova elegibilidade. Não criar
  corte33semanas automático. Informação desconhecida mantém medidas/motivo.
  Excluir medida ao nascimento/day0 do algoritmo pós-natal; janela0–2 dias
  suspensa até protocolo ratificado, sem instalar Newborn Size implicitamente.
- **Fonte/justificativa:** estudo primário (resumo), SBP 2017 e roteador gigs:
  primeira medida<3 dias é nascimento no pacote, que alerta se>0,5 dia. Esta
  política não é um consenso clínico universal nem identifica hora via data civil.
- **Alternativa:** avaliar pós-natal explicitamente na janela0–2 com evidência
  adicional; ou incluir Newborn Size em fase/escopo separado autorizado.
  Não identificar “nascimento” como primeira avaliação no sistema.
- **Impacto/risco:** T03/T06/T09/T10; campos mínimos cifrados para critérios
  e contexto da medida, por decisão. Excluir demasiado reduz cobertura;
  ampliar mistura populações/transversal/longitudinal sem validação.
- **Ratificar:** únicos/múltiplos,26–<37ao nascer,RCIU/malformações/morbidade,
  menores33 e casos fora desses critérios, fonte daIG, medidasiniciais/janela,
  necessidade de campo explícito e abordagem sem registro de hora nova.

### CL-06 — Modelo contínuo INTERGROWTH e G01

- **Preferência:** candidato contínuo μ/σ polinomial fracionário em log natural
  para peso/comprimento por PMA; faixa conservadora27s0d–64s0d. Implementação
  própria futura a partir da fonte científica autorizada; sem pacoteR/rede
  runtime e sem interpolar tabelas arredondadas.
- **Fonte/justificativa:** Villar 2015 atribuído nos dois códigos; commits/hashes
  no manifesto; oráculo Oxford sintético concordante. Modelo não é LMS.
  Resumo primário confirma método, mas não todos os coeficientes detalhados.
- **Alternativa:** grade diária oficial suficiente e autorizada, confrontada
  com oráculo. Se fonte/direitos não fecharem, renegociar escopo formalmente;
  não retirar prematuros nem fazer entregaOMS parcial sem aprovação.
- **Impacto/risco:** T01-C/T09; growthstandards aceita24–64s6d e usa inversaCDF
  suscetível a saturação; não transportar extensão/implementação. HC/WFLneonatal
  e Newborn Size permanecem fora do escopo apesar de funções disponíveis.
- **Ratificar/comprovar:** procedência/precisão científica, direitos concretos,
  domínio/caudas/percentis e tolerâncias, diário/bordas/extremos. Discrepância
  semanal55s,z−3 registrada; G01 segueBLOCKED, amostras não são gate completo.

### CL-07 — Transição e duração da idade corrigida (atualizada REV4)

**Proposta para decisão, NÃO RATIFICADA.** Elmrayed et al. (2025), DOI
[10.1038/s41372-024-02202-z](https://www.nature.com/articles/s41372-024-02202-z),
texto integral consultado, fornece evidência antropométrica para correção até
36 meses de **idade corrigida** em IG <32 semanas. Não demonstra política
universal para IG >=32; esta comparação não está mais sem fonte acessível.

| Fonte / população | Finalidade e resultado observado | Limite para a decisão OctaClin |
| --- | --- | --- |
| Elmrayed 2025, 1.416 sobreviventes, IG23–31 semanas (mediana27), UTIsIII Canadá, dados2001–2014 | Análise secundária longitudinal; peso, comprimento/estatura e perímetro por idade OMS 2006 aos0/4/8/21/36 meses corrigidos. Diferenças persistem até 36; autores recomendam correção para extremamente <28 e muito prematuros28–<32. | Não inclui moderados/tardios32–<37; perda22,1% no seguimento36meses, sem resultados cardiometabólicos. Perímetro não é acrescentado ao escopo OctaClin. Não valida coeficientes/elegibilidade INTERGROWTH. |
| RCPCH NICM, muito prematuros e problemas iniciais relevantes | Instrumento UK-WHO acompanha de23semanas a2anos **corrigidos**; transferência a outros gráficos aos2anos. | Alcance do instrumento, não ensaio mostrando que aos 24 meses desaparece benefício da correção; não prova regra32–36 semanas. |
| SBP 2017, monitoramento do prematuro | Recomenda INTERGROWTH até 64PMA e depois OMS/MS; alerta para poucos <33; em<32 discutir canal após estabilização do peso. | Não estabelece nesse documento prazo completo24/36 meses; canal após perda inicial não cria automaticamente novo cálculo/classificador. PDF local revalidado pelo hash, novo acesso403. |
| SBP 2023, orientação a famílias indicada pela REV4 | Parecer externo relata idade corrigida nos primeiros2anos para **desenvolvimento**. | Página403 neste ciclo; informação ainda secundária, base cronológica/corrigida e protocolo antropométrico não confirmados diretamente. Equipe deve fornecer texto/edição para ratificar uso. |

**Comparação crítica por indicador:** o estudo encontra aos 36 meses corrigidos
baixa estatura em18,9% pela idade cronológica versus9,9% pela corrigida;
baixo peso14,2% versus8,6%. Não se conclui daí que todos os indicadores
mudam igualmente: WFL não varia diretamente com idade e não houve diferenças
nessa classificação0–2 anos; aos 36 meses, proporção de sobrepeso por IMC foi1,8%
nas duas bases. IMC/idade depende da idade, mas benefício/efeito de seus rótulos
não é idêntico a peso/idade/estatura. Técnica, roteamento WFL/WFH e faixa de
aplicação ainda podem depender da idade escolhida e exigem CL-01/02/04.
Os cortes do estudo são OMS 2008, não ratificam os rótulos SISVAN do produto.

**Preferência proposta para a equipe:** política versionada por IG, preservar
INTERGROWTH até 64s0d inclusive →OMS com idade corrigida após essa borda,
sujeita a elegibilidade/ratificação já pendentes. Para IG <32s0d, levar **36
meses corrigidos** como proposta preferencial, fundamentada em Elmrayed 2025.
Para IG32s0d–36s6d, levar **24 meses corrigidos como opção local provisória a
ratificar**, sem alegar validação direta nessa população: instrumento RCPCH
apoia existência de política24corrigidos, mas não comprova esse estrato;
SBP 2023 relatada trata desenvolvimento e não supre essa lacuna.
Equipe pode exigir protocolo específico para32–36 em vez de aceitar essa opção.
Não programar nenhum prazo enquanto não houver resposta formal por faixa.

**Alternativas:** 24 corrigidos para todos (simplicidade, risco de subestimação
após24 em<32 segundo estudo); 36 corrigidos para todos (simplicidade, extrapola
população>=32 sem evidência direta); estratos/exceções adicionais com fonte;
cronológica após64 como GIGS (diverge da escolha de produto e da evidência<32,
exigiria revisão explícita). Não oferecer seletor ad hoc ao operador.

**Resposta necessária CL-07:** confirmar ou alterar prazo/base para <28,
28–<32 e32–<37, finalidade por indicador e casos de IG desconhecida; ratificar
64s0d/64s1d e tratamento de não elegíveisIG após transição; aprovar regra exata
de borda/técnica/fim da correção. Proposta de janela clínica: comparar data
corrigida `dataAvaliacao − (280−IGdias)` com nascimento+24/36 meses **civis**,
inclusão do dia-limite e cronológica a partir do seguinte. Essa igualdade e a
convenção29/02 são escolhas locais, não resultados demonstrados pelo artigo;
CL-01 deve compatibilizar calendário da janela com lookup estatístico OMS.

**Impacto/risco:** T03/T09/T10/T15; IG32s0d em64s1d=225 dias cronológicos,
169 corrigidos. Guardar duas idades, PMA, IG e versão da política na cifra,
sem recalcular antigos; séries separadas no término, medidas preservadas.
Limites <32 são população da evidência de correção OMS, **não novos cortes
para elegibilidade INTERGROWTH**. CL-05 continua separada; dado desconhecido
não vira termo nem prematuro elegível automaticamente.

### CL-08 — Interpretações adultas 18–19 por fórmula

- **Preferência:** cumprir bloqueio<18 já aprovado. Em18–19 autorizar somente
  cada fórmula/sexo/população que a equipe documente; item sem evidência fica
  pendente de elegibilidade, preservando medidas/RCQ factual. Não equivaler
  maioridade à validade científica nem impor bloqueio geral<20 por conveniência.
- **Fonte/justificativa:** faixas declaradas no código Pollock3/7,Faulkner,Guedes
  e cintura/RCQ sem guard; **não são evidência de amostras clínicas originais**.
  Publicações primárias por fórmula ainda devem ser trazidas à ratificação.
- **Alternativa:** suspender todas as interpretações18–19 por política clínica
  explícita; ou aprovar fórmulas determinadas, nunca um “liberado aos18” genérico.
- **Impacto/risco:** T11 antesT06; validação legada/backend/gestacional, sem
  histórico recalculado. Suspensão não pode afetar cálculo factual nem idosos
  por alteração de limites globais não discutida.
- **Ratificar:** seis decisões separadas: Pollock3,Pollock7,Faulkner,Guedes,
  cintura,RCQ, fonte original/sexo/amostra/limites18–19 e precedência gestacional.

### CL-09 — Plausibilidade, edema e dados incoerentes

- **Preferência:** conservar medidas; flags por indicador pelo z bruto como
  política clínica conservadora candidata, registrar diferença da flag oficial
  arredondada. Sem classe automática para indicador flagado; pedir reconferência.
  Edema confirmado suprime interpretações dependentes de peso, não HFA por si só.
- **Fonte/justificativa:** cortes estritos oficiais HFA−6/+6,WFA−6/+5,BFA/WFL-H
  −5/+5 e helpers consultados arredondam antes das flags. Regras de prevalência
  com edema não autorizam escore artificial−3 ou diagnóstico individual.
- **Alternativa:** flags depois de2casas para equivalência de survey, com
  distinção explícita; zflagado visível sob aviso versus oculto. Edema desconhecido
  requer decisão sobre bloquear cálculo de peso, não virar “não” implicitamente.
- **Impacto/risco:** T03/T05/T06/T08; preservar estados/motivos seletivos,
  não usar faixas1kg/30 cm/IMC8–100adultas no prematuro. Flag estatística não é
  validação de ingresso nem diagnóstico. Dados não finitos/não positivos rejeitados.
- **Ratificar:** flags brutas/arredondadas, exibição de zflagado, edema
  sim/não/desconhecido (preferência: não classificar dependentes de peso se
  necessário mas desconhecido), limites técnicos/precisão e reconferência.

### CL-10 — Papéis, sigilo, histórico e finalidade

- **Preferência:** manter contrato atual Professional/carteira ativa,
  Collaborator/SuperAdmin com permissão/tenant, até decisão explícita de mudança;
  projeção mínima/cifrada, RLS/replay autorizado, console somente. Responsável
  cadastral não vira acesso legal e não criar portal/consentimento implicitamente.
- **Fonte/justificativa:** controlador/resolvedor/ExecutorTenant, ORM e1068
  revisados rev2. JSONresultado integral requer allowlist real, não só tipoTS;
  UPDATE protegido não comprova DELETE/grants reais nem migration aplicada.
- **Alternativa:** restringir ato clínico aProfessional autorizado mediante
  decisão de produto/governança, separando visualização de registro; não
  transpor emissão exclusiva312 automaticamente ao módulo antropometria.
- **Impacto/risco:** T06/T12/T13/T16, alteração de papéis pode quebrar contratos;
  dados de menores exigem finalidade/sigilo/retensão, nenhumaPHI em logs/URL.
- **Ratificar:** finalidade e adequação dos papéis, responsabilidade clínica,
  retenção/retificação/exclusão lógica existentes. Permissões/grants/1068 exigem
  prova futura de ambiente, nunca aceite clínico como substituto operacional.

### 10.1 Registro necessário para liberar

Para cada CL: decisão/alternativa aceita, fonte/edição recuperável, exceções,
critérios e exemplos, versão/hash da ficha e referência opaca ao aceite interno.
Sem PII do revisor no Git. CL-05/06/07 são as principais decisões neonatais;
CL-01/03/04/09 fecham bordas numéricas e CL-08/10 contratos/proteções.
G01 exige também evidência técnica e direitos; G02 aceite clínico específico;
G03 autorização expressa de implementar/testar, separada de ambos.

## 11. Matriz final de decisão CL-01–CL-10 — REV4

**Pendente de respostas humanas.** A coluna “resposta necessária” é o formulário
para decisão; registrar `aprovar proposta` ou `alterar: regra + fonte + exceção`.
Nenhuma célula representa aceite já recebido. Seções9/10 conservam detalhes e
riscos; CL-07 foi atualizada com fonte diretamente consultada nesta rodada.

| CL | Proposta preferencial | Fonte científica/documental | Alternativa | Implicações / riscos | Resposta necessária da equipe |
| --- | --- | --- | --- | --- | --- |
| CL-01 | Datas civis reais, idade estatística dias/30,4375, interpolaçãoLMS com âncoras; routingOMS aos60meses estatísticos como candidato, notaSISVAN19anos preservada | Manuais OMS 2006/2007 e anthro/anthroplus fixos no manifesto | Quinto aniversário civil com tabela explícita de transição | Dias de troca/frações120/228/229 e janela24/36 podem diferir; evitar lacuna/extrapolação | Escolher edição/método/routing e bordas por indicador; ratificar29/02,19→20 e calendário da janelaCL-07 |
| CL-02 | Técnica explícita, original preservado, ±0,7OMS uma única vez antes do IMC; comprimento deitado neonatal; suspender lineares inconsistentes<9 meses | Manual/helper OMS e referência comprimentoIG; supressão é política local conservadora | Comportamento literal do pacote ou exceção neonatal com fonte | Idade da técnica corrigida/cronológica muda resultado; não levar ajusteOMS a IG automaticamente | Confirmar idade que governa técnica, precisão, indicadores suspensos<9 meses e reconferência |
| CL-03 | zbruto classificaSISVAN, exibição2casas; caudasOMS próprias; IGlognormal direto, percentis sem saturação falsa; tolerâncias prospectivas | ManualOMS2007/helpers, candidatoIG e28resultados sintéticos oficiais preservados | Flags/classificação arredondadas para equivalência de survey declarada | Não confundir tolerância computacional com validade clínica/erro de medida | Aprovar cálculo/caudas/percentis/limites de exibição e tolerâncias do protocoloREV4, sem reajuste para55s |
| CL-04 | OrientaçõesMS2011 como candidato principal; tabela de intervalos e nomes completos sem sobreposição | QuadrosMS2011 e divergênciasMS2008 identificadas | MS 2008 prioritário com tabela integral revalidada | Igualdade−3/−2/+1/+2/+3 muda rótulo; peso elevado não diagnostica obesidade | Ratificar edição, todos os cortes inclusivos/exclusivos e nomes por grupo, nota19anos |
| CL-05 | Critérios de elegibilidade conhecidos e explícitos; nascimento distinto do pós-natal; proposta local de suspender0–2 dias, sem Newborn Size | Villar 2015/resumo, SBP 2017, política primeira medida<3 dias do gigs | Pós-natal precoce com protocolo próprio; outro escopoNewbornSize autorizado | Janela0–2 não é regra universal; primeira avaliação cadastrada não indica nascimento; população não inferida pelaIG isolada | Definir IG/comorbidades/múltiplos/RCIU, dados mínimos/contexto da medida e aceitar/alterar janela0–2 |
| CL-06 | Modelo contínuo candidato peso/comprimento porPMA27s0d–64s0d; implementação própria futura após procedência/direitos, oráculos finitos eoffline | Equações atribuídas aVillar, dois commitsR, calculadoraOxford ePDFs oficiais; detalhes primários pendentes | Grade diária oficial autorizada; decomposição do escopo só por nova aprovação | Coeficiente compartilhado não é prova independente;55s permanece ressalva; não copiarR nem ampliar24–64s6d | Ratificar método/domínio/população/apresentação e prioridade modelo versusPDF; aceite condicionado às provas técnicas/direitos abertas |
| CL-07 | Preferir36meses **corrigidos para IG<32**; para32–<37, opção24corrigidos local provisória a ratificar; IG→OMScorrigida após64s0d | Elmrayed 2025:36 corrigidos em<32; RCPCHNICM:24 corrigidos no instrumento; SBP 2017:transição64; SBP 2023 indireta/desenvolvimento | 24universal;36universal; estratos específicos; cronológica comoGIGS com revisão de produto | Não universalizar estudo<32; base civil/estatística e indicação dependem de CL-01/02; WFL não depende diretamente daidade | Prazo/base explícitos para<28,28–<32,32–<37, casos desconhecidos, limite inclusivo, indicadores/técnica e exceções; fornecerSBP2023 se usada |
| CL-08 | Bloqueio<18 aprovado;18–19 por fórmula/sexo/população documentados, sem elegibilidade automática | Código declara faixas; **publicações primárias por fórmula ainda não ratificadas** | Suspensão clínica explícita dos itens18–19 sem evidência | Faixa do código não valida amostra; preservar medidas/RCQfactual/idosos/gestação | Seis respostas:Pollock3,Pollock7,Faulkner,Guedes,cintura,RCQ, cada uma com fonte/população e autorização ou suspensão |
| CL-09 | Preservar medida, flags brutas por indicador como política candidata, sem classe automática flagada; edema impede interpretações afetadas | Flags/helpersOMS, política individual distinta de survey | Flags após2casas; zflagado só sob aviso ou oculto | Edema desconhecido não equivale anão; não aplicar1kg/30 cm/IMCadulto; demais indicadores continuam | Aprovar flags/limites/precisão/exibição, edema sim/não/desconhecido e motivos seletivos/conferência |
| CL-10 | Papéis atuais/carteira/tenant preservados até decisão explícita; console/cifra/RLS/replay/allowlists/histórico | Contratos reais/ORM/controlador/ExecutorTenant/1068; decisão de produto console | Restrição de ato clínico porProfessional com decisão e revisão de contrato | Política clínica não prova grants/DELETE/aplicação1068; sem portal/representação legal implícita | Confirmar finalidade/papéis/responsabilidade/retenção e exclusão lógica; restrição nova só por aprovação explícita |

### 11.1 Fechamento objetivo, sem outra rodada genérica

1. Equipe responde os dezCL, incluindo subdecisõesCL-07/08, para versão/hash
   desta ficha e referência interna protegida. Fonte ausente: anexar edição,
   não preencher como aprovado. Nenhum nome/PII do revisor no Git.
2. Responsável técnico completa somente lista fechada de procedência/oráculos/
   tolerâncias/OMS descrita no plano e checklist. Se artefato indisponível,
   trazer resposta do fornecedor ou decisão explícita sobre exceção/escopo.
3. Responsável por direitos decide a forma concreta de incorporar equação/dados/
   obras, com permissões/atribuição necessárias. Não enviar contato em nome da
   clínica sem autorização; roteiro de consulta disponível no relatório.
4. G01 sóPASS com evidências; G02 sóPASS com ratificação; G03 autorização
   expressa de implementação/testes separada. T03–T18 permanecem bloqueadas.
