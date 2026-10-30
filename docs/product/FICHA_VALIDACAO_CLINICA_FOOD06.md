# FOOD06 — ficha de referências e aplicabilidade

Proposta para revisão humana em 2026-10-30. Não representa ratificação clínica.
Decisões de produto aprovadas: adultos 19+, sem gestação/lactação; plano publicado
individual ou seleção combinada; somente console; RDA/AI e UL oficiais DRI sem
diagnóstico ou meta individual automática. Plano: [FOOD06](../../tasks/plan-pos-320-food06.md).

## Fontes e população

Fontes candidatas oficiais: Health Canada, tabelas de
[elementos](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html)
e [vitaminas](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-vitamins.html).
Ambas indicam modificação em 2025-11-19. Essa data não é a edição científica de
todos os nutrientes: o manifesto final deverá identificar o relatório original
e a revisão vigente de cada um, inclusive potássio de 2019. Não misturar limites
de autoridades diferentes, como EFSA, sem nova decisão de protocolo.

As notas das tabelas delimitam indivíduos aparentemente saudáveis. Propõe-se
confirmação do profissional, por comparação, de sexo da referência (masculina ou
feminina, sem inferência), ausência de gestação/lactação e aplicabilidade da
referência populacional. Condição que exija referência individualizada impede a
comparação automática afetada, mantendo totais factuais. Não procurar diagnósticos
ou condições fisiológicas em texto livre.

Idade: anos completos pela data civil da clínica. Reutilizar
`obterTimezoneClinicoDoTenant` e validação civil existente; não usar timezone do
navegador, UTC como substituto ou divisão por 365/365,25. Datas inválidas/futuras,
sexo da referência não confirmado e contexto incompleto recebem motivo explícito.
Testar 19, 30/31, 50/51, 70/71 anos, ano bissexto e fronteiras em vários fusos.
Cada nutriente usa suas próprias faixas; não presumir que todas sejam idênticas.

## Matriz semântica dos 22 códigos PA06

Esta matriz não incorpora valores clínicos. “Candidata” requer ainda conferência
dos valores por faixa e notas do relatório original. Não implica ativação.

| Código PA06 | Comparação RDA/AI proposta | UL e restrições |
| --- | --- | --- |
| `calcioMg` | RDA, mg/dia | Total compatível candidato; faixas/população próprias |
| `magnesioMg` | RDA, mg/dia | Não comparar total alimentar ao UL farmacológico; origem necessária ausente na PA06 |
| `manganesMg` | AI, mg/dia | Total compatível candidato |
| `fosforoMg` | RDA, mg/dia | Total compatível candidato; verificar mudança do limite por idade |
| `ferroMg` | RDA, mg/dia | Total candidato; explicitar hipóteses populacionais e de biodisponibilidade, sem ajuste automático por dieta |
| `potassioMg` | AI, mg/dia; revisão 2019 | Não inventar UL; ausência de UL não prova segurança |
| `cobreMg` | RDA publicada em mcg/dia | Conversão dimensional explícita: 1 mg = 1000 mcg; mesmo cuidado no UL |
| `zincoMg` | RDA, mg/dia | Total compatível candidato |
| `selenioMcg` | RDA, mcg/dia | Total compatível candidato |
| `retinolMcg` | Não corresponde isoladamente à RDA de vitamina A total RAE | UL de vitamina A pré-formada exige comprovar definição/origem exata; não presumir que retinol isolado represente toda a fração pré-formada |
| `vitaminaAReMcg` | Indisponível: RE não é RAE | Não aplicar UL de vitamina A total/RAE ao RE |
| `vitaminaARaeMcg` | RDA, mcg RAE/dia | Não comparar RAE total ao UL da fração pré-formada |
| `tiaminaMg` | RDA, mg/dia | UL não estabelecido; apresentar esse motivo, sem afirmar ausência de risco |
| `riboflavinaMg` | RDA, mg/dia | UL não estabelecido |
| `vitaminaB6Mg` | RDA, mg/dia | Total candidato segundo DRI escolhida; não usar UL de outra autoridade implicitamente |
| `niacinaMg` | Indisponível para RDA em NE sem dados de conversão suficientes | UL só para formas sintéticas especificadas; origem não segregada |
| `niacinaNeMg` | RDA, mg NE/dia | NE total não representa a quantidade sintética abrangida pelo UL |
| `vitaminaB12Mcg` | RDA, mcg/dia | UL não estabelecido; nota etária sobre fontes não vira prescrição automática |
| `folatoDfeMcg` | RDA, mcg DFE/dia | UL usa ácido fólico/formas sintéticas abrangidas, não DFE total |
| `vitaminaDMcg` | RDA, mcg/dia, D2+D3 confirmado | Total candidato; não converter IU por aproximação. Ausência semântica IBGE permanece ausência |
| `vitaminaEAlfaTocoferolMg` | Pendente: confirmar compatibilidade das fontes com formas 2R da referência | UL sintético exige fração/origem correspondente; total alfa-tocoferol não comprova essa fração |
| `vitaminaCMg` | RDA, mg/dia | Total candidato; tratar separadamente a nota sobre tabagismo, sem inferir condição |

