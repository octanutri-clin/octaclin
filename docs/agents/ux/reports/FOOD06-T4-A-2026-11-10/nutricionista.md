# Nutricionista (NUX) — síntese editorial do coordenador

Modalidade: instância nova com o papel `octaclin-nutricionista-ux` fornecido como prompt, sem ferramentas, somente proposta. Parecer entregue antes das decisões do proprietário; não foi transcrito literalmente.

Sem P0. Positivos: opt-in, sem semáforo, ND nunca vira zero, idade calculada no servidor, UL indisponível com motivo, registros antigos nunca recalculados, fonte e versão visíveis.

| ID | Prio | Tipo | Resumo |
| --- | --- | --- | --- |
| NUX-01 | P1 | risco plausível | Confirmações perdidas ao mudar a seleção; manter as do paciente na sessão e reconfirmar só o dia. |
| NUX-02 | P1 | risco plausível | Mesmo formulário em dois lugares (comparar e salvar); usar um estado único. |
| NUX-03 | P1 | risco plausível | Nenhuma resposta implícita: gestação, lactação, população e tabagismo explícitos, sem "não" por omissão. |
| NUX-04 | P1 | risco plausível | "Mesmo dia" não é "dia completo"; reformular o texto e mostrar a base. |
| NUX-05 | P1 | risco plausível | Verificar que campo vazio em alimento manual não vira zero (encaminhado à engenharia). |
| NUX-06 | P1 | risco plausível | Invalidar a comparação ao mudar paciente ou seleção; descartar resposta tardia; manter confirmações em falha. |
| NUX-07 | P2 | hipótese de fricção | Inelegibilidade descoberta só no fim; gestação e lactação primeiro; mensagem única de contexto. |
| NUX-08 | P2 | hipótese de fricção | "Indisponível" confunde "não solicitada" com "sem referência". |
| NUX-09 | P2 | sugestão | Pressupostos visíveis com o bloco recolhido; "Alterar" e "Desativar". |
| NUX-10 | P2 | sugestão | Resumo "X de 22 comparados" e filtro "Comparáveis"; não comparável nunca vira 0%. |
| NUX-11 | P2 | risco plausível | Redação das linhas RDA/AI e UL (ambiguidade de "50% de 1000 mg"; "abaixo" pode soar como "seguro"). |
| NUX-12 | P2 | sugestão | "Como ler" uma vez, não 22; detalhes só com exceções. |
| NUX-13 | P2 | risco plausível | Relatório impresso: escolha explícita de incluir a comparação; contexto, fonte e versão no papel. |
| NUX-14 | P2 | hipótese | Celular, teclado, leitor de tela: a testar nas etapas B e C. |
| NUX-15 | P3 | sugestão | Histórico: no máximo um indicador mínimo; resumo completo depois. |

Conclusão do papel: sem bloqueio na etapa A; resolver NUX-02, 03, 04, 05 e 06 antes do protótipo.
