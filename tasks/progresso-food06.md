# FOOD06 — acompanhamento das 12 melhorias

## Método fixo de comunicação

As12 melhorias obrigatórias têm o mesmo peso neste indicador: PENDENTE=0,
PARCIAL=0,5, CONCLUÍDA E VALIDADA=1. Percentual=100×soma/12.
É uma estimativa administrativa por macroentregas, **não** percentual de linhas,
esforço, prazo, prontidão assistencial ou critérios integralmente aceitos.
Não alterar os pesos para aparentar avanço. Evidências e exceções continuam na
[matriz de aceite](aceite-pos-320-food06.md). Nenhuma melhoria pode ser retirada.

## Checkpoint vigente — M10 histórico longitudinal factual

| Melhoria | Estado | Entregue / falta |
| --- | --- | --- |
| M01 cobertura | PARCIAL | Domínio/API/tabela factual; fontes completas e saídas futuras pendentes |
| M02 contribuições | PARCIAL | Domínio/API/UI, fonte/preparo/ordem/origem com PG PASS no CIa35a22dd; receitas com PG PASS no Backend53835d72; troca explícita/receitas exercitadas na API/UI M04; matriz global de contribuições ainda pendente |
| M03 explicações | PARCIAL | Motivos de cobertura e catálogo; integração clínica/relatórios pendentes |
| M04 prévias | PARCIAL | Núcleo e API inicial porção/troca catálogo, fontes/revisões/fingerprint/CAS; 5PG e CI da API aprovados; UI inicial com50browser e62PA07 PASS, CI c8389ebc aprovado; API receitas com PG/RLS141PASS/0skip; UI integrada48unitários/150browser+2retestes PASS, CI c949821b PASS; comparação clínica/matriz global pendentes |
| M05 rastreabilidade | PARCIAL | Construtor, armazenamento/leitor e fonte DB autorizada implementados; API/BFF/UI, contexto confirmado e direitos pendentes |
| M06 tabela | PARCIAL | Tabela/filtros factuais; referências/percentuais pendentes |
| M07 versões | PARCIAL | Núcleo comparador congelado, identidade/revisão e dimensões documentais testados; fonte de versão/revisão exata e comparação cifrada testadas em PG/RLS; API/UI/referência comum e CI próprio pendentes |
| M08 PDF | PENDENTE | Implementação ainda necessária |
| M09 explicações curtas | CONCLUÍDA E VALIDADA | Guia próprio versionado, fonte/revisão técnica/UX delimitadas, teclado/axe/fonte200% e CIb9ed65bc aprovado; sem habilitar referências numéricas ou afirmar AT humana |
| M10 longitudinal | PARCIAL | Endpoint histórico keyset, projeção factual mínima, cursor sub-millisecond, UI profissional, pontos sem linhas e tabela de lacunas implementados localmente; backend compara apenas estado agregado da composição/fonte sem revelar hash. Provas backend/PG-RLS, BFF, domínio, typecheck/lint e browser desktop/mobile PASS. CI novo, build integral, R4/UX B/C, distinção causal e direitos/referências continuam pendentes |
| M11 sugestões | PENDENTE | Catálogo e restrições confiáveis ainda exigem implementação/contrato |
| M12 cenários | PENDENTE | Implementação ainda necessária |

**41,7% estimados;1/12 melhoria integralmente encerrada (M09).** Oito parciais,
três pendentes (100×(1+8×0,5)/12). Não é percentual de esforço, prazo ou prontidão
assistencial. M10 continua parcial e M07 não se encerra por um comparador interno testado.

Agora: revisar/fechar o delta local M10, remover a linha em branco final detectada em um DTO, rodar build/authz completo/scanners e atualizar a PR somente após diff e segredos.
R4 independente integral e CI do novo HEAD ainda não executados. M05/M07 permanecem parciais.
Direitos/DRI e G06 BLOCKED; sem operações externas ou mudança de escopo.
