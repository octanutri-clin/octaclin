# FOOD06 — pendências por critério (reconstrução)

Base137aa547; reconstruído07/11/2026. Inclui **todos os29 IDs oficiais**, mesmo
os PASS delimitados, para comprovar cobertura. Requisitos copiados da matriz
canônica; análise não a substitui nem altera seu progresso. Não foram criados
critérios novos. PASS de subescopo permanece delimitado.

E01–E12: [índice de evidências](food06-auditoria-consolidada.md).
B01–B08: [registro único de bloqueios](food06-bloqueios-compartilhados.md).
A coluna de status avalia o critério completo e explicita quando a matriz canônica
contém PASS de domínio ou PENDENTE que ficou desatualizado. Os testes citados são
históricos identificados nos handoffs; nenhuma suíte funcional nova foi executada
nesta reconstrução. CI137aa547 foi consultado, sem converter verde em aceite total.

## Atualização 2026-11-12 (evidência nova desde 2026-11-08)

Esta tabela foi reconstruída em 07/11 sobre a base `137aa547`. Desde então entraram na `main` (CI verde na época de cada PR): T1 referências DRI adultas
versionadas (#502), T2 comparador em lote (#509), T3a análise ao vivo com referências por opt-in (#510), T3b registro factual v2 com a versão das referências (#511),
T4a tabela com referências (#513), T4b relatório impresso (#514), NUX-15 indicador no histórico (#515), T5 núcleo de cenários em memória (#516), T6 consistência entre
saídas e canários (#518) e T7 matriz com oráculo decimal (#523). Bloqueios: ver `food06-bloqueios-compartilhados.md` (B01, B05 e B06 encerrados por declaração do proprietário em 2026-11-12).

| Critério | Evidência nova | Estado recomendado |
| --- | --- | --- |
| M02-C2 | T7: soma e cobertura contra oráculo independente (domínio) | PARCIAL (faltam operações efetivas integradas) |
| M03-C2 | T6: leitores da tabela ao vivo e do relatório coincidem; canários nos leitores e nas projeções | PARCIAL (antes PENDENTE; falta renderização e logs de infraestrutura) |
| M05-C1, M05-C2 | T1 a T3b: referência versionada e registro v2 que nunca recalcula com a versão atual | PARCIAL, avançada (falta prova integrada de reprodução sob RLS e B07) |
| M06-C1 | T4a: coluna de referência (RDA/AI/UL, percentuais) | PARCIAL (faltam filtros por situação da referência e ordenação) |
| M08-C1 | T4b: seção DRI opcional na folha, com PDF real | PARCIAL |
| M10-C1 | NUX-15: indicador por registro (só texto) | PARCIAL |
| M11-C2 | Contrato v2 (#524) e motor (#526) mergeados; contrato v3 com as respostas de 2026-11-12 proposto | **BLOQUEADO (B04)** |
| M12-C1, M12-C2 | T5: núcleo de domínio, cenários não gravados, sem API nem tela | PARCIAL **só no domínio** (antes PENDENTE) |
| M12-C3 | Nenhuma | PENDENTE |

Nenhuma linha vira PASS por esta atualização: a matriz exige teste e evidência do commit correspondente.

## M01

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M01-C1** — Zero conhecido ≠ ausência; cobertura por nutriente, não por alimento global | Existente no domínio e projeções factuais. E01/E06; PASS domínio A1 documentado | Extensão de origem não pode mudar zero/ausência nas saídas. Categoria:Teste/integração. B03/B05 | Reusar domínio e testar projeções novas. Aceite:Mesmo zero conhecido e ausência distintos em API/UI/PDF | PARCIAL ponta a ponta; PASS domínio preservado |
| **M01-C2** — Completo/parcial/desconhecido/incompatível/indisponível com motivos/fontes | Estados/causas existentes; fontes por nutriente incompletas. E01/E08; resumo global não resolve por célula | Associar somente origens registradas de contribuintes conhecidos. Categoria:Código/integração. B03 | Completar projeção factual única e limitada. Aceite:FT01–FT12/FT18–FT19, origem específica incerta explícita | PARCIAL |
| **M01-C3** — Subtotal parcial explícito, sem percentual de referência; mesmos dados nas saídas | Tabela/subtotais existentes; reconciliação fontes incompleta. E01/E06/E08 | Mesmos fatos na análise, detalhes e relatório, inclusive legados. Categoria:Código/teste. B03/B05 | Reconciliar saídas pela projeção autorizada. Aceite:FT13–FT17/FT20, autorização/PDF aplicáveis | PARCIAL |

## M02

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M02-C1** — Total→refeição→alimento, quantidade/preparo/fonte e cobertura | Hierarquia e quantidade/origem implementadas. E02; histórico CIa35a22dd/53835d72 delimitado | Prova integrada da composição/origem e receita efetiva. Categoria:Integração/teste. B03/B05 | Reconciliar hierarquia com PA06 e fontes I01. Aceite:Receita1,5 e porção congelada, soma por refeição/alimento, acesso negado | PARCIAL |
| **M02-C2** — Denominador completo/positivo, sem dupla contagem | Seleção/repetições e troca explícita no núcleo/API. E02/E04 | Matriz integral de operações efetivas e exclusões. Categoria:Teste/integração. B05 | Mapear testes existentes; adicionar só casos ausentes. Aceite:Alternativa escolhida substitui principal; repetições legítimas e denominador válido | PARCIAL |
| **M02-C3** — Ordenação/expansão/atalho autorizado | Ordenação/expansão/consulta autorizada existentes. E02; aceite delimitado a35a22dd | Não usar este PASS como fechamento de C1/C2. Categoria:Teste de regressão. B05 | Preservar aceite e repetir se código afetado. Aceite:Paginação/ordem/atalho e negativa exatos; sem nova exigência clínica | PASS delimitado histórico |

## M03

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M03-C1** — Motivos clínicos/técnicos/contratuais estruturados, backend autoritativo | Catálogo/motivos e ajuda existentes. E03 | Todas as causas clínicas/técnicas/contratuais integradas. Categoria:Código/teste. B03/B05; B02 científico | Conferir catálogo de motivos e ações por superfície. Aceite:Negativos por motivo; indisponível sem DRI e sem mensagens genéricas indevidas | PARCIAL |
| **M03-C2** — Tabela/detalhes/relatório concordam, sem dados nos logs | Infra de projeções existe; prova comum insuficiente. E03/E08; canônica PENDENTE | Consistência e ausência de dados sensíveis em logs. Categoria:Integração/segurança. B05 | Criar canários e reconciliar mesma revisão. Aceite:Tabela/detalhe/relatório concordam; logs/erros sem conteúdo clínico | PENDENTE |

## M04

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M04-C1** — Prévia antes/depois, percentuais válidos, cobertura/eligibilidade | Prévia factual alimento/porção/receita integrada. E04; handoffs API/UI e CIc949821b históricos | Elegibilidade científica e conjunto completo de operações. Categoria:Código/teste. B01/B02/B05 | Separar conclusão factual de comparação científica; fechar cenários obrigatórios. Aceite:Deltas/denominador zero/cobertura corretos, sem gravar ou dupla contagem | PARCIAL |
| **M04-C2** — Sem gravação; confirmação CAS e rollback | Writer CAS, fingerprint, PA07 e idempotência existentes. E04; 5PG/API a657e696 e regressões documentadas | Matriz global operações/concorrência/rollback. Categoria:Teste/segurança. B05 | Reusar provas válidas e completar conflitos faltantes. Aceite:Stale/duas abas/revogação/replay/falha intermediária sem persistência parcial | PARCIAL |

## M05

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M05-C1** — Fonte/autoridade/documento/versão/ID/unidade/população/regras | Envelope factual/origem/contexto cifrados; científico incompleto. E05; parecer DRI | Referência científica autorizada/versionada e manifesto completo. Categoria:Fonte/integração. B01/B02 | Resolver fonte/direitos e implementar vínculo científico permitido. Aceite:ID/autoridade/documento/valor/unidade/população/regra reproduzíveis | BLOCKED no científico; factual PARCIAL |
| **M05-C2** — Reproduzir análise original sem atualização silenciosa | Leitor e registro factual imutável existem. E05/E07/E10 | Reprodução de referência científica original e nova revisão. Categoria:Integração/teste. B01/B02/B07 | Validar atualização de referências com história intacta. Aceite:Mesma análise mantém composição/referência; nova captura distinta, sob RLS | PARCIAL; parte científica BLOCKED |

## M06

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M06-C1** — Colunas, todos filtros aprovados e ordenação determinística | Tabela/filtros/ordem factuais existentes. E06 | Filtros abaixo/acima/ref/UL e ordem científica quando permitida. Categoria:Código/teste. B01/B02 | Completar a partir de contrato científico autorizado. Aceite:Tabela de verdade; decisão sem depender do arredondamento; indisponíveis ordenados | PARCIAL |
| **M06-C2** — Texto/filtros ativos/limpar, sem ranking clínico ou cor única | Componentes e acessibilidade automatizada parcial. E06; 32browser/axe/teclado/200% históricos | Jornada final com comparação e tecnologias assistivas exigidas. Categoria:Teste/UX. B05; B02 no científico | Verificar filtros ativos/limpar e matriz acessível final. Aceite:Desktop/mobile/teclado/zoom; ausência não vira zero; AT com limite declarado | PARCIAL |

## M07

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M07-C1** — Duas versões autorizadas com contexto e deltas válidos | Capturas publicadas/rascunho e comparação autorizadas. E05/E07; contexto posterior disponível por opt-in | Jornada integral/contexto e referências aplicáveis. Categoria:Integração/teste. B01/B02/B05/B07 | Reconciliar captura→comparação com revisão/contexto exatos. Aceite:Duas versões corretas, tenants/pacientes adversários negados, histórico imutável | PARCIAL |
| **M07-C2** — Distinguir dieta/fonte/ref/contexto/cobertura | Marcadores de planejamento/composição/ref/contexto/cobertura. E07/E10 | Referência comum e explicação integral sem atribuição falsa. Categoria:Código/integração. B01/B02/B07 | Isolar dimensões e adicionar comparação comum somente se compatível. Aceite:Cada mudança isolada/combinada; causa desconhecida não atribuída à dieta | PARCIAL |

## M08

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M08-C1** — PDF fiel à análise autorizada e minimizada | PDF factual e formato2 contextual implementados. E08; handoff contexto2 posterior ao resumo antigo | Fontes por nutriente e conteúdo científico autorizado. Categoria:Código/integração. B01/B02/B03/B05 | Reusar M08, reconciliar I01 e versões negociadas. Aceite:Mesmo registro/números/contexto/fontes; canários e revogação; PDF real | PARCIAL |
| **M08-C2** — Arquivo seguro, sem publicação/entrega automática | Exportação reautorizada sem arquivo público/persistido. E08; cancelamento/printscope documentados | Prova final das combinações e política aplicável. Categoria:Teste/segurança. B05 | Preservar autorização e validar cancelamento/erro tardio/retirada. Aceite:Sem impressão após revogação, sem cache/URL pública/envio automático | PARCIAL |
| **M08-C3** — Artefato PDF legível e acessível | PDF real/extração/tagged e prévia acessível já documentados. E08 | Acessibilidade integral e tecnologia assistiva não comprovadas. Categoria:Teste/acessibilidade. B05 | Validar leitura/ordem/cabeçalhos/limites e AT aplicável. Aceite:Artefato final legível/acessível; axe da prévia não basta | PARCIAL |

## M09

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M09-C1** — Explicar RDA/AI/UL, planejado/consumido, parcial e limitações | Ajuda própria versionada implementada. E09; CIb9ed65bc e fonte identificada no handoff | Nenhuma lacuna funcional nova demonstrada neste critério. Categoria:Regressão. B05 apenas se alterada | Preservar aceite técnico existente. Aceite:Reexecutar foco apenas se texto/projeção mudarem; nenhuma inferência diagnóstica | PASS técnico histórico |
| **M09-C2** — Explicações curtas e detalhes acessíveis | Ajuda nativa expansível e acessível no escopo executado. E09; browser/PA07 final documentados | Não elevar evidência automatizada a AT humana. Categoria:Regressão. B05 apenas transversal | Preservar conclusão e verificar regressões dos componentes tocados. Aceite:Teclado/zero/parcial mantidos e limitações honestas | PASS técnico histórico |

## M10

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M10-C1** — Histórico paginado e pontos reproduzíveis | Histórico keyset e autorização implementados. E10/E05 | Referências históricas e gate integral da jornada. Categoria:Integração/teste. B01/B02/B05/B07 | Reconciliar registro/revisão/contexto e conjunto científico permitido. Aceite:Paginação concorrente, carteira atual, pontos reproduzíveis e origem exata | PARCIAL |
| **M10-C2** — Gráfico e tabela equivalentes, sem interpolação indevida | Gráfico factual sem interpolação e tabela com marcadores. E10; 4unit/41PG/69Web/2browser históricos | Cobertura final das descontinuidades e referências científicas. Categoria:Teste/integração. B01/B02/B05/B07 | Testar transições das dimensões e igualdade gráfico/tabela. Aceite:Lacunas sem linha/causa inventada, versões e fontes claras | PARCIAL |

## M11

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M11-C1** — Catálogo autorizado por porção/preparo/teor conhecido | Consulta por teor API/BFF/UI implementada. E11; consulta/handoff e CI137aa547 | Canônica PENDENTE desatualizada; critérios finais de integração. Categoria:Teste/integração. B05 | Propor PARCIAL com evidência e conferir cobertura dos filtros/fontes. Aceite:Conhecido/zero/ausente, preparo, porção, fonte ativa autorizada e paginação | PARCIAL recomendado; oficial ainda PENDENTE |
| **M11-C2** — Restrições confiáveis e mínimas, sem alegar compatibilidade por omissão | Caminho individualizado bloqueado; consulta genérica existe. E11; decisão explícita de não inferir restrições | Contrato estruturado de alergias/restrições confiável. Categoria:Dados/clínica/segurança. B04 | Planejar contrato e obter decisões realmente novas antes de individualizar. **Contrato v2 (D1 a D11) mergeado; contrato v3** (`tasks/food06-m11-restricoes-contrato-v3.md`) incorpora as respostas de 2026-11-12 (D7-a, Q1 a Q11) com matriz de 9 colunas e bloqueios DEV/ATV; a validação clínica, jurídica e de privacidade não ocorreu. **Critério não atendido.** Aceite:IDs/regras/autorização/negações, sem compatibilidade presumida por omissão | BLOCKED |
| **M11-C3** — Prévia/confirmação e dependência FOOD05 protegida | Seleção→prévia e confirmação M04 existentes. E11/E04; 46browser/180serviço/150BFF históricos | Canônica PENDENTE desatualizada; dependência FOOD05 e jornada completa. Categoria:Integração/teste. B05; B04 quando individualizada | Registrar PARCIAL e provar capacidades/ausências sem mecanismo paralelo. Aceite:Sem gravação automática; prévia/confirmar/cancelar/stale; FOOD05 ausente bloqueia caminho dependente | PARCIAL recomendado; oficial ainda PENDENTE |

## M12

| Critério oficial / requisito | Implementação / evidência existente | Lacuna / categoria / dependência | Próxima ação / prova necessária | Status recomendado |
| --- | --- | --- | --- | --- |
| **M12-C1** — Cenários temporários claros e determinísticos | Fundamentos M04 disponíveis; jornada composta não identificada. E12/E04 | Cenários múltiplos nomeados e comparação completa. Categoria:Código/integração. B05; B02 nas referências | Implementar composição temporária reutilizando motores. Aceite:Receita/porção/refeições/dia/macros/micros/cobertura/deltas, determinismo | PENDENTE |
| **M12-C2** — Não persistir/publicar nem somar alternativas excludentes | Guards pontuais M04/M11 não provam cenários compostos. E12/E11 | Ciclo de vida e exclusões na simulação múltipla. Categoria:Código/teste. B05 | Implementar isolamento em memória e descarte/contexto/tardios. Aceite:Sem persistir/publicar, sem alternativas excludentes somadas; troca paciente cancela | PENDENTE |
| **M12-C3** — Confirmar fonte/contexto/revisão/fingerprint atuais | CAS/writer reutilizáveis; sem comando de cenário composto provado. E12/E04 | Confirmação de conjunto com fontes/revisões/fingerprint atuais. Categoria:Código/segurança. B05/B07 | Integrar confirmação atômica existente sem duplicar motor. Aceite:Stale/replay/revogação/rollback/PA07 e publicação preservada | PENDENTE |

## Limites e decisões

- M01-C1 não teve seu PASS de domínio reaberto: PARCIAL representa as saídas ainda
  não comprovadas como conjunto. M02-C3 e M09 preservam seus PASS históricos.
- M11-C1/C3 e resumo contextual M08 têm divergências entre checkpoints/código e
  tabela antiga. Esta reconstrução propõe correção rastreável, sem sobrescrever
  a matriz durante possível trabalho de outro agente.
- A ratificação clínica existente não é tarefa pendente repetida; direitos e
  integração científica são B01/B02 separados. G06 é B06 operacional.
- Recomendações futuras P3, como otimizações especulativas, não integram estes
  critérios nem dispensam requisitos obrigatórios. Não há percentual novo.
