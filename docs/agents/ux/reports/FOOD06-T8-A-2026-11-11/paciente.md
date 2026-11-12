# Parecer PUX (persona paciente) — FOOD06 T8, etapa A

> Texto da persona, preservado como entregue. Ela recebeu **somente o brief** (`brief.md`), não o documento da proposta. A frase
> "executada pelo agente principal em fallback" abaixo é da própria persona e está **imprecisa**: foram duas instâncias
> distintas do runtime com o papel fornecido como prompt (ver `manifesto.json`).

## Contexto e limitações
- Etapa: A (planejamento). Modalidade: somente plano. Avaliado: proposta escrita em `tasks/food06-m11-restricoes-contrato-proposta.md`, base `main` @ `d84b0f11`, conforme o brief. Não li o documento; trabalhei só com o resumo do brief.
- Persona fictícia, executada pelo agente principal em fallback (simulação, não subagente independente). Sem telas, sem teste visual, de teclado ou de leitor de tela, sem pessoas reais. Não é validação clínica, jurídica, de privacidade nem revisão R4.
- Passos e fricções abaixo são hipóteses ou estimativas, não medições.
- Considero as cinco perspectivas do papel separadamente: iniciante, baixa familiaridade tecnológica, usuário experiente, pouca familiaridade com termos nutricionais e consulta rápida (trabalho, compras, preparo).

## Pontos positivos
- Preferência nunca vira conflito, e "sem confirmação do profissional é rascunho". Isso evita que um "não gosto de coentro" vire alerta falso e que o paciente se canse de avisos.
- O texto nunca diz "seguro", e o padrão é `indeterminado`. Evita que o paciente entenda "sem aviso" como "liberado".
- Itens marcados em vez de escondidos: o paciente que consulta algo não fica sem entender por que um alimento sumiu.
- Sem semáforo e sem IA inferindo texto livre: menos ansiedade e menos erro de leitura.
- A natureza distingue alergia de escolha (religiosa, ética). No cenário 1, "não como carne por escolha" não é tratada como alergia.

## Dificuldades e riscos (visão do paciente)
1. A proposta quase não fala do paciente. O lado do paciente é "decisão aberta". O paciente é a fonte do dado e quem mais sente o erro, mas fica sem papel definido.
2. Várias palavras novas podem chegar a ele: "em reavaliação", "não informado", "sem restrições confirmadas", "pode conflitar", "indeterminado". Soam técnicas e podem assustar ou confundir. "Sem conflito registrado" também pode ser lido como "pode comer".
3. Se o paciente declara uma alergia e ela fica como rascunho até o profissional confirmar, ele pode achar que já foi registrada e protege. Sem retorno claro, isso cria falsa segurança.
4. Se o portal mostra "não informado" ou "restrições não avaliadas" e ele já contou na consulta, pode sentir que foi ignorado.

## Achados estruturados

**PUX-01 — Paciente declara restrição e não sabe se foi considerada**
- Cenário: 1 e 5. Objetivo: saber que a alergia a camarão e amendoim foi registrada e vale.
- Proposto: origem "declaração do paciente" e estado rascunho até a confirmação do profissional.
- Dificuldade: sem confirmação, o paciente não sabe se há proteção. Iniciante e baixa familiaridade tecnológica são os mais afetados.
- Tipo: risco plausível que exige teste. Evidência: hipótese, a partir do brief (o texto de status ao paciente não está definido).
- Impacto: falsa sensação de proteção, ou desconfiança no sistema.
- Sugestão: se o paciente vê as próprias restrições, mostrar um status simples e acolhedor, por exemplo "Você informou. Seu nutricionista ainda vai conferir" e, depois, "Conferido pelo seu nutricionista". Nunca mostrar "rascunho" ou "estado".
- Aceite: toda restrição declarada exibe um de dois estados em linguagem leve. Validar com 3 a 5 pessoas reais, em etapa posterior.
- Prioridade: P1.

**PUX-02 — Rótulos técnicos e lidos como "liberado"**
- Cenário: 4 e 5. Objetivo: entender o aviso sem jargão e sem ansiedade.
- Proposto: `pode_conflitar`, `indeterminado`, `sem_conflito_registrado`. O paciente não vê o julgamento de compatibilidade (bom), mas pode ver estados de avaliação.
- Tipo: hipótese de fricção. Evidência: hipótese lexical.
- Impacto: leitura de "sem conflito registrado" como "pode comer". Esse estado nunca deve aparecer ao paciente.
- Sugestão: no portal do paciente, usar só dois ou três textos familiares, sem rótulos de motor. Reservar o vocabulário do motor ao profissional. Registrar no brief de implementação que nenhum estado do motor vaza como rótulo ao paciente.
- Aceite: revisão do glossário de textos do portal sem nenhum nome de estado interno. Teste de compreensão com pessoas reais depois.
- Prioridade: P1 (por risco de leitura como liberação).

