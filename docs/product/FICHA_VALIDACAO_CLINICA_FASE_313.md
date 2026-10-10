# Ficha para validação clínica — Fase 313

Status: **regras ratificadas pela equipe/responsável, conforme confirmação do proprietário nesta conversa em 2026-10-10**.
Preparada e ratificada em 2026-10-10. A ratificação das regras não constitui autorização de implantação em ambiente externo.
O [parecer recebido](PARECER_REVISAO_FASE_313.md), datado de 10/10/2026,
relata conferência sem divergências das 31 linhas/124 faixas/248 valores.
Isso constitui conferência documental relatada, não aprovação clínica final.
Ratificação recebida: “Ficha revisada; equipe/responsável ratifica todas as regras”. Não há dados de pacientes nesta ficha.

## 1. Fonte e versão ratificadas

- Tabela numérica: [Guia MS/UFS 2022, anexo, p. impressa 50 / PDF 51](https://docs.bvsalud.org/biblioref/2022/12/1401909/livro_saps_guia_organizacao_vigilancia_alimentar_nutricional_2022.pdf).
- Regras de dias/população: [Caderneta Brasileira das Gestantes 2026, p. impressa 87 / página 88 do arquivo (índice 87)](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/saude-da-mulher/publicacoes/caderneta-brasileira-das-gestantes.pdf), consultada em 2026-10-10.
- Referência científica: Kac et al., 2021, [DOI 10.1093/ajcn/nqaa402](https://doi.org/10.1093/ajcn/nqaa402).
- Origem do peso e aplicabilidade: [FEBRASGO 2023, DOI 10.1055/s-0043-1766109](https://www.scielo.br/j/rbgo/a/Tz7zqByTjv9WYwwcjWCKMRH/?lang=en).
- Referência gráfica adicional: [UFRJ, dataset V3](https://dataverse.nutricao.ufrj.br/dataset.xhtml?persistentId=hdl:20.500.12783/170).
  Não conferida integralmente pelo parecer recebido e não usada como fonte
  dos números. O download/checksum observado no planejamento anterior está
  registrado no plano; não equivale à validação desse dataset pelo parecer.

Identificador: `ms_ufs_2022_semanal_v1`, algoritmo
`ganho_gestacional_v1`. Preservar fonte/versão no resultado; mudança posterior
cria outra versão, sem recalcular avaliações antigas. Curvas de faixa, sem
calcular percentil individual, escore Z ou previsão de peso.

## 2. Regras ratificadas em conjunto

1. Idade >=18 na data da avaliação, feto único, risco habitual confirmado.
   Tipo/risco desconhecidos não classificam; idade sem nascimento disponível
   não é inferida. Sexo do cadastro não substitui condição gestacional.
2. Peso pré-gestacional medido ou informado. Alternativa proposta: medida
   feita **até 8 semanas e 0 dias**, com semana/dias e origem registrados.
   Este limite é uma decisão conservadora local, não citação literal da fonte, e precisa de aceite: “até 8 semanas” também pode ser
   lido como toda a oitava semana. Não adotar 8s6d sem decisão clínica.
   Origem em enum próprio; data do peso quando conhecida, ausência explícita
   quando não conhecida; vínculo à gestação e versão preservados. Peso inicial
   exige idade gestacional da medida substituta. O proprietário aprovou incluir
   “peso habitual” como origem própria: `peso_habitual_informado`. Proposta de
   uso: profissional confirma que representa o peso habitual anterior à gestação,
   informando valor, origem e data quando conhecida (ou ausência explícita).
   Não estimar pelo peso atual nem converter a origem para pré-gestacional medido.
   Usar esta alternativa quando não houver peso pré-gestacional conhecido;
   não escolher ou substituir uma referência silenciosamente. Sem confirmação
   dessa base, registrar medidas sem classificação. Regra ratificada na confirmação acima.
3. IMC de referência = peso de referência / altura em metros ao quadrado.
   Cortes brutos: <18,5 baixo peso; [18,5;25) eutrofia; [25;30) sobrepeso;
   >=30 obesidade. Não arredondar antes de selecionar grupo.
4. Ganho acumulado = peso atual - referência. Negativo é válido, não zero.
   Não substituir por ganho desde primeiro atendimento ou por IMC atual.
5. Semana da curva: dias 0–3 mantêm semanas completas; dias 4–6 usam semana
   seguinte. Preservar também semanas/dias originais. Aplicabilidade proposta
   depende da **semana arredondada entre 10 e 40**, inclusive: 9s4d usa 10;
   40s3d usa 40; 40s4d fica sem faixa. Confirmar explicitamente essas bordas.
   Idade gestacional é confirmada pelo profissional para a data da avaliação,
   com origem `pre_natal|ultrassonografia|dum|nao_informada`, preservada cifrada.
   Não calcular a IG automaticamente pela DUM/USG nem transportar IG de hoje
   para avaliação antiga. Se a fonte tem outra data, o profissional informa
   a IG correspondente à avaliação; guardar a data da fonte quando disponível.
   Sem IG ou com origem desconhecida, salvar medidas sem classificação e com
   motivo. Semanas/dias inválidos ou data da fonte posterior à avaliação são
   rejeitados; inconsistência declarada pelo profissional impede classificação.
   Não deduzir inconsistência clínica comparando registros de gestações distintas.
6. Comparar ganho sem arredondamento de exibição; limites inclusivos. Usar
   aritmética decimal ou escala inteira compatível com precisão aceita dos
   pesos; não aplicar tolerância clínica arbitrária para resolver float.
7. Qualidade dos dados é uma checagem técnica separada da aplicabilidade clínica.
   Peso/altura positivos e plausíveis; IMC 8–100 é heurística técnica local já
   usada pelo domínio adulto (`LIMITES.imc`), não limite das curvas MS/FEBRASGO.
   Proposta: manter essa proteção para a referência, guardar medidas e mostrar
   motivo `referencia_fora_plausibilidade_tecnica` fora do intervalo, sem faixa.
   Não corrigir, truncar ou substituir valores. A aplicação à referência gestacional
   foi ratificada nesta ficha; testar limites e distinguir o motivo na UI.
8. Gestante não recebe interpretações adultas de IMC atual, cintura/RCQ nem
   equações de gordura/massas. RCQ factual pode ser mostrado como razão numérica,
   sem classificação, alerta de risco ou gatilho automatizado derivado. Medidas
   brutas permanecem; protocolos de gordura ficam sem resultado novo calculado.
   Resultados históricos são exibidos como históricos, sem recalcular ou usá-los
   para gerar interpretação atual da gestante.
9. Classificação textual: abaixo/dentro/acima da faixa da referência. Não
   equivale a diagnóstico, prescrição ou recomendação de perder peso. Portal
   orienta discutir o acompanhamento com o profissional, sem alarmismo.

## 3. Divergência editorial que exige aceite explícito

| Fonte | Sobrepeso na/até semana 13 (kg) | Obesidade na/até semana 13 (kg) |
| --- | --- | --- |
| Anexo semanal MS/UFS 2022 | [-1,6;-0,5] | [-1,7;-0,5] |
| Resumo trimestral MS/UFS 2022 e FEBRASGO 2023, conforme parecer | [-1,6;-0,05] | [-1,6;-0,05] |
| [Cartaz cumulativo MS 2024](https://bvsms.saude.gov.br/bvs/cartazes/ganho_peso_gestacional.pdf) | [-1,6;-0,05] | [-1,6;+0,05] |

Proposta: usar exclusivamente a tabela semanal abaixo; não combinar fontes nem
deduzir casas decimais. Escolha é convenção explícita do produto, não errata
oficial nem prova de superioridade clínica. Documentar o impacto e obter aceite.
Se a equipe discordar, indicar fonte validada e revisar ficha/testes.

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
| Origem medida inicial, 8s0d / 8s1d | Elegível / não elegível como medida substituta; outro peso pré-gestacional legítimo pode permitir classificação |
| Idade 17 na avaliação / exatamente 18 | Sem classificação / elegível se demais critérios atendidos |
| Múltipla / alto risco / risco desconhecido / referência ausente | Medidas preservadas, sem classificação, motivo específico |
| Alterar perfil atual ou criar referência v2 | Resultado v1 permanece igual; série v2 separada |
| Gestante com cintura, quadril e dobras | Medidas/RCQ factual preservados; sem interpretações adultas/composição |

Casos adicionais obrigatórios:

| Caso | Resultado esperado após aprovação |
| --- | --- |
| IG ausente / origem não informada / inconsistência declarada | Medidas preservadas, sem faixa, motivo distinto |
| Dias 7, semanas fracionárias, data inexistente ou fonte posterior à avaliação | Erro de validação seguro; não gravar contexto inválido |
| Avaliação antiga, IG atual carregada no formulário | Exigir confirmação da IG para a data antiga; não reutilizar automaticamente |
| Referência pertencente a outra gestação/tenant/paciente | Rejeitar associação, sem exposição de dados |
| Peso presente sem origem | Referência incompleta; sem classificação, sem inferir origem |
| Peso habitual com confirmação de uso anterior à gestação | Origem própria no snapshot/portal; base usada e versão explícitas, sem converter para medido |
| Peso habitual sem confirmação / derivado do peso atual | Sem classificação / não estimar nem aceitar derivação automática |
| Alterar altura do cadastro após registro ou criar baseline v2 | Altura/resultados antigos intactos; série v2 separada |
| IMC de referência 7,99 / 8 / 100 / 100,01 | Fora / dentro / dentro / fora da heurística técnica local, não da população clínica |
| Peso decimal e limites 1,19 / 1,2 / 4,1 / 4,11 kg | Abaixo / dentro / dentro / acima, sem erro de ponto flutuante |
| Transparência do resultado | `source_id`, `algorithm_version`, IG original, semana da curva, intervalo ou motivos, versão/origem/unidade/precisão preservados |

## 6. Registro de revisão

- [x] Conferência documental da transcrição relatada no parecer de 10/10/2026; não é validação clínica final.
- [x] Aprovar o tratamento das divergências da semana 13.
- [x] Confirmar idade >=18 na avaliação, feto único e risco habitual.
- [x] Confirmar origem e limite de medida substituta até 8s0d.
- [x] Proprietário decidiu incluir peso habitual como origem própria nesta conversa.
- [x] Ratificar uso de peso habitual anterior à gestação, confirmação do
      profissional, rastreabilidade e exemplos; inclusão não é aprovação clínica.
- [x] Ratificar origem da IG por avaliação, tratamento de inconsistência e
      heurística técnica de plausibilidade distinta de limite clínico.
- [x] Confirmar arredondamento dos dias e bordas 9s4d/40s3d/40s4d.
- [x] Confirmar inclusividade, precisão, exemplos e textos sem prescrição.
- [x] Registrar confirmação clínica no handoff (data e resposta documental,
      sem publicar dados pessoais da equipe).

Se qualquer item divergir, alterar esta ficha e seus exemplos antes do
classificador. Sem resposta explícita não marcar itens acima nem anunciar
validação. [Plano técnico](../history/phases/PLANO_FASE_313.md).
