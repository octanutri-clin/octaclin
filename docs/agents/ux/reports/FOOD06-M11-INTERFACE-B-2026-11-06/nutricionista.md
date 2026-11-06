# Nutricionista — síntese editorial dos retornos A/B

Instância /root/food06_contexto_ux_a, persona fictícia. Sem teste humano, credenciais clínicas reais, inspeção visual própria ou ratificação clínica.

| ID | Cenário/objetivo | Problema/tipo/evidência | Prioridade/impacto | Sugestão e aceite verificável |
| --- | --- | --- | --- | --- |
| M11-UI-NUX01 | Encontrar alimentos por nutriente durante consulta | Hipótese A: primeira página interpretada como ranking global | P1; interpretação equivocada | Página/porção explícitas; texto junto ao resultado limita ordenação à página e informa critério de seleção. B: atendido no relato |
| M11-UI-NUX02 | Conferir porção versus100g | Risco plausível A de troca de denominador ou ausência interpretada como0 | P2; escolha baseada em dado inexistente | Bases/unidades nas colunas, zero/ausente/traço separados. B: atendido nos estados relatados; incompatível ainda não demonstrado à persona naquele retorno |
| M11-UI-NUX03 | Editar consulta ou trocar seleção | Hipótese A: resultado anterior permanece sob novos campos | P3; confusão/reconferência | Limpar/abortar e proteger callbacks;401/403 invalidam dados. B: parcialmente demonstrado; matriz em andamento |
| M11-UI-NUX04 | Conferir fonte com fonte200%/tela pequena | Fricção plausível B baseada no screenshot relatado pelo coordenador: fonte fora da largura inicial | P2; origem difícil de localizar | Indicação perceptível e rolagem horizontal por teclado até fonte/versão. Implementadas indicação visível e prova de deslocamento por ArrowRight; resultado final a registrar |

Pontos positivos: porção comum, origem e denominadores claros, consulta explícita e ausência de alterações clínicas automáticas. A contagem de cobertura não é confiança científica. Oportunidade: manter as mesmas distinções na prévia futura sem ampliar escopo. Retorno B favorável ao demonstrado, condicionado à matriz; não encerra FOOD06 ou a11y humana.
