# FOOD06 — acompanhamento das 12 melhorias

## Método fixo de comunicação

As12 melhorias obrigatórias têm o mesmo peso neste indicador: PENDENTE=0,
PARCIAL=0,5, CONCLUÍDA E VALIDADA=1. Percentual=100×soma/12.
É uma estimativa administrativa por macroentregas, **não** percentual de linhas,
esforço, prazo, prontidão assistencial ou critérios integralmente aceitos.
Não alterar os pesos para aparentar avanço. Evidências e exceções continuam na
[matriz de aceite](aceite-pos-320-food06.md). Nenhuma melhoria pode ser retirada.

## Checkpoint M04 — extensão de receitas

| Melhoria | Estado | Entregue / falta |
| --- | --- | --- |
| M01 cobertura | PARCIAL | Domínio/API/tabela factual; fontes completas e saídas futuras pendentes |
| M02 contribuições | PARCIAL | Domínio/API/UI, fonte/preparo/ordem/origem com PG PASS no CIa35a22dd; receitas com PG PASS no Backend53835d72; troca explícita API em validação, integração UI pendente |
| M03 explicações | PARCIAL | Motivos de cobertura e catálogo; integração clínica/relatórios pendentes |
| M04 prévias | PARCIAL | Núcleo e API inicial porção/troca catálogo, fontes/revisões/fingerprint/CAS; 5PG e CI da API aprovados; UI inicial com50browser e62PA07 PASS, CI c8389ebc aprovado; API receitas em validação (431focados/3.926backend PASS,3PG novos pendentes), integração de receitas/preparo ainda pendente |
| M05 rastreabilidade | PARCIAL | Identificadores do núcleo; direitos e persistência de análise pendentes |
| M06 tabela | PARCIAL | Tabela/filtros factuais; referências/percentuais pendentes |
| M07 versões | PENDENTE | Implementação ainda necessária |
| M08 PDF | PENDENTE | Implementação ainda necessária |
| M09 explicações curtas | PARCIAL | Textos do núcleo/factual; integração completa pendente |
| M10 longitudinal | PENDENTE | Implementação ainda necessária |
| M11 sugestões | PENDENTE | Catálogo e restrições confiáveis ainda exigem implementação/contrato |
| M12 cenários | PENDENTE | Implementação ainda necessária |

**29,2% estimados;0/12 melhorias integralmente encerradas.** Sete parciais, cinco
pendentes (100×3,5/12, arredondado a uma casa). CI verde de uma API não encerra uma melhoria inteira nem a fase.

Agora: concluir os gates da [extensão M04 para receitas](food06-api-previa-receitas.md).
A [interface anterior](food06-interface-previa.md) passou no CI c8389ebc. Depois:
UI de receitas e demais operações aprovadas, preservando UX B/C e a ausência de
comparação DRI. Operações iniciais não encerram M04. Direitos/G06 BLOCKED;
sem merge/deploy/migrations externas ou prontidão presumida.