**PUX-03 — Paciente antigo com questionário "lactose" e "nenhuma" (cenário 3)**
- Dificuldade: respostas contraditórias, sem avaliação. O paciente respondeu algo e nada parece ter acontecido.
- Tipo: hipótese de fricção. Evidência: brief.
- Impacto: perda de confiança, ou "já disse isso antes".
- Sugestão: não importar sozinho como fato. Tratar como "informado por você em [questionário]" e pedir confirmação ao profissional. Se o paciente for avisado, usar convite curto: "Conferir suas restrições com seu nutricionista na próxima consulta". Evitar pergunta repetida e culpa pela contradição.
- Aceite: caso de contradição tem texto definido, sem acusar o paciente.
- Prioridade: P2.

**PUX-04 — Correção pelo paciente no portal (cenário 5)**
- Dificuldade: "quero corrigir". O caminho não está definido. Hipótese de dificuldade para baixa familiaridade tecnológica e para teclado e tecnologia assistiva.
- Tipo: sugestão de melhoria, risco plausível se a correção demorar sem aviso.
- Sugestão: edição em poucos passos (estimativa, não medida): ver, "Corrigir ou acrescentar", escolher em lista curada com busca por nome comum ("camarão", "frutos do mar") e confirmar. Aviso claro de que o nutricionista conferirá. Permitir também "falar com meu nutricionista" quando o termo não estiver na lista. Prever teclado, leitor de tela e contraste na implementação, sem alegar teste agora.
- Aceite: fluxo operável só por teclado e com nomes acessíveis, a verificar com teste real na etapa B ou C.
- Prioridade: P2.

**PUX-05 — Alimento não classificado (cenário 4) e consulta rápida**
- Dificuldade: durante a compra ou o trabalho, o paciente vê "indeterminado" ou "restrições não avaliadas" e não sabe o que fazer.
- Tipo: hipótese de fricção. Impacto: ansiedade ou decisão por conta própria.
- Sugestão: se isso aparecer ao paciente, usar texto neutro, curto e sem alarme: "Ainda não conferimos este item. Pergunte ao seu nutricionista". Não pedir que ele calcule nada nem decida sozinho.
- Aceite: texto aprovado, curto, sem jargão, legível em tela pequena e sem depender de cor.
- Prioridade: P2.

**PUX-06 — Troca de ingrediente vista pelo paciente (cenário 2, lado paciente)**
- Dificuldade: a nutricionista troca com exceção auditada. O paciente que recebe a receita nova não deve ver "conflito" ou "exceção" soltos, nem uma troca que esconda diferença de porção.
- Tipo: risco plausível. Evidência: o brief diz que o paciente não vê julgamento, o que é adequado.
- Sugestão: se a troca mudar a apresentação, o paciente deve ver uma nota curta do nutricionista na receita ("troca feita por [profissional]") e a quantidade claramente. Não expor motivos de exceção clínica sem autorização.
- Aceite: texto da troca sem termos de auditoria e com a quantidade visível.
- Prioridade: P3.

## Oportunidades
- Reaproveitar uma lista curada com nomes populares para busca do paciente.
- Uma frase fixa e reutilizável para "ainda não conferido pelo nutricionista", em vez de variar por tela.
- Opcional e proporcional: lembrete leve de revisão de restrições antes de consulta, sem culpa.

## Perguntas de produto realmente necessárias
1. O paciente vê as próprias restrições declaradas e o status de confirmação? Minha recomendação é sim, só com os dois estados em linguagem leve (PUX-01), sem julgamento de compatibilidade. Isso fica para decisão do proprietário.
2. O paciente pode propor correção pelo portal, ou só avisar o nutricionista? Decisão do proprietário. Eu priorizo ao menos o aviso.

## Conclusão proporcional
A proposta é cautelosa e coerente com a experiência do paciente. Minhas ressalvas estão no vocabulário, na falsa segurança por rascunho e no vazio de definição do lado do paciente. Nada aqui é P0. Os dois P1 (PUX-01 e PUX-02) pedem decisão sobre o que o paciente vê antes de implementar. Em etapas B e C, validar com pessoas reais, teclado e leitor de tela. Nada aqui substitui validação clínica da lista de alérgenos nem revisão de engenharia e segurança.
