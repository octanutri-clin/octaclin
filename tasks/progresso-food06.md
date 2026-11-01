# FOOD06 — acompanhamento das 12 melhorias

## Método fixo de comunicação

As12 melhorias obrigatórias têm o mesmo peso neste indicador: PENDENTE=0,
PARCIAL=0,5, CONCLUÍDA E VALIDADA=1. Percentual=100×soma/12.
É uma estimativa administrativa por macroentregas, **não** percentual de linhas,
esforço, prazo, prontidão assistencial ou critérios integralmente aceitos.
Não alterar os pesos para aparentar avanço. Evidências e exceções continuam na
[matriz de aceite](aceite-pos-320-food06.md). Nenhuma melhoria pode ser retirada.

## Checkpoint da interface M02

| Melhoria | Estado | Entregue / falta |
| --- | --- | --- |
| M01 cobertura | PARCIAL | Domínio/API/tabela factual; fontes completas e saídas futuras pendentes |
| M02 contribuições | PARCIAL | Domínio/API paginada e interface testada localmente; CI próprio, fonte/preparo, ordenação global e navegação até origem pendentes |
| M03 explicações | PARCIAL | Motivos de cobertura e catálogo; integração clínica/relatórios pendentes |
| M04 prévias | PENDENTE | Implementação ainda necessária |
| M05 rastreabilidade | PARCIAL | Identificadores do núcleo; direitos e persistência de análise pendentes |
| M06 tabela | PARCIAL | Tabela/filtros factuais; referências/percentuais pendentes |
| M07 versões | PENDENTE | Implementação ainda necessária |
| M08 PDF | PENDENTE | Implementação ainda necessária |
| M09 explicações curtas | PARCIAL | Textos do núcleo/factual; integração completa pendente |
| M10 longitudinal | PENDENTE | Implementação ainda necessária |
| M11 sugestões | PENDENTE | Catálogo e restrições confiáveis ainda exigem implementação/contrato |
| M12 cenários | PENDENTE | Implementação ainda necessária |

**25% estimados;0/12 melhorias integralmente encerradas.** Seis parciais, seis
pendentes. CI verde de uma API não encerra uma melhoria inteira nem a fase.

Agora: finalizar envio/CI da interface de contribuições M02. Depois: completar os critérios
restantes M02, antes de encerrar a melhoria; avançar então para M04 e integrações
conforme dependências. Direitos de referências e G06 continuam BLOCKED, sem
merge/deploy/migrations externas ou disponibilização clínica presumida.
