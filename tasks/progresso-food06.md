# FOOD06 — acompanhamento das 12 melhorias

## Método fixo de comunicação

As12 melhorias obrigatórias têm o mesmo peso neste indicador: PENDENTE=0,
PARCIAL=0,5, CONCLUÍDA E VALIDADA=1. Percentual=100×soma/12.
É uma estimativa administrativa por macroentregas, **não** percentual de linhas,
esforço, prazo, prontidão assistencial ou critérios integralmente aceitos.
Não alterar os pesos para aparentar avanço. Evidências e exceções continuam na
[matriz de aceite](aceite-pos-320-food06.md). Nenhuma melhoria pode ser retirada.

## Checkpoint M04 — API factual inicial

| Melhoria | Estado | Entregue / falta |
| --- | --- | --- |
| M01 cobertura | PARCIAL | Domínio/API/tabela factual; fontes completas e saídas futuras pendentes |
| M02 contribuições | PARCIAL | Domínio/API/UI, fonte/preparo/ordem/origem com PG PASS no CIa35a22dd; receitas com PG PASS no Backend53835d72; troca explícita API em validação, integração UI pendente |
| M03 explicações | PARCIAL | Motivos de cobertura e catálogo; integração clínica/relatórios pendentes |
| M04 prévias | PARCIAL | Núcleo e API inicial porção/troca catálogo, fontes/revisões/fingerprint/CAS; novos5PG e CI pendentes, UI/PA07/receitas/preparo ainda pendentes |
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

Agora: concluir os gates da [API M04](food06-api-previa-micronutrientes.md),
com PostgreSQL/RLS no CI. Depois: interface integrada ao editor, PA07/ACK/autosave,
UX B/C e demais operações aprovadas. Duas operações iniciais não encerram M04.
Direitos e G06 continuam BLOCKED; sem merge/deploy/migrations externas ou prontidão presumida.
