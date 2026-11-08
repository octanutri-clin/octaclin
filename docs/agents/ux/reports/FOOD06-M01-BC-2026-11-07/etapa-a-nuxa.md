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
| NUXA05 | Limitação onde se lê | P1 | Implementado e **medido**: a legenda é o elemento imediatamente acima da tabela (distância < 40 px, desktop e mobile, em Chromium); no relatório está no cabeçalho da coluna e acima da tabela |
| NUXA06 | Rótulos e ordem | P2 | Implementado em **todos** os lugares: linha, detalhes por nutriente, detalhes por alimento (M02, que ainda dizia "composição informada manualmente") e relatório. Ordem manual, personalizado, não catalogada e bases por quantidade |
| NUXA07 | Fonte não catalogada | P2 | Reimplementado. A versão anterior ("código x") era **inalcançável** com o backend. Agora o backend emite um grupo `nao_catalogada` quando há fonte registrada que não é uma das governadas, sem expor código, versão ou texto livre; a interface mostra "Fonte não catalogada (N alimentos)" como ponto de atenção |
| NUXA08 | Legenda na célula e cabeçalho repetido | P1 | Implementado e **medido** em PDF real de 8 páginas (A4, Chromium): o cabeçalho com a legenda aparece em todas as páginas |
| NUXA09 | Lista em célula com até 50 grupos | P1 | Implementado em lista, com linhas que não se partem até 6 itens. **Medição no PDF real encontrou um defeito**: as páginas que continuavam a lista de origens do ferro não traziam o nome do nutriente. Corrigido: em listas com mais de 6 itens, cada item leva o nome do nutriente; agora todas as páginas com a lista o trazem. "Mostrando 50 de X fontes" não foi feito: o backend informa alimentos nas fontes adicionais, não grupos |
| NUXA10 | Não adicionar passo ao fluxo | P2 | Atendido: sem modal nem campo novo; "Detalhes" continua com a lista completa |
| NUXA11 | Contagem-resumo "entrada manual em X de 22" | P3 | **Implementado** acima da tabela ("Entrada manual em N de 22 nutrientes." e, quando houver, "Origem a conferir … em N de 22 nutrientes."), por decisão posterior do proprietário. Acompanha um filtro "Origem dos dados" (todas, com entrada manual, com origem a conferir), que só aparece quando a resposta traz a origem |

**Pergunta 6 (quem registrou a composição manual e quando):** não implementada. O dado não existe no snapshot congelado, e incluí-lo seria dado novo de persistência e identidade, com análise de privacidade. Se aprovado depois: só em detalhes e relatório, com "Autoria não registrada" para itens antigos.

## Limitações

Sem tela real avaliada pelo subagente; celular e impressão reais não foram medidos por pessoas. A etapa C com a interface pronta deve repetir essa avaliação com evidência real.

## Acréscimos desta rodada

- **Origem alcançável no relatório principal:** o relatório com origem por nutriente (formato 2) só era oferecido dentro do bloco de contexto, depois de marcar "Carregar contextos registrados" e expandir o contexto. Análises salvas sem contexto só tinham o formato 1. Agora toda análise sem contexto tem o botão "Conferir relatório com origem por nutriente", sem passo extra. O formato padrão da API não mudou.
- **Origem no histórico:** a célula de cobertura do nutriente selecionado mostra a mesma linha de origem da tabela.
- **Severidade para leitor de tela:** o ícone (`▲` atenção, `●` informativo) continua `aria-hidden`; agora há texto oculto "Atenção:" ou "Informação:" antes da mensagem.
- Continua não feito: autoria da entrada manual (dado novo de persistência e privacidade).
