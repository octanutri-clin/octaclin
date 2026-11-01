# FOOD06 M02 — UX B/C delimitada

Papéis persistentes da #451, commit0d3382b6; executados por duas instâncias
independentes com brief explícito, sem herdar contexto clínico, sem ferramentas,
sem edição/rede ou pacientes reais. Não é comprovação de seleção nativa de TOMLs.
Relatos abaixo são síntese editorial dos pareceres, preservados também na atividade
dos agentes. As personas não interagiram com browser nem observaram screenshots:
receberam textos DOM e resultados sintéticos do coordenador. Não é validação com
usuários reais, AT humana, ratificação clínica ou revisão R4.

Revisores: `/root/food06_m02_nux` e `/root/food06_m02_pux`. Brief: interface
profissional por nutriente, listagem25+1 alimentos, subtotal da refeição inteira,
quantidade/unidade/gramas congelados, paginação, rejeição de403, sem mudança de plano.

| ID | Tipo/prioridade | Sugestão | Decisão e evidência |
| --- | --- | --- | --- |
| NUX-M02-01 | Hipótese/P2 | Mostrar quantidade×peso por porção | REJEITAR multiplicação: backend usa entrada.porcaoGramas diretamente em calcularNutrientesPorcao; multiplicar novamente alteraria a leitura. INCORPORADO ajuste de texto: “peso já considerado no cálculo”. Sem nova conversão ou prescrição |
| NUX-M02-02 | Hipótese/P2 | Sem seleção mostrar total0mg | REJEITAR zero artificial: cobertura sem componentes é indisponível, não total0. JÁ COBERTO aviso sem alimentos e distinção zero conhecido/ausência |
| NUX-M02-03 | Sugestão/P3 | Informar faixa1–25de26 junto à paginação | INCORPORADO dentro do contrato aprovado de paginação, sem novo fluxo |
| PUX | N/A direto | Sem jornada nova no portal | N/A: somente console, sem relatório/envio ao paciente. Risco indireto de confundir planejado/consumido permanece hipótese; ressalvas já presentes |

Nutricionista considerou úteis consulta sob demanda, agrupamento por refeição e
não gravação. Fonte/preparo, ordenação global e navegação de origem foram
explicitamente informados como pendentes; nenhum parecer os aprovou como entregues.
Não houve consenso fabricado nem nova decisão de produto delegada às personas.
