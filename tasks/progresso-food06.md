# FOOD06 — acompanhamento das 12 melhorias

## Método fixo de comunicação

As12 melhorias obrigatórias têm o mesmo peso neste indicador: PENDENTE=0,
PARCIAL=0,5, CONCLUÍDA E VALIDADA=1. Percentual=100×soma/12.
É uma estimativa administrativa por macroentregas, **não** percentual de linhas,
esforço, prazo, prontidão assistencial ou critérios integralmente aceitos.
Não alterar os pesos para aparentar avanço. Evidências e exceções continuam na
[matriz de aceite](aceite-pos-320-food06.md). Nenhuma melhoria pode ser retirada.

## Checkpoint M09 — ajuda explicativa em validação

| Melhoria | Estado | Entregue / falta |
| --- | --- | --- |
| M01 cobertura | PARCIAL | Domínio/API/tabela factual; fontes completas e saídas futuras pendentes |
| M02 contribuições | PARCIAL | Domínio/API/UI, fonte/preparo/ordem/origem com PG PASS no CIa35a22dd; receitas com PG PASS no Backend53835d72; troca explícita/receitas exercitadas na API/UI M04; matriz global de contribuições ainda pendente |
| M03 explicações | PARCIAL | Motivos de cobertura e catálogo; integração clínica/relatórios pendentes |
| M04 prévias | PARCIAL | Núcleo e API inicial porção/troca catálogo, fontes/revisões/fingerprint/CAS; 5PG e CI da API aprovados; UI inicial com50browser e62PA07 PASS, CI c8389ebc aprovado; API receitas com PG/RLS141PASS/0skip; UI integrada48unitários/150browser+2retestes PASS, CI c949821b PASS; comparação clínica/matriz global pendentes |
| M05 rastreabilidade | PARCIAL | Identificadores do núcleo; direitos e persistência de análise pendentes |
| M06 tabela | PARCIAL | Tabela/filtros factuais; referências/percentuais pendentes |
| M07 versões | PENDENTE | Implementação ainda necessária |
| M08 PDF | PENDENTE | Implementação ainda necessária |
| M09 explicações curtas | PARCIAL | Guia próprio versionado na tabela e prévias; backend/Web/testes de acessibilidade e revisão delimitada; CI e consolidação final pendentes |
| M10 longitudinal | PENDENTE | Implementação ainda necessária |
| M11 sugestões | PENDENTE | Catálogo e restrições confiáveis ainda exigem implementação/contrato |
| M12 cenários | PENDENTE | Implementação ainda necessária |

**29,2% estimados;0/12 melhorias integralmente encerradas.** Sete parciais, cinco
pendentes (100×3,5/12, arredondado a uma casa). CI verde de uma API não encerra uma melhoria inteira nem a fase.

Agora: finalizar os gates da [ajuda M09](food06-interface-ajuda.md). A integração
M04 de receitas teve CI completo aprovado no HEADc949821b; não encerra a
comparação clínica futura. Antes do próximo incremento: investigar as falhas intermitentes PA07 e conferir
CI do novo HEAD. Depois: histórico/comparação factual M07, reutilizando snapshots
autorizados e preservando lacunas, com contrato e TDD próprios.
Direitos/G06 BLOCKED; sem merge/deploy/migrations externas ou prontidão presumida.
