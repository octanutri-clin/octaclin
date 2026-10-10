# Ficha para validação clínica — Fase 313

Status: **aguarda revisão e confirmação do proprietário/equipe clínica**.
Preparada em 2026-10-10. Não é protocolo já validado nem autorização de implantação.
As escolhas de produto foram confirmadas; esta ficha exige conferência clínica
específica das regras e da transcrição. Não há dados de pacientes nesta ficha.

## 1. Fonte e versão propostas

- Tabela numérica: [Guia MS/UFS 2022, anexo, p. impressa 50 / PDF 51](https://docs.bvsalud.org/biblioref/2022/12/1401909/livro_saps_guia_organizacao_vigilancia_alimentar_nutricional_2022.pdf).
- Regras de dias/população: [Caderneta Brasileira das Gestantes, seção p. 87](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/saude-da-mulher/publicacoes/caderneta-brasileira-das-gestantes.pdf), consultada em 2026-10-10.
- Referência científica: Kac et al., 2021, [DOI 10.1093/ajcn/nqaa402](https://doi.org/10.1093/ajcn/nqaa402).
- Origem do peso e aplicabilidade: [FEBRASGO 2023, DOI 10.1055/s-0043-1766109](https://www.scielo.br/j/rbgo/a/Tz7zqByTjv9WYwwcjWCKMRH/?lang=en).
- Proveniência gráfica: [UFRJ, dataset V3](https://dataverse.nutricao.ufrj.br/dataset.xhtml?persistentId=hdl:20.500.12783/170).

Identificador proposto: `ms_ufs_2022_semanal_v1`, algoritmo
`ganho_gestacional_v1`. Preservar fonte/versão no resultado; mudança posterior
cria outra versão, sem recalcular avaliações antigas. Curvas de faixa, sem
calcular percentil individual, escore Z ou previsão de peso.

## 2. Regras que precisam ser aprovadas em conjunto

1. Idade >=18 na data da avaliação, feto único, risco habitual confirmado.
   Tipo/risco desconhecidos não classificam; idade sem nascimento disponível
   não é inferida. Sexo do cadastro não substitui condição gestacional.
2. Peso pré-gestacional medido ou informado. Alternativa proposta: medida
   feita **até 8 semanas e 0 dias**, com semana/dias e origem registrados.
   Este limite conservador precisa de aceite: “até 8 semanas” também pode ser
   lido como toda a oitava semana. Não adotar 8s6d sem decisão clínica.
3. IMC de referência = peso de referência / altura em metros ao quadrado.
   Cortes brutos: <18,5 baixo peso; [18,5;25) eutrofia; [25;30) sobrepeso;
   >=30 obesidade. Não arredondar antes de selecionar grupo; sem Lipschitz.
4. Ganho acumulado = peso atual - referência. Negativo é válido, não zero.
   Não substituir por ganho desde primeiro atendimento ou por IMC atual.
5. Semana da curva: dias 0–3 mantêm semanas completas; dias 4–6 usam semana
   seguinte. Preservar também semanas/dias originais. Aplicabilidade proposta
   depende da **semana arredondada entre 10 e 40**, inclusive: 9s4d usa 10;
   40s3d usa 40; 40s4d fica sem faixa. Confirmar explicitamente essas bordas.
6. Comparar ganho sem arredondamento de exibição; limites inclusivos. Usar
   aritmética decimal ou escala inteira compatível com precisão aceita dos
   pesos; não aplicar tolerância clínica arbitrária para resolver float.
7. Peso/altura devem ser positivos e plausíveis conforme validações existentes;
   baseline com IMC fora de 8–100 fica sem classificação, sem normalizar valor.
   Faltas/impossibilidade preservam medidas e mostram motivos claros.
8. Gestante não recebe interpretações adultas de IMC atual, cintura/RCQ nem
   equações de gordura/massas. Medidas brutas permanecem, histórico não muda.
9. Classificação textual: abaixo/dentro/acima da faixa da referência. Não
   equivale a diagnóstico, prescrição ou recomendação de perder peso. Portal
   orienta discutir o acompanhamento com o profissional, sem alarmismo.

## 3. Divergência editorial que exige aceite explícito

Na semana 13, a tabela semanal fornece sobrepeso **[-1,6;-0,5]** e obesidade
**[-1,7;-0,5] kg**. O quadro resumido do guia e o
[cartaz cumulativo MS 2024](https://bvsms.saude.gov.br/bvs/cartazes/ganho_peso_gestacional.pdf)
apresentam valores diferentes para esses grupos (incluindo -0,05/+0,05).
Proposta: usar exclusivamente a tabela semanal abaixo; não combinar com o
quadro trimestral nem deduzir casas decimais. A revisão deve conferir esse
ponto e todas as linhas na fonte. A escolha aqui não afirma que houve errata
oficial. Se a equipe discordar, anexar fonte validada e revisar ficha/testes.

## 4. Faixas semanais propostas (kg, extremos inclusivos)

Intervalos [mínimo;máximo]; números transcritos para revisão, ainda sem módulo
runtime. Cada grupo corresponde ao IMC da referência, nunca ao IMC da avaliação.

| Semana | Baixo peso | Eutrofia | Sobrepeso | Obesidade |
| --- | --- | --- | --- | --- |
| 10 | [-0,7;0,3] | [-2,4;0,0] | [-2,3;-1,3] | [-1,8;-0,8] |
| 11 | [-0,4;0,6] | [-2,2;0,2] | [-2,1;-1,0] | [-1,7;-0,7] |
| 12 | [-0,1;0,9] | [-2,0;0,4] | [-1,8;-0,8] | [-1,7;-0,6] |
| 13 | [0,2;1,2] | [-1,8;0,7] | [-1,6;-0,5] | [-1,7;-0,5] |
| 14 | [0,5;1,6] | [-1,6;0,9] | [-1,4;-0,2] | [-1,6;-0,4] |
| 15 | [0,8;1,9] | [-1,3;1,2] | [-1,1;0,0] | [-1,5;-0,2] |
| 16 | [1,2;2,3] | [-1,1;1,5] | [-0,9;0,3] | [-1,4;-0,1] |
| 17 | [1,5;2,7] | [-0,8;1,8] | [-0,6;0,6] | [-1,3;0,1] |
| 18 | [1,9;3,1] | [-0,4;2,2] | [-0,3;0,9] | [-1,2;0,3] |
| 19 | [2,3;3,6] | [0,0;2,7] | [-0,1;1,2] | [-1,0;0,5] |
| 20 | [2,7;4,0] | [0,4;3,1] | [0,2;1,5] | [-0,8;0,7] |
| 21 | [3,1;4,5] | [0,8;3,6] | [0,5;1,8] | [-0,6;0,9] |
| 22 | [3,5;4,9] | [1,2;4,1] | [0,8;2,1] | [-0,4;1,2] |
| 23 | [4,0;5,4] | [1,6;4,5] | [1,1;2,4] | [-0,1;1,4] |
| 24 | [4,4;5,9] | [2,0;5,0] | [1,4;2,7] | [0,2;1,7] |
| 25 | [4,8;6,3] | [2,4;5,4] | [1,7;3,1] | [0,5;2,0] |
| 26 | [5,2;6,8] | [2,7;5,9] | [2,0;3,4] | [0,8;2,4] |
| 27 | [5,6;7,2] | [3,1;6,3] | [2,3;3,7] | [1,1;2,7] |
| 28 | [6,0;7,7] | [3,4;6,7] | [2,6;4,1] | [1,4;3,0] |
| 29 | [6,3;8,1] | [3,8;7,1] | [3,0;4,4] | [1,7;3,4] |
| 30 | [6,7;8,5] | [4,1;7,5] | [3,3;4,8] | [2,0;3,7] |
| 31 | [7,1;8,9] | [4,5;7,9] | [3,7;5,2] | [2,3;4,0] |
| 32 | [7,4;9,3] | [4,8;8,3] | [4,0;5,6] | [2,7;4,4] |
| 33 | [7,7;9,7] | [5,2;8,8] | [4,4;6,0] | [3,0;4,7] |
| 34 | [8,1;10,1] | [5,5;9,2] | [4,8;6,4] | [3,3;5,1] |
| 35 | [8,4;10,4] | [5,9;9,7] | [5,2;6,8] | [3,6;5,4] |
| 36 | [8,6;10,8] | [6,3;10,1] | [5,5;7,2] | [4,0;5,7] |
| 37 | [8,9;11,1] | [6,7;10,6] | [5,9;7,6] | [4,3;6,1] |
| 38 | [9,2;11,5] | [7,0;11,0] | [6,4;8,0] | [4,6;6,4] |
| 39 | [9,5;11,8] | [7,4;11,5] | [6,8;8,5] | [4,9;6,8] |
| 40 | [9,7;12,2] | [8,0;12,0] | [7,0;9,0] | [5,0;7,2] |

## 5. Casos sintéticos para aceite e futuros testes

| Caso | Resultado esperado após aprovação |
| --- | --- |
| Referência 60 kg, 160 cm; 22s0d; peso 61,2 kg; adulta, única, habitual | IMC 23,4375/eutrofia; ganho 1,2; faixa [1,2;4,1]; dentro |
| Mesmo caso, 64,1 kg | Ganho 4,1; dentro (limite superior inclusivo) |
| Mesmo caso, 61,19 kg / 64,11 kg | Ganho 1,19 abaixo / 4,11 acima, sem arredondar para decidir |
| Referência 80 kg, 160 cm; 13s0d; peso 79,5 kg | IMC 31,25/obesidade; ganho -0,5 dentro, não zero |
| Referência 80 kg, 160 cm; 13s0d; peso 78,35 kg | Ganho -1,65 dentro na tabela semanal; prova da divergência com resumo |
| IMC bruto 18,4999 / 18,5 / 24,9999 / 25 / 29,9999 / 30 | Baixo / eutrofia / eutrofia / sobrepeso / sobrepeso / obesidade |
| 12s3d / 12s4d | Curva da semana 12 / 13; idade original preservada |
| 9s3d / 9s4d / 40s3d / 40s4d | Sem faixa / semana 10 / semana 40 / sem faixa, conforme proposta |
| Origem medida inicial, 8s0d / 8s1d | Referência aceita / não aplicável, conforme limite conservador proposto |
| Idade 17 na avaliação / exatamente 18 | Sem classificação / elegível se demais critérios atendidos |
| Múltipla / alto risco / risco desconhecido / referência ausente | Medidas preservadas, sem classificação, motivo específico |
| Alterar perfil atual ou criar referência v2 | Resultado v1 permanece igual; série v2 separada |
| Gestante com cintura, quadril e dobras | Medidas/RCQ factual preservados; sem interpretações adultas/composição |

## 6. Registro de revisão

- [ ] Conferir fonte semanal e transcrição das 31 linhas/quatro grupos.
- [ ] Aprovar o tratamento das divergências da semana 13.
- [ ] Confirmar idade >=18 na avaliação, feto único e risco habitual.
- [ ] Confirmar origem e limite de medida substituta até 8s0d.
- [ ] Confirmar arredondamento dos dias e bordas 9s4d/40s3d/40s4d.
- [ ] Confirmar inclusividade, precisão, exemplos e textos sem prescrição.
- [ ] Registrar confirmação clínica no handoff (data e resposta documental,
      sem publicar dados pessoais da equipe).

Se qualquer item divergir, alterar esta ficha e seus exemplos antes do
classificador. Sem resposta explícita não marcar itens acima nem anunciar
validação. [Plano técnico](../history/phases/PLANO_FASE_313.md).
