# Nutricionista — etapa A

Síntese editorial da saída do subagente `/root/melhorias_profissionais_ux`.
Papel fornecido explicitamente; seleção nativa de TOML não comprovada.
Persona fictícia, revisão estática do planejamento, sem ferramentas ou interação.

Pontos positivos: o recolhimento pode reduzir volume visual sem mudar o fluxo de
leitura atual, desde que o estado inicial e o resumo sejam preservados.

| ID | Cenário/objetivo | Dificuldade e evidência/hipótese | Impacto e proposta | Aceite verificável | Prioridade |
| --- | --- | --- | --- | --- | --- |
| NUX-QST01-01 | Revisar vários envios | Código descrito mostra tudo; dificuldade em listas extensas é hipótese | Reduzir volume sem adicionar abertura obrigatória: iniciar aberto e preservar resumo | Recolher só detalhes, manter ordem/conteúdo e nenhum request extra | P2 |
| NUX-QST01-02 | Organizar lista filtrada | “Tudo” pode sugerir alcance fora do filtro; hipótese de compreensão | Indicar resultados exibidos e não oferecer ação ativa na lista vazia | Somente subconjunto visível afetado; filtros/ordem preservados | P2 |
| NUX-QST01-03 | Buscar termo de resposta recolhida | Correspondência escondida pode parecer incorreta; hipótese | Manter busca e acesso claro à expansão; indicação adicional de correspondência seria proposta separada | Termo escondido encontra envio; expandir permite conferi-lo sem request | P2 |
| NUX-QST01-04 | Navegar por teclado/trocar contexto | Foco oculto e estado herdado são riscos plausíveis, não defeitos demonstrados | Botões nativos, foco visível e reset ao mudar paciente/questionário | Tab/Enter/Espaço, estado acessível coerente e contexto novo aberto | P1 |

Oportunidade: organizar a revisão sem mais telas ou campos. Não houve teste com
profissionais reais, medição de cliques, validação clínica ou revisão R4.
