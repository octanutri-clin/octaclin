# Consolidação

| ID | Origem | Funcionalidade | Problema/evidência | Prioridade | Solução | Complexidade | Arquitetura/segurança | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M11-PREVIA-NUX01 | Nutricionista A/B/C | Seleção/prévia | Hipótese e fluxo relatado | P1 | Seleção sem gravar, cálculo/confirmar separados | Baixa | Writer existente, sem automático | JÁ COBERTO nos cenários |
| M11-PREVIA-NUX02 | Nutricionista A/B/C | Porção | Risco plausível e46browser | P1 | Gramas explícitas e edição invalida | Baixa | Sem fator próprio ou motor novo | JÁ COBERTO nos cenários |
| M11-PREVIA-NUX03 | Nutricionista A/B/C | Origem/fonte | Relato e180serviço | P2 | Metadados transitórios e resolução backend | Média no contrato existente | Não presume direitos/PG | JÁ COBERTO no escopo separado; prova fullstack não executada |
| M11-PREVIA-NUX04 | Nutricionista B/C | Foco | Defeito reproduzido pelo coordenador | P2 | Ref síncrono para peso | Baixa | Sem foco atrasado após fechamento | JÁ COBERTO nos cenários |
| M11-PREVIA-NUX05 | Nutricionista C | Reconsulta | Hipótese de fricção não exercitada diretamente | P3 | Testar pesquisa sem selecionar mantendo destino | Baixa | Sem novo escopo/runtime | BACKLOG |

BACKLOG também para tecnologia assistiva humana. Sem aprovação de clínica, direitos, CI futuro, merge ou produção. Não houve novo requisito de produto: refinamentos de apresentação/segurança dentro do fluxo aprovado. PacienteN/A. Etapa D deve preservar essas decisões na integração M12 futura.
