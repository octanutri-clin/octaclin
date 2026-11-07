# FOOD06-M01 — UX/produto, etapas B e C (consolidado)

## Contexto e execução

- Escopo/versão: origem por nutriente (aditivo). Base `137aa547`; commits locais desta branch. Hash do brief não calculado.
- **Etapa A não foi executada antes da implementação.** Lacuna de processo do agente principal, registrada aqui. Esta revisão não a substitui nem a recompõe retroativamente.
- Modalidade: **fallback sequencial, simulações do agente principal, não independentes.** Nenhum subagente foi usado. Não há IDs de instâncias, e isto não é R4 independente.
- Evidência: código lido; interface real executada pelo agente em Chromium (desktop e mobile) com respostas sintéticas simuladas; screenshots do bloco de detalhes e da prévia do relatório inspecionados; axe sem violações nas áreas alteradas.
- Paciente: **N/A.** O incremento só altera o console profissional e a prévia do relatório profissional. Não muda conteúdo, visibilidade, notificação ou documento do portal, e o relatório não é enviado ao paciente.
- Limitações: sem pessoas reais; não é validação clínica nem científica; sem tecnologia assistiva humana; PDF real não executado neste relatório.

## Nutricionista — parecer (simulação sequencial)

Positivo: o zero conhecido de cálcio aparece como "0 mg" com origem, o que evita ler ausência como zero. O texto "Origem do registro de composição do alimento. Não comprova que a base mediu este nutriente" delimita o que a origem significa. Selênio sem valor diz "Nenhum alimento com valor conhecido… não há origem a informar", sem inventar fonte.

Dificuldades: a origem fica dentro de "Detalhes", exigindo um clique por nutriente; para auditar vários nutrientes isso é lento. Códigos de fonte desconhecidos aparecem como "código x", técnico para a rotina de atendimento.

## Achados

| ID | Origem | Funcionalidade | Problema | Evidência/hipótese/tipo | Prioridade | Solução | Complexidade | Arquitetura/segurança | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M01-NUX01 | Nutricionista B/C | Detalhes da tabela | Origem só após expandir, um nutriente por vez | Hipótese de fricção; fluxo exercitado em browser | P2 | Resumo de origem na própria linha, sem expandir | Baixa | Só apresentação; mesmos dados | BACKLOG (muda a densidade da tabela, decisão de produto) |
| M01-NUX02 | Nutricionista B/C | Rótulos de fonte | Código desconhecido exibido como "código x" | Sugestão de melhoria | P3 | Catálogo de rótulos mantido pelo produto | Baixa | Não presumir direitos nem nomes | BACKLOG |
| M01-NUX03 | Nutricionista C | Relatório impresso | Muitos grupos de fonte podem alongar a célula | Hipótese a testar; não exercitada com 50 grupos | P3 | Teste visual com volume e quebra de página | Média | Limite de 50 grupos já existe | BACKLOG |
| M01-NUX04 | Nutricionista B/C | Zoom e foco | Zoom de 200% sem rolagem horizontal da página; detalhes operáveis por teclado | Verificado em browser, sem defeito | — | — | — | — | JÁ COBERTO |

APROVAR não foi usado: nenhuma mudança de produto é proposta para esta entrega. Os itens de backlog não ampliam o escopo.

## Decisões e continuidade

| IDs | Decisão humana e referência | Data | Tarefa/PR | Aceite e prova | Próxima revisão |
| --- | --- | --- | --- | --- | --- |
| M01-NUX01–03 | PENDENTE | — | Backlog FOOD06 | Resumo na linha com teste visual de volume | Etapa D da fase seguinte |
