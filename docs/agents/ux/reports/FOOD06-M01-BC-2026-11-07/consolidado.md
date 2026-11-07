# FOOD06-M01 — UX/produto, etapas B e C (consolidado)

## Contexto e execução

- Escopo/versão: origem por nutriente (aditivo). Base `137aa547`; commits locais desta branch. Hash do brief não calculado.
- **Etapa A não foi executada antes da implementação.** Lacuna de processo do agente principal, registrada aqui. Esta revisão não a substitui nem a recompõe retroativamente.
- Modalidade: B e C iniciais foram **fallback sequencial, simulações do agente principal, não independentes**. Depois, a etapa C foi repetida com **um subagente de runtime com o papel fornecido e sem ferramentas** (ver `nutricionista-subagente.md`). Persona única (nutricionista); paciente N/A. IDs de instância não preservados. Isto não é R4 independente nem pesquisa com pessoas.
- Evidência: código lido; interface real executada pelo agente em Chromium (desktop e mobile) com respostas sintéticas simuladas; screenshots do bloco de detalhes e da prévia do relatório inspecionados; axe sem violações nas áreas alteradas.
- Paciente: **N/A.** O incremento só altera o console profissional e a prévia do relatório profissional. Não muda conteúdo, visibilidade, notificação ou documento do portal, e o relatório não é enviado ao paciente.
- Limitações: a etapa A segue não executada; sem pessoas reais; não é validação clínica nem científica; sem tecnologia assistiva humana; PDF real não executado neste relatório.

## Nutricionista — parecer (simulação sequencial)

Positivo: o zero conhecido de cálcio aparece como "0 mg" com origem, o que evita ler ausência como zero. O texto "Origem do registro de composição do alimento. Não comprova que a base mediu este nutriente" delimita o que a origem significa. Selênio sem valor diz "Nenhum alimento com valor conhecido… não há origem a informar", sem inventar fonte.

Dificuldades: a origem fica dentro de "Detalhes", exigindo um clique por nutriente; para auditar vários nutrientes isso é lento. Códigos de fonte desconhecidos aparecem como "código x", técnico para a rotina de atendimento.

## Achados

| ID | Origem | Funcionalidade | Problema | Evidência/hipótese/tipo | Prioridade | Solução | Complexidade | Arquitetura/segurança | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M01-NUX01 | Nutricionista B/C | Detalhes da tabela | Origem só após expandir, um nutriente por vez | Hipótese de fricção; fluxo exercitado em browser | P2 | Resumo de origem na própria linha, sem expandir | Baixa | Só apresentação; mesmos dados | BACKLOG (muda a densidade da tabela, decisão de produto) |
| M01-NUX02 | Nutricionista B/C | Rótulos de fonte | Código desconhecido exibido como "código x" | Sugestão de melhoria | P3 | Catálogo de rótulos mantido pelo produto | Baixa | Não presumir direitos nem nomes | BACKLOG |
| M01-NUX03 | Nutricionista C | Relatório impresso | Muitos grupos de fonte podem alongar a célula | Hipótese a testar; não exercitada com 50 grupos | P3 | Teste visual com volume e quebra de página | Média | Limite de 50 grupos já existe | BACKLOG (layout); o volume de 50 grupos foi testado em M01-NUX12 |
| M01-NUX04 | Nutricionista B/C | Zoom e foco | Zoom de 200% sem rolagem horizontal da página; detalhes operáveis por teclado | Verificado em browser, sem defeito | — | — | — | — | JÁ COBERTO |
| M01-NUX09 | Subagente C (NUX04 do subagente) | Origem manual | Manual misturada às bases, sem destaque | Hipótese de fricção | P2 | Rótulo textual "entrada manual" e ordem | Baixa | Só apresentação | BACKLOG (decisão do proprietário) |
| M01-NUX10 | Subagente C (NUX05) | Linha da tabela | Sem sinal de exceção na linha; mesmo núcleo do NUX01 | Sugestão de melhoria | P2 | Indicador textual só nas exceções | Baixa | Só apresentação | AVALIAR (decisão do proprietário; NUX01 permanece BACKLOG) |
| M01-NUX11 | Subagente C (NUX06) | Relatório formato 2 | Origem ausente do servidor sem aviso | Risco plausível | P1 | Texto "Origem por nutriente não disponibilizada neste relatório." | Baixa | Sem coluna vazia | JÁ COBERTO (teste de navegador) |
| M01-NUX12 | Subagente C (NUX07) | Relatório com 50 grupos | PDF com 50 grupos não testado | Risco plausível | P1 | Teste de volume com PDF real | Média | Limite de 50 já existe | JÁ COBERTO (navegador desktop e mobile, PDF real) |
| M01-NUX13 | Subagente C (NUX08) | Limitação | Aviso em letra menor, depois da informação | Hipótese de fricção | P3 | Contraste e tamanho de corpo | Baixa | Só apresentação | BACKLOG |

APROVAR não foi usado: nenhuma mudança de produto é proposta para esta entrega. Os itens de backlog não ampliam o escopo.

## Decisões e continuidade

| IDs | Decisão humana e referência | Data | Tarefa/PR | Aceite e prova | Próxima revisão |
| --- | --- | --- | --- | --- | --- |
| M01-NUX01–03, 09, 10, 13 | PENDENTE | — | Backlog FOOD06 | Resumo na linha com teste visual de volume | Etapa D da fase seguinte |
