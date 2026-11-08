# FOOD06-M01 — etapa A de UX sobre as melhorias NUX

Síntese editorial do coordenador a partir do relatório devolvido pelo subagente; não é transcrição literal.

- **Momento:** etapa A real, **antes** de implementar as melhorias NUX (a etapa A da entrega original de M01 continua não executada). O plano textual foi avaliado antes de qualquer alteração de código.
- Modalidade: papel de nutricionista fornecido a um subagente de runtime, **sem ferramentas**, a partir de plano textual. Uma instância; IDs não preservados. Paciente N/A. Não é pesquisa com pessoas nem R4.
- Decisão do proprietário registrada: todas as melhorias NUX (01, 02, 03, 09, 10, 13) foram lidas e consideradas válidas, e a implementação foi autorizada.

## Recomendação principal acolhida

Resumo de origem **sempre visível** na linha, com peso baixo, e **exceções em linha própria com peso alto**, nunca só por cor. Rejeitada a alternativa "só exceções", porque o silêncio é ambíguo (tudo catalogado, dado ausente ou recurso não carregado).

| ID | Achado do subagente | Prioridade | Como foi tratado |
| --- | --- | --- | --- |
| NUXA01 | Resumo sempre, exceção em destaque | P1 | Implementado. Exceções primeiro, com ícone e texto (`▲` atenção, `●` informativo) |
| NUXA02 | "+N fontes" não pode esconder exceção | P1 | Implementado. Exceções integrais e fora do "+N"; "+N" só para bases catalogadas reconhecidas |
| NUXA03 | A origem vale só para os alimentos conhecidos | P1 | Implementado. Linha colada à cobertura; sem linha quando 0 conhecidos; legenda acima da tabela |
| NUXA04 | Densidade em celular | P2 | Implementado. 1 fonte + "+N" no celular e 2 no desktop; exceções sempre integrais. Verificado em Chromium mobile |
| NUXA05 | Limitação onde se lê | P1 | Implementado. Legenda acima da tabela e no cabeçalho do relatório; frase completa em tamanho de corpo abaixo e nos detalhes |
| NUXA06 | Rótulos e ordem | P2 | Implementado. "Entrada manual"; ordem manual, personalizado, não catalogada e bases por quantidade; mesma ordem na linha, nos detalhes e no relatório |
| NUXA07 | Fonte não catalogada | P2 | Implementado. "Fonte não catalogada (código x)", com quebra permitida |
| NUXA08 | Legenda na célula e cabeçalho repetido | P1 | Implementado a legenda no cabeçalho. Repetição do cabeçalho por página não foi medida em impressão de várias páginas (depende do navegador) |
| NUXA09 | Lista em célula com até 50 grupos | P1 | Implementado em lista, com linhas que não se partem até 6 itens. PDF real com 50 grupos sem corte (teste de navegador). A continuação sem o nome do nutriente em página seguinte não foi avaliada |
| NUXA10 | Não adicionar passo ao fluxo | P2 | Atendido: sem modal nem campo novo; "Detalhes" continua com a lista completa |
| NUXA11 | Contagem-resumo "entrada manual em X de 22" | P3 | BACKLOG, pedido do próprio parecer: depende de decisão de produto |

**Pergunta 6 (quem registrou a composição manual e quando):** não implementada. O dado não existe no snapshot congelado, e incluí-lo seria dado novo de persistência e identidade, com análise de privacidade. Se aprovado depois: só em detalhes e relatório, com "Autoria não registrada" para itens antigos.

## Limitações

Sem tela real avaliada pelo subagente; celular e impressão reais não foram medidos por pessoas. A etapa C com a interface pronta deve repetir essa avaliação com evidência real.
