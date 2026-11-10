# Consolidação — FOOD06 T4a, etapas B/C

Duas instâncias com papel fornecido como prompt e sem ferramentas, avaliando só texto e resultados de testes do commit 5bc34c0a. Não é interação real, leitor de tela, pesquisa com pessoas, validação clínica ou R4. As decisões de produto continuam as do proprietário (consolidado da etapa A).

| ID | Origem | Estado | O que foi feito ou decidido |
| --- | --- | --- | --- |
| NUX-16 | NUX | FECHADO (técnico) | A linha de status usa os rótulos do formulário e diz que a vitamina C fica sem comparação quando o tabagismo não foi informado. Teste de unidade e visual. |
| NUX-17 | NUX | FECHADO (técnico) | Já era assim: UL de forma restrita mostra "UL não comparável: o limite vale para uma forma específica"; só "não estabelecido" fica sem linha. Teste visual acrescentado. |
| NUX-20 | NUX | FECHADO (técnico) | "Não aplicável" vira fora do escopo, e a conferência da população entra em "Falta responder". Teste visual. |
| NUX-06 | NUX | FECHADO (técnico) | Teste de resposta atrasada da comparação após mudar a seleção. |
| NUX-05 | NUX | PARCIAL | Verificado por leitura e por `micronutrientes.spec.ts` que micronutriente omitido vira `ausente`, nunca zero, e o cadastro manual com `micronutrientes` omitido gera `{}`. Não há teste ponta a ponta do cadastro manual; fica como item de engenharia, não aprovado como fechado. |
| NUX-01 | NUX | PARCIAL | Seleção coberta por teste; a troca de paciente zera tudo pela `key={pacienteId}` do componente, sem teste visual próprio. |
| NUX-02 | NUX | PARCIAL | Sem a comparação ativa, o salvar mostra o formulário de sempre. O resultado visto na tela no impresso fica na T4b. |
| PUX-13 | PUX | FECHADO (técnico) | Resumo reescrito: "Comparado em 1 de 22 nutrientes. Faltam dados de alguns alimentos do plano em 21." e "sem valor de referência" só quando maior que zero. |
| PUX-14 | PUX | PARCIAL | DRI definida por extenso no "Como ler"; "população de referência" no status; versão continua em texto secundário. |
| PUX-15 | PUX | FECHADO (técnico) | "menos de 1% da RDA". |
| PUX-06 | PUX | PARCIAL | "Como ler" cita suplementos que não foram lançados no plano. |
| NUX-07, 10, 11, 14, PUX-09, 10 | NUX/PUX | BACKLOG | Caminho ao cadastro do nascimento, filtro "Comparáveis", ordenação por percentual, leitor de tela real e teclado completo. |
| NUX-18, 19, 21, NUX-12 (atalho) | NUX | BACKLOG | Observar uso real, medir tempo com pessoas e desambiguar o rótulo do salvar. |
| NUX-13, 15, PUX-02 (impresso), 08, 11, 12 | NUX/PUX | T4b | Relatório e histórico. |

APROVAR e FECHADO (técnico) são recomendações e fechamentos de engenharia, não aceite humano. Divergências preservadas: filtro "Comparáveis" (nutricionista) fica em backlog por escopo; tabela ou linhas no impresso fica para o protótipo da T4b.

## Decisões e continuidade

| IDs | Decisão humana | Data | Tarefa/PR | Aceite e prova | Próxima revisão |
| --- | --- | --- | --- | --- | --- |
| Textos e ajustes acima | PENDENTE (revisão de conteúdo de RDA/AI/UL) | 2026-11-10 | T4a | Testes citados e esta consolidação | T4b |
| NUX-05 | PENDENTE | 2026-11-10 | Engenharia | Teste ponta a ponta do cadastro manual | T4b |
