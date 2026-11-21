# Consolidação — QST01 A

| ID | Origem | Funcionalidade/problema | Evidência | Prioridade | Solução sugerida | Complexidade | Arquitetura/segurança | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NUX-QST01-01 | Nutricionista | Evitar abertura obrigatória adicional | Código atual aberto; fricção hipotética | P2 | Preservar aberto/resumo | Baixa | Estado visual apenas | JÁ COBERTO na proposta |
| NUX-QST01-02 | Nutricionista | Alcance ambíguo de ações coletivas | Hipótese | P2 | Explicitar resultados exibidos | Baixa | Sem nova consulta | JÁ COBERTO na proposta |
| NUX-QST01-03 | Nutricionista | Resultado de busca escondido | Hipótese | P2 | Expansão clara; não adicionar indicação nova automaticamente | Baixa | Preservar busca existente | JÁ COBERTO; indicação adicional BACKLOG |
| NUX-QST01-04 | Nutricionista | Foco/estado ao recolher ou trocar contexto | Risco plausível | P1 | Controles acessíveis e reset | Baixa/moderada | Sem persistência clínica | JÁ COBERTO; prova futura obrigatória |

“JÁ COBERTO” descreve a proposta, não implementação ou teste aprovado.
Decisão humana sobre detalhes de produto: pendente de revisão do planejamento.
Não há novo P0 nem defeito funcional demonstrado. B/C permanecem não executadas.

Instância independente do implementador: `/root/melhorias_profissionais_ux`,
iniciada com `fork_turns=none`, brief sintético e papel explícito. Nenhuma chamada
de ferramenta consta no retorno. Permissões herdadas não equivalem a sandbox
independente. Não é revisão R4 nem pesquisa com usuários reais.