Sódio é campo legado fora dos 22 códigos; não acrescentar automaticamente uma
classificação de sódio nesta fase. CDRR não é UL. Não há dados de iodo, cromo,
vitamina K ou outros nutrientes fora da whitelist para serem inventados.

## Decisões concentradas para ratificação clínica

| ID | Regra preferencial proposta | Alternativa e risco | Aceite humano necessário |
| --- | --- | --- | --- |
| F06-CL01 | Referência populacional DRI aparentemente saudável, contexto explicitamente confirmado | Usar cadastro sem confirmação pode aplicar referência errada | Ratificar população/exclusões e forma de confirmação |
| F06-CL02 | Sexo da referência explícito, idade/data clínica e versões preservados na reprodução | Dedução ou idade aproximada pode mudar faixa | Ratificar seleção e comportamento sem contexto |
| F06-CL03 | Profissional confirma que a seleção representa um mesmo dia planejado | Planos podem ser dias alternados; somá-los pode duplicar o planejamento diário | Ratificar confirmação por operação e rótulo diário |
| F06-CL04 | Só produzir percentual com cobertura completa e unidade/qualificador compatíveis | Percentual de subtotal parcial aparenta adequação/insuficiência indevida | Ratificar indisponibilidade da comparação parcial |
| F06-CL05 | UL indisponível quando faltar origem/fração compatível; explicar motivo por nutriente | Comparar total alimentar/DFE/RAE aos ULs restritos cria falso alerta | Ratificar limites da matriz acima, sem ampliar escopo para suplementos |
| F06-CL06 | Mostrar números e diferenças factuais; sem classificar deficiência/toxicidade ou usar semáforo diagnóstico | Cores/termos clínicos podem transformar referência em conclusão individual | Ratificar linguagem de tabela e limites interpretativos |
| F06-CL07 | Vitamina C: exigir confirmação de tabagismo; manter comparação indisponível quando desconhecido; sub-regra de ajuste só após validação explícita | Ignorar a nota ou inferir condição muda a referência indevidamente | Definir/ratificar aplicação do ajuste e variável confirmada |
| F06-CL08 | Ferro/vitamina E e demais notas de forma/biodisponibilidade precisam de compatibilidade demonstrada antes de habilitar a comparação afetada | Nome/unidade iguais não provam mesma definição | Ratificar mapeamentos e condições de indisponibilidade por fonte |

Direitos são gate distinto da ratificação clínica. A aprovação D01–03 não
constitui aprovação automática desta ficha. Responsável, data, versão da ficha,
decisões e ressalvas devem constar do registro de ratificação; nenhum aceite foi
atribuído ao proprietário nesta rodada.

## Oráculos e critérios de liberação

O [quadro adulto candidato](VALORES_CANDIDATOS_DRI_FOOD06.md) agora apresenta os
números por sexo/faixa e unidades de referência e UL separadamente. O
[parecer de fontes](PARECER_FONTES_DRI_FOOD06.md) registra concordâncias documentais,
limitações de acesso, direitos e diferenças de protocolo. Esses anexos integram
o material a revisar, sem ratificação presumida.

Na CL08, ratificar expressamente que ULs DRI para B6 (100 mg/dia) e selênio
(400 mcg/dia) diferem dos valores EFSA 2023 (12 mg/dia e 255 mcg/dia). D03
selecionou DRI norte-americana; isso não deve ocultar a diferença nem criar
garantia de segurança. Vitamina E permanece com comparação UL indisponível,
pois o total PA06 não identifica a origem/fração abrangida por cada redação.

- Conferir cada valor/faixa/nota com fonte oficial independente e da mesma revisão.
  Uma tabela antiga não valida alterações de 2019. Identificar valores sem
  concordância e impedir ativação do nutriente até resolução.
- Fixtures sintéticas testam aritmética e autorização; não validam cientificamente
  a tabela. Não ajustar tolerâncias para fazer exemplos divergentes passarem.
- Porcentagens usam razão decimal e referência positiva. Decisões não dependem
  de número arredondado da interface. Definir precisão de apresentação separada.
- Testes por código incluem presença/ausência, zero conhecido, parcial, limite
  de idade, forma e origem incompatíveis; casos de UI explicam a indisponibilidade.
- Sem memória persistente de rascunho clínico no navegador. Comparação por leitura
  conserva IDs/revisões autorizados; não reescreve versões/snapshots de planos.
- Fonte, licença e protocolo devem ser aprovados antes de qualquer habilitação
  assistencial. A ferramenta de coleta documental não libera esses gates.
