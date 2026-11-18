# Consolidação — FOOD06 P3-1, etapas B e C

Modalidade: duas instâncias distintas do runtime com o papel fornecido como prompt, 0 chamadas de ferramenta cada, só com o
`brief.md`; não independentes do coordenador; sem leitor de tela real nem pessoas. Sem P0. APROVAR é recomendação.

| ID | Prio. | Estado | Tratamento nesta PR | Prova |
| --- | --- | --- | --- | --- |
| PUX-10 / NUX-13 | P1 | CORRIGIDO | Abertura: "Se alguma informação estiver desatualizada, fale com quem faz seu acompanhamento." O texto aprovado ("Solicite uma correção…") volta na P3-2 com o botão | Unitário (abertura sem "Solicite") e Playwright |
| PUX-11 | P1 | CORRIGIDO (defeito real) | Trocar a pessoa não move mais o foco; a troca é anunciada em `role="status"` | Playwright: duas setas chegam à terceira pessoa com o foco no grupo, nos dois projects |
| PUX-12 | P2 | CORRIGIDO | "Item que ainda não aparece com nome aqui. Pergunte a quem faz seu acompanhamento." | Playwright |
| PUX-15 | P2 | CORRIGIDO | Vazio com o nome da pessoa para representante; "sem acesso" com caminho | Playwright (teste novo de vazio do representante; 403) |
| NUX-15 / PUX-16 (data) | P2 | CORRIGIDO | "Última conferência geral … Itens marcados como "ainda será conferido" ainda não foram confirmados." | Unitário e Playwright |
| NUX-18 | P1 | JÁ COBERTO | Título "Restrições alimentares de {nome}" desde a primeira versão | Playwright |
| NUX-17 | P1 | JÁ PLANEJADO | P3-5 (NUX-03 da etapa A: campos separados e prévia) | — |
| NUX-14 | P1 | AVALIAR | "Trigo" em "Outras condições" é a fixture sintética (subtipo "outra restrição clínica"); o selo "enviada pelo portal" só existirá depois da P3-2. Rever o rótulo do grupo no teste de compreensão (ATV-7) | — |
| PUX-13 / NUX-19 | P2 | BACKLOG | O pedido do portal não traz o item (a API não devolve `restricaoId` ao portal); exige backend | — |
| PUX-14 / NUX-16 | P2 | BACKLOG (ATV-7) | Selos decididos pelo proprietário; legenda e teste de leitura | — |
| NUX-20 | P2 | DECISÃO DO PROPRIETÁRIO | Canal de contato da clínica no portal | — |
| NUX-21 | P2 | DECISÃO DO PROPRIETÁRIO | Avisar o paciente quando uma restrição é inativada | — |
| PUX-16 (termos, limite) / NUX-22 | P3 | BACKLOG | Termo único e orientação no limite de 100; efeito de "escolha" no plano (depende da P4) | — |

Leitor de tela real e teste com pessoas continuam SKIPPED (ATV-7). As etapas B/C da escrita do portal ficam para a P3-2.

## Decisões do proprietário (2026-11-18), registro datado

- NUX-14: **(a)** manter "Outras condições"; rever no teste de compreensão (ATV-7). ACEITA.
- NUX-20: **(a)** link para "Mensagens" do portal (P3-2) **e** link externo configurável pelo profissional (ex.: WhatsApp), em fatia própria com validação de URL; ver `tasks/food06-p3-plano.md`. ACEITA com ampliação.
- NUX-21: **(a)** não avisar a inativação feita pela equipe; rever no ATV-7. ACEITA.
