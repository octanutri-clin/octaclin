# FOOD06 — acompanhamento das 12 melhorias

## Método fixo de comunicação

As12 melhorias obrigatórias têm o mesmo peso neste indicador: PENDENTE=0,
PARCIAL=0,5, CONCLUÍDA E VALIDADA=1. Percentual=100×soma/12.
É uma estimativa administrativa por macroentregas, **não** percentual de linhas,
esforço, prazo, prontidão assistencial ou critérios integralmente aceitos.
Não alterar os pesos para aparentar avanço. Evidências e exceções continuam na
[matriz de aceite](aceite-pos-320-food06.md). Nenhuma melhoria pode ser retirada.

## Checkpoint M05/M07 — persistência interna em validação

| Melhoria | Estado | Entregue / falta |
| --- | --- | --- |
| M01 cobertura | PARCIAL | Domínio/API/tabela factual; fontes completas e saídas futuras pendentes |
| M02 contribuições | PARCIAL | Domínio/API/UI, fonte/preparo/ordem/origem com PG PASS no CIa35a22dd; receitas com PG PASS no Backend53835d72; troca explícita/receitas exercitadas na API/UI M04; matriz global de contribuições ainda pendente |
| M03 explicações | PARCIAL | Motivos de cobertura e catálogo; integração clínica/relatórios pendentes |
| M04 prévias | PARCIAL | Núcleo e API inicial porção/troca catálogo, fontes/revisões/fingerprint/CAS; 5PG e CI da API aprovados; UI inicial com50browser e62PA07 PASS, CI c8389ebc aprovado; API receitas com PG/RLS141PASS/0skip; UI integrada48unitários/150browser+2retestes PASS, CI c949821b PASS; comparação clínica/matriz global pendentes |
| M05 rastreabilidade | PARCIAL | Construtor e armazenamento cifrado internos implementados; adapter autorizado/versões/leitor clínico/API e direitos pendentes |
| M06 tabela | PARCIAL | Tabela/filtros factuais; referências/percentuais pendentes |
| M07 versões | PARCIAL | Núcleo comparador congelado, identidade/revisão e dimensões documentais testados; construtor e armazenamento internos testados em PG/RLS; adapter de versões/CAS, API/UI/referência comum e CI próprio pendentes |
| M08 PDF | PENDENTE | Implementação ainda necessária |
| M09 explicações curtas | CONCLUÍDA E VALIDADA | Guia próprio versionado, fonte/revisão técnica/UX delimitadas, teclado/axe/fonte200% e CIb9ed65bc aprovado; sem habilitar referências numéricas ou afirmar AT humana |
| M10 longitudinal | PENDENTE | Implementação ainda necessária |
| M11 sugestões | PENDENTE | Catálogo e restrições confiáveis ainda exigem implementação/contrato |
| M12 cenários | PENDENTE | Implementação ainda necessária |

**37,5% estimados;1/12 melhoria integralmente encerrada (M09).** Sete parciais,
quatro pendentes (100×(1+7×0,5)/12). Não é percentual de esforço, prazo ou prontidão
assistencial. M07 não se encerra por um comparador interno testado.

Agora: conferir CI da [persistência interna M05/M07](food06-persistencia-factual.md).
16schema/PG PASS e R4 independente delimitada, build/typecheck Node22 PASS.
Depois: carregador autorizado de versões/revisões e leitor clínico seguro;
API/BFF/paginação/UI terão gates próprios. O indicador não sobe por subdividir
uma melhoria que permanece parcial. Direitos/G06 BLOCKED;
sem merge/deploy/migrations externas ou prontidão presumida.
