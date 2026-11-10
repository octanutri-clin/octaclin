# Consolidação — FOOD06 T4, etapa A

Revisão A, proposta estática, por duas instâncias novas com papel fornecido como prompt e sem ferramentas (modo 2 do procedimento). Não é seleção nativa de TOML, sandbox independente, pesquisa com pessoas, validação clínica nem R4. B e C não foram executadas: ainda não há interface.

## Decisões do proprietário (2026-11-10)

| IDs | Decisão | Origem |
| --- | --- | --- |
| NUX-01, 02, 03, 04, 06 | **ACEITA.** Confirmações do paciente (população, gestação, lactação, aplicabilidade, tabagismo) ficam só na memória da tela durante a sessão do mesmo paciente, sem persistência; zeram ao trocar de paciente. Só "dia completo" é reconfirmado quando a seleção muda. Um estado único serve a comparação e ao salvar. Nenhuma resposta vem pré-preenchida e só se aplica com tudo respondido. | Proprietário, recomendação do coordenador |
| NUX-13, PUX-08, PUX-12 | **ACEITA.** Comparação no relatório impresso só por escolha explícita na hora de gerar, desligada por padrão, habilitada só se o registro tem referências. Registro sem referências: explicação na tela do profissional e nada no papel. | Idem |
| NUX-11, 12, PUX-01, 02, 04, 05, 06, 07, 11 | **ACEITA** com ajustes: texto factual "Planejado: 500 mg = 50% da RDA (1000 mg)" e "Limite superior (UL): total planejado abaixo/acima de 2500 mg"; sem "seguro", "excesso" ou "risco"; "do dia" explícito; "<1%" em vez de "0%"; "Como ler" uma vez, com nomes por extenso; frase de que o total considera só o que está no plano; frase fixa "converse com seu nutricionista" na folha. | Idem, após o parecer do paciente |

## Recomendações sem decisão humana ainda

| ID | Estado | Nota |
| --- | --- | --- |
| NUX-05 | AVALIAR | Verificação de campo vazio em alimento manual, encaminhada à engenharia. |
| NUX-07 | APROVAR (parcial) | Mensagem única de contexto; gestação e lactação primeiro. Caminho de ida e volta ao cadastro do nascimento fica em BACKLOG. |
| NUX-08, 09 | APROVAR | "Não solicitada" no lugar de "Indisponível"; resumo ativo com "Alterar" e "Desativar". |
| NUX-10 | BACKLOG | Resumo "X de 22" entra; filtro e ordenação por percentual ficam em BACKLOG. |
| NUX-14, PUX-09, 10 | BACKLOG | Teclado, leitor de tela, ampliação e layout impresso: provas das etapas B e C. |
| NUX-15 | BACKLOG | Indicador mínimo no histórico, decisão futura. |

Divergências preservadas: o nutricionista pede o filtro "Comparáveis" e o resumo; o coordenador limita a primeira entrega ao resumo. O paciente prefere tabela impressa e a nutricionista, linhas de texto; decisão adiada ao protótipo do relatório (T4b).

## Continuidade

| IDs | Decisão humana | Data | Tarefa/PR | Aceite e prova | Próxima revisão |
| --- | --- | --- | --- | --- | --- |
| Tabela e confirmações | ACEITA (parcial) | 2026-11-10 | T4a | Playwright desktop/celular, teclado e axe | Etapa B ao ter a tela; C antes de concluir a PR |
| Relatório e histórico | ACEITA (parcial) | 2026-11-10 | T4b, após merge da #511 | PDF real, impressão e tela | Etapas B e C |
