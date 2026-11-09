# Consolidação

| ID | Origem | Funcionalidade | Evidência | Prioridade | Solução | Complexidade | Arquitetura/segurança | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M11-UX01 | Nutricionista | Consulta factual | Hipótese de interpretação | P1 | Lote/porção/nutriente explícitos; sem personalização | Baixa no contrato, UI pendente | Helper não autoriza acesso | JÁ COBERTO no fundamento; AVALIAR na UI |
| M11-UX02 | Nutricionista | Cobertura | Risco plausível | P2 | Estados e contagens separados de valor | Baixa | Sem zero inventado | JÁ COBERTO no fundamento; AVALIAR na UI |
| M11-UX03 | Nutricionista | Identificação | Hipótese de fricção | P3 | IDs/fontes/preparo e ordem determinística | Baixa | Projeção por allowlist | JÁ COBERTO no fundamento; AVALIAR na UI |

Não amplia o escopo aprovado nem habilita julgamento clínico. Etapas B/C NOT RUN por ausência de interface; D deverá reutilizar estas decisões. Não há consenso fabricado ou validação com usuários reais.
