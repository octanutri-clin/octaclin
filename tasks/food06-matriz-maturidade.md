# FOOD06 — três eixos de maturidade (reconstrução)

Base137aa547; reconstrução07/11/2026, sem execução funcional nova. As evidências
E01–E12 estão no [relatório consolidado](food06-auditoria-consolidada.md).
Estados são conservadores para o requisito completo, não para cada subincremento.
Bloqueios Bxx são únicos e definidos no [registro](food06-bloqueios-compartilhados.md).

| Melhoria | Implementação funcional | Validação/qualidade | Dependências | Lacuna principal / próxima ação |
| --- | --- | --- | --- | --- |
| M01 | IMPLEMENTADA COM LACUNAS | TESTES PARCIAIS | B03/B05/B08 | E01/E08: projetar origem factual por nutriente sem alegar proveniência por célula; reconciliar API/tabela/detalhes/PDF |
| M02 | IMPLEMENTADA COM LACUNAS | TESTES PARCIAIS | B03/B05/B08 | E02/E04: reconciliar fonte, receita fracionária, alternativa escolhida e seleção/hierarquia de ponta a ponta |
| M03 | IMPLEMENTADA COM LACUNAS | TESTES PARCIAIS | B03/B05; B01/B02 no caminho científico | E03: ligar causas a mensagens/ações nas saídas e canários de logs; indisponibilidade DRI pode ser explicada sem habilitar DRI |
| M04 | IMPLEMENTADA COM LACUNAS | TESTES PARCIAIS | B01/B02/B05; B04 quando individualizada | E04: operação factual existe; falta elegibilidade científica e matriz completa de operações, concorrência e integrações |
| M05 | IMPLEMENTADA COM LACUNAS | TESTES PARCIAIS | B01/B02/B05/B07 | E05/E08: registros cifrados/reprodutíveis factuais existem; versão/manifesto de referência científica e direitos faltam |
| M06 | IMPLEMENTADA COM LACUNAS | TESTES PARCIAIS | B01/B02/B05 | E06: completar filtros/ordem ligados a referências quando liberadas e validar semântica/acessibilidade integral |
| M07 | IMPLEMENTADA COM LACUNAS | TESTES PARCIAIS | B01/B02/B05/B07 | E07: versões/registros autorizados e deltas factuais existem; referência comum e diferenças de origem/contexto precisam prova integral |
| M08 | IMPLEMENTADA COM LACUNAS | TESTES PARCIAIS | B01/B02/B03/B05/B07 | E08: PDF factual com contexto opt-in existe; fontes por nutriente, referências e acessibilidade integral pendem |
| M09 | IMPLEMENTAÇÃO VALIDADA no escopo técnico registrado | VALIDADA NO ESCOPO FUNCIONAL | B05 para gates globais; B06 para operação | E09: manter conclusão técnica existente; não equivale a nova prova humana de AT, liberação DRI ou produção |
| M10 | IMPLEMENTADA COM LACUNAS | TESTES PARCIAIS | B01/B02/B05/B07 | E10: histórico paginado/gráfico/tabela factuais existem; referências históricas e integralidade das descontinuidades/gates pendem |
| M11 | IMPLEMENTADA COM LACUNAS | TESTES PARCIAIS | B04/B05; B01/B02 apenas quando usar referências | E11: consulta e seleção→prévia existentes; restrições estruturadas, integração FOOD05 aplicável e matriz final incompletas |
| M12 | NÃO INICIADA como jornada integrada; fundamentos reutilizáveis existem | NÃO TESTADA como M12 integral | B05; B01/B02/B04/B07 nas partes correspondentes | E12: compor cenários múltiplos temporários com comparação e confirmação segura; prévia pontual não basta |

Não há ACEITE INTEGRAL APROVADO global da FOOD06 nesta reconstrução. “Testes
parciais” reconhece evidências fortes de subincrementos, mas não inventa a execução
dos critérios restantes. M09 não foi rebaixada pela ausência de nova execução.

## Candidatas a fechamento

- **M01 — candidata condicionada:** C1 tem PASS técnico de domínio histórico;
  C2/C3 exigem rastreabilidade honesta, saídas coerentes, legados e provas de
  autorização/histórico. Não precisa DRI numérica; precisa demonstrar ausência de
  percentual indevido e fonte geral distinta de origem específica.
- **M02 — candidata condicionada:** C3 tem PASS delimitado; C1/C2 ainda exigem
  reconciliação integral receitas/substituições/repetições/seleção e contagens.
  Critérios oficiais não exigem referências científicas habilitadas.
- **M03 — ainda não candidata:** faltam integração e canários multissuperfície.
  Pode avançar sem liberar DRI, explicitando impedimentos já conhecidos.

## Métrica e contagem por critério

Preservada a métrica administrativa50,0%/1de12 do arquivo canônico. A visão
complementar usa os29 IDs oficiais, individualmente no [registro de critérios](food06-pendencias-por-criterio.md).
Não foi atribuído percentual de aprovação por critério: PASS de domínio ou
incremento não é automaticamente PASS da jornada completa. Mudanças recomendadas
de status ficam rastreáveis e não sobrescrevem os checkpoints históricos.
