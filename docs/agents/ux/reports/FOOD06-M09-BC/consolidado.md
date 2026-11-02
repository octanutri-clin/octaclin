# FOOD06 M09 — UX B/C

## Método, evidência e limites

Referência explícita PR451/0d3382b6. Duas instâncias independentes, papéis
food06_m09_nutricionista_ux e food06_m09_paciente_ux; persona fictícia, sem
credenciais profissionais reais. Seleção nativa TOML não comprovada.

Respeitando os papéis aprovados, nenhuma persona utilizou ferramentas,
leu arquivos, executou testes ou inspecionou imagens. Cada uma recebeu brief
sintético separado sobre a interface implementada e evidências do coordenador.
É raciocínio independente com evidência mediada, não interação independente,
teste com usuários reais, ratificação clínica ou R4. B/C do incremento M09,
não conclusão de todas as jornadas FOOD06. Capturas e browser são evidência
do coordenador e não devem ser atribuídos às personas.

## Avaliação do nutricionista

Pontos positivos: diferencia planejamento/consumo, desconhecido/zero e
completude/elegibilidade. Ajuda não transforma referências em diagnóstico ou
metas e não altera números nem confirmação. Sete títulos permitem consulta
pontual sem expandir tudo. Não foi fornecida evidência de P0/P1.

Dificuldades: em consulta rápida, descoberta da justificativa de indisponibilidade
pode exigir abrir tópicos pouco pertinentes. Dados parciais poderiam ser
interpretados como totais caso a sinalização estivesse somente no guia.
Oportunidade de produtividade: ligação clara entre aviso e tópico, sem novo fluxo.

## Avaliação do paciente

Portal direto N/A: este incremento só aparece no console profissional. Perspectiva
indireta: explicações transmitidas durante consulta. O conteúdo evita culpabilizar,
confundir planejamento com consumo e diagnosticar deficiência/toxicidade.

Dúvidas prováveis: cobertura pode ser entendida como atendimento das necessidades;
planejado≠consumido precisa estar perceptível mesmo com a ajuda recolhida.
Nenhum P0 comprovado ou P1 demonstrado. Sem inspeção mobile/tecnologia assistiva
pela persona; resultados técnicos são do coordenador.

## Consolidação

| ID | Origem | Funcionalidade/problema e natureza | Evidência / impacto | Prioridade | Proposta e aceite | Complexidade/arquitetura | Estado |
|---|---|---|---|---|---|---|---|
| NUX-M09-01 | Nutricionista | Encontrar explicação de indisponibilidade; hipótese de eficiência | Brief: guia e tópico recolhidos; cliques exploratórios na consulta | P2 | Verificar ligação entre aviso e tópico; encontrar justificativa sem abrir RDA/AI/UL | Baixa, apresentação; sem mudança de elegibilidade | BACKLOG; sem nova decisão automática |
| NUX-M09-02 | Nutricionista | Subtotal confundido com total; risco plausível dependente de apresentação | Brief não detalhava sinalização junto aos números | P2 | Mesmo com guia fechado, parcial informa que total real é desconhecido | Já implementado na tabela; sem novo cálculo | JÁ COBERTO: quantidade contabilizada/total real desconhecido e detalhes; prova browser |
| PUX-M09-01 | Paciente indireto | Palavra cobertura ambígua na falha da ajuda; hipótese de compreensão | Mensagem descrita no brief poderia sugerir adequação | P2 | “Os valores apresentados e a indicação de dados conhecidos ou desconhecidos permanecem iguais.”; zero preservado | Baixa, texto de estado; sem dado/permissão nova | JÁ COBERTO — refinamento incorporado dentro da clareza já aprovada, sem decisão clínica |
| PUX-M09-02 | Paciente indireto | Planejado confundido com consumido; risco plausível se distinção só no guia | Brief não detalhava texto fixo do resumo | P2 | Frase no resumo sem expandir ajuda e sem criar portal | Já existe no componente factual e contexto da prévia | JÁ COBERTO: “Composição da seleção planejada, não do consumo real.” |

Não houve consenso fabricado nem sugestão convertida automaticamente em requisito.
O refinamento de mensagem não altera escopo, dados ou direitos. Descoberta do
tópico permanece oportunidade para fase D; consultar este relatório antes de
nova alteração. Não expandir ajuda automaticamente por opinião das personas.

## Critérios técnicos do coordenador

Ver tasks/food06-interface-ajuda.md para RED/GREEN, matriz browser, builds,
limitações, CI e fonte. A ajuda começa recolhida, sete tópicos em português,
fonte externa apenas por clique sem referrer. Parser inválido preserva fatos;
legado sem ajuda permanece funcional. Testes automatizados não demonstram
compreensão humana ou teste de leitor de tela por pessoa.

Capturas sintéticas finais do coordenador: [desktop](desktop.png) e
[mobile](mobile.png). A captura do modal representa sua posição de rolagem no
momento do teste; não representa todo o conteúdo de uma única tela.
