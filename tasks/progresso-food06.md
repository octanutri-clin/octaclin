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
| M07 versões | PARCIAL | Núcleo e API/BFF de comparação de registros factuais autorizados implementados; leitura cifrada, identidade/revisão e isolamento testados em PostgreSQL/RLS. Interface inicial permite selecionar e comparar registros já salvos; captura explícita de publicação integrada à interface com repetição idempotente e 6 testes browser. Captura de rascunho materializado com revisão exata integrada; referência comum e validação integral da jornada pendentes. Ver [handoff](food06-handoff-registro-factual.md). Evidência: [API factual](food06-api-registros-factuais.md) |
| M08 PDF | PENDENTE | Implementação ainda necessária |
| M09 explicações curtas | CONCLUÍDA E VALIDADA | Guia próprio versionado, fonte/revisão técnica/UX delimitadas, teclado/axe/fonte200% e CIb9ed65bc aprovado; sem habilitar referências numéricas ou afirmar AT humana |
| M10 longitudinal | PARCIAL | Endpoint histórico keyset e UI factual; extensão M10-C2 compara estados dos marcadores de planejamento, composição/fonte, referência, contexto e cobertura por nutriente, sem projetar hashes nem atribuir causa. Unitário 4/4, PostgreSQL descartável/RLS 41/41, Web69/69, Playwright desktop/mobile2/2, typechecks, lint, builds e scanner local de segredos PASS em Node22.21.1. CI/scanners do novo delta, UX B/C, R4 independente e direitos/DRI continuam pendentes |
| M11 sugestões | PENDENTE | Catálogo e restrições confiáveis ainda exigem implementação/contrato |
| M12 cenários | PENDENTE | Implementação ainda necessária |

**41,7% estimados;1/12 melhoria integralmente encerrada (M09).** Oito parciais,
três pendentes (100×(1+8×0,5)/12). Não é percentual de esforço, prazo ou prontidão
assistencial. M10 continua parcial e M07 não se encerra por um comparador interno testado.

Agora: fechar o diff/documentação M10-C2, validar build e regressões proporcionais, fazer commit/push fast-forward à #455 e verificar CI/scanners do novo HEAD. M10 permanece parcial; M05/M07 permanecem parciais.
R4 independente integral e UX B/C ainda não executados. O CI bem-sucedido de `4447146d` é evidência somente daquele commit; este delta ainda não tem CI.
Direitos/DRI e G06 BLOCKED; sem operações externas ou mudança de escopo.
