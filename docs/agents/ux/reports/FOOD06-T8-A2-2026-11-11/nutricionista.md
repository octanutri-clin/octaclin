# Parecer NUX (nutricionista, persona fictícia): FOOD06 T8, etapa A, segunda rodada (contrato v2)

> Texto da persona, preservado como entregue. Ela recebeu **somente o brief** (`brief.md`), não o documento do contrato v2.

## Contexto e limitações
- Etapa: A (planejamento). Modalidade: **somente plano**, sobre o brief sintético. Versão avaliada: `main` em `d84b0f11`, documento `tasks/food06-m11-restricoes-contrato-v2.md`, conforme o brief. Não li o documento nem o relatório da v1.
- Não há tela, protótipo ou código. Não afirmo cliques medidos, teste visual, de teclado ou de leitor de tela. Estimativas de passos são hipóteses.
- Isto não é validação clínica, jurídica ou de privacidade. A lista de alérgenos, o mapeamento e as regras ainda não existem e precisam de validação humana clínica.
- Persona independente. Não vi o parecer da persona paciente. O portal é avaliado só pelo impacto no meu fluxo.
- Não reabro as decisões D1 a D11.

## Pontos positivos
- **Bloqueio sem "ignorar" na alergia com presença identificada.** Reduz o risco de clicar sem ler. Isso é mais claro do que a v1 e, no uso real, equivale a um freio que todos entendem.
- **A categoria define a reação.** Alergia bloqueia, intolerância avisa, escolha pede confirmação, preferência só sugere. Isso espelha como eu penso. Dispensa o "alerta para tudo".
- **Nunca "sem conflito" por falta de dado.** "Indeterminado" é honesto e evita falsa segurança.
- **Vencimento sem bloquear a edição, no contexto da prévia e sem perder trabalho.** Poupa tempo.
- **Prévia com "antes" e "depois" e o ingrediente exato.** Aponta o que mudou, que é o que eu preciso conferir.
- **"Não encontrei" com registro e pedido de curadoria.** Não perco a anamnese por causa de lacuna do catálogo.
- **Questionário antigo vira "sugestão histórica" promovida com um gesto**, e "nenhuma" nunca confirma ausência.
- **Aviso por paciente/sessão, não por linha.** Evita fadiga.
- **Lista individual mais agregado conservador.**

## Dificuldades e riscos operacionais
1. O bloqueio é correto, mas a saída (curadoria ou revisão formal) é lenta. No meio da consulta online, a nutricionista precisa de um desvio rápido que não seja "inativar a alergia".
2. Como nenhuma regra foi validada, quase toda troca em paciente com restrição cai em "indeterminado" e exige revisão explícita. Risco de clique automático, justamente o que se quer evitar.
3. Confirmação em lote, revisão de "indeterminado" e reconfirmação de 180 dias podem virar o mesmo botão genérico. Sem distinção, o hábito apaga a atenção.
4. A prévia recalculada pelo servidor no M12 pode descartar o trabalho se "algo mudou" e a tela só pedir "nova revisão" sem dizer o quê.

## Achados estruturados

### NUX-11 — Bloqueio com mapeamento sabidamente errado: saída lenta e risco de contornar inativando
- **Cenário 1.** Autônoma, alergia a crustáceos confirmada, troca mapeada como "contém crustáceos", mas ela sabe que o mapeamento está errado para aquele produto.
- **Objetivo:** aplicar a troca correta, sem desproteger o paciente.
- **Comportamento proposto:** bloqueio sem ignorar. Saídas: corrigir a curadoria, deixar o registro "em reavaliação" (continua valendo) ou inativar com motivo e autor.
- **Dificuldade:** a curadoria depende de terceiros e pode demorar. "Em reavaliação" não libera nada. Resta inativar o registro, que desprotege **todos** os outros itens do paciente para destravar um único produto.
- **Tipo:** risco plausível que exige teste, com componente de hipótese de fricção.
- **Evidência:** só o brief, que descreve três saídas e nenhuma permite aplicar este item agora.
- **Impacto:** a profissional escolhe entre abandonar a troca, esperar ou enfraquecer a proteção do paciente.
- **Sugestão:**
  - No bloqueio, a ação principal é "Solicitar correção de classificação". Um gesto, com produto, ingrediente e motivo já preenchidos, e status visível do pedido.
  - Oferecer "escolher outro item" sem sair da prévia.
  - "Inativar" fica separado, com aviso explícito de que vale para todos os itens e confirmação reforçada. Nunca é apresentado como saída do bloqueio.
  - Permitir salvar o trabalho como pendente, sem aplicar.
- **Aceite verificável:**
  - O bloqueio exibe, na mesma tela, o pedido de curadoria e as alternativas.
  - Inativar exibe os efeitos sobre os demais itens.
  - Cada saída é testada com sintético: o item continua bloqueado após "em reavaliação" e o pedido de curadoria fica registrado.
- **Prioridade:** P1.

### NUX-12 — Avaliação vencida em receita com vários ingredientes: reconfirmação repetida
- **Cenário 2.** Clínica, "sem restrições" confirmado há 200 dias por outra profissional, troca num ingrediente de uma receita com vários.
- **Comportamento proposto:** some o "sem conflito"; aparece pedido de reconfirmar na troca/prévia, sem perder o trabalho.
- **Dificuldade:** o pedido pode repetir a cada troca. Não está claro quem pode reconfirmar quando outra colega fez a confirmação original.
- **Tipo:** hipótese de fricção.
- **Impacto:** reconfirmar "sem restrições" sem perguntar ao paciente vira rotina automática, o que torna o prazo inútil.
- **Sugestão:**
  - Um aviso por paciente/sessão. Reconfirmar em um gesto dentro da prévia, mostrando quem confirmou e há quantos dias.
  - Se ela não reconfirmar, aplicar segue permitido, com marca "avaliação vencida" no plano.
  - A reconfirmação deve registrar que perguntou ao paciente (resposta curta), não apenas um clique.
  - Concordo com a proposta do coordenador: restrição **já confirmada nunca vence por prazo**. Sugiro que ela apareça visualmente distinta do "sem restrições" vencido.
- **Aceite verificável:**
  - Em sessão com 3 trocas na mesma receita, o pedido aparece uma vez.
  - Restrição confirmada há mais de 180 dias continua ativa e sem pedido de reconfirmação.
  - Edição do plano nunca é bloqueada.
- **Prioridade:** P2.

### NUX-13 — Primeira consulta: registrar três itens de categorias diferentes de uma vez
- **Cenário 3.** "Alergia a camarão e amendoim" e "não como carne por escolha religiosa".
- **Dificuldade:** são três registros, em duas categorias (alergia e escolha) e com alvos de níveis diferentes: espécie, alérgeno, grupo ("carne"). Um formulário por item, com categoria, alvo, gravidade e presença obrigatórios, consumiria o tempo da anamnese.
- **Tipo:** hipótese de fricção.
- **Sugestão:**
  - Entrada rápida de vários itens (texto livre com sugestões de alvo) numa lista editável.
  - Categoria escolhida por item, sem valor padrão que pareça confirmação.
  - Campos secundários (gravidade, observação) opcionais no registro inicial.
  - "Não encontrei" nunca impede salvar.
  - Estimativa (hipótese): 3 itens em um fluxo contínuo, sem voltar à lista.
- **Aceite verificável:** registrar os três itens sem abandonar a tela, com alvo não encontrado salvo mesmo assim e categorias exibidas individualmente.
- **Prioridade:** P2.

### NUX-14 — Confirmação em lote do registro feito pelo administrativo
- **Cenário 4.** O administrativo registra por telefone. A nutricionista confirma em lote.
- **Dificuldade:** o lote é permitido, mas o risco é "confirmar todos" sem ler. Itens com categoria ambígua (alergia ou intolerância?) ou alvo não encontrado não deveriam passar juntos com os claros.
- **Tipo:** risco plausível que exige teste.
- **Sugestão:**
  - Cada linha mostra o texto original declarado, quem registrou e quando, e a categoria proposta.
  - Itens ambíguos ou sem alvo ficam fora da seleção padrão.
  - A confirmação em lote exige ação expressa e o resumo diz quantos itens, de que categorias.
  - Prever correção após confirmar, com histórico.
- **Aceite verificável:**
  - Em lote sintético de 10 pendências com 2 ambíguas e 1 sem alvo, esses 3 não entram na seleção padrão.
  - O administrativo não consegue confirmar, nem por lote.
- **Prioridade:** P2.

### NUX-15 — Paciente antigo: "lactose" histórica e "nenhuma" nunca avaliado
- **Cenário 5.**
- **Comportamento proposto:** sugestão histórica a revisar e promoção com um gesto, corrigindo a categoria.
- **Dificuldade:** "lactose" pode ser alergia à proteína do leite, intolerância à lactose ou preferência. Se a promoção sugerir "alergia" por padrão, o plano passa a bloquear itens indevidamente. A tela precisa deixar claro que o paciente está **não avaliado**, e não sem restrições.
- **Tipo:** risco plausível que exige teste.
- **Sugestão:**
  - Sem categoria padrão na promoção.
  - Botões "Promover" e "Descartar", com rastro do descarte.
  - Resposta "nenhuma" mostrada como informação histórica e nunca como estado.
  - O estado "paciente não avaliado" visível na entrada do plano, distinto de "alimento não classificado".
- **Aceite verificável:** promover exige escolher a categoria; "nenhuma" nunca gera avaliação; paciente nunca avaliado exibe "não avaliado" em todas as telas de troca.
- **Prioridade:** P1 (jornada de segurança essencial).

### NUX-16 — Portal: pedidos de correção e remoção chegam como carga para mim
- **Cenário 6.** O paciente, no celular, vê "Você informou; ainda será conferido" e quer pedir correção. Do meu lado, a pendência chega ao profissional.
- **Dificuldade:** o estado "Correção solicitada" é ambíguo (quem solicitou, o paciente ou o profissional?). Uma proposta de **remoção** de alergia confirmada pode ser lida pelo paciente como "já removida". Sem prazo, "ainda será conferido" pode virar espera indefinida. Pendências do portal podem se acumular.
- **Tipo:** risco plausível que exige teste.
- **Sugestão:**
  - Texto que diga que o registro confirmado continua valendo até o profissional decidir.
  - "Correção solicitada" reformulado para deixar claro que foi o paciente quem pediu.
  - Aviso de que o portal não é canal de urgência, sem prometer prazo de resposta.
  - No meu lado, pendências do portal agrupadas por paciente, com propostas de remoção priorizadas. O profissional vê o texto do paciente e o registro atual lado a lado e resolve em um gesto.
- **Aceite verificável:**
  - Propor remoção não altera o registro confirmado.
  - O aviso ao profissional só aparece para pendências novas, uma vez por paciente.
  - A resolução registra o autor.
  - A avaliação do texto em si fica para a persona paciente.
- **Prioridade:** P2.

### NUX-17 — Ingrediente industrial sem composição: revisão repetida por ingrediente
- **Cenário 7.**
- **Comportamento proposto:** resultado "indeterminado", aplicar exige revisão explícita.
- **Dificuldade:** em receita com vários ingredientes industriais, revisão por ingrediente multiplica passos. Cada receita nova repete a mesma dúvida sobre o mesmo produto.
- **Tipo:** hipótese de fricção.
- **Sugestão:**
  - Uma revisão agrupada por receita, com decisão registrada por ingrediente.
  - Atalho para anexar a composição lida no rótulo (foto ou texto), reaproveitada nas receitas seguintes e sujeita a curadoria.
  - A decisão de revisar nunca vira "sem conflito" permanente.
- **Aceite verificável:**
  - Receita com 4 ingredientes indeterminados pede uma revisão consolidada.
  - A composição informada uma vez reaparece na próxima receita, marcada como "informada pelo profissional, não validada".
- **Prioridade:** P2.

### NUX-18 — Fadiga de revisão na fase sem regras validadas
- **Cenário:** toda a base de pacientes com restrição, em qualquer cenário.
- **Dificuldade:** com nenhuma regra validada, "indeterminado" será o resultado mais comum. Se quase toda ação exige revisão explícita, ela vira clique automático. O bloqueio real (NUX-11) ficaria diluído entre muitos pedidos iguais.
- **Tipo:** risco plausível que exige teste.
- **Sugestão:**
  - Diferenciar visual e textualmente "bloqueado", "revisar" e "reconfirmar", com a mesma gravidade para a mesma situação.
  - Revisão uma vez por alvo por sessão, com resumo no fim. Sem repetir a cada troca.
  - Medir, no piloto, a proporção de revisões e o tempo médio (para detectar clique automático).
- **Aceite verificável:** num plano sintético com 15 trocas, revisões repetidas do mesmo alvo ocorrem uma vez; os três estados têm rótulos e formas distintos.
- **Prioridade:** P1 (hipótese, depende de teste de interação).

### NUX-19 — Alvo não encontrado: o registro pode dar falsa sensação de proteção
- **Dificuldade:** "este registro ainda não gera alerta automático confiável" aparece no registro, mas a nutricionista só o vê na tela de restrições. No plano, ela pode assumir que o sistema vigia.
- **Tipo:** risco plausível que exige teste.
- **Sugestão:**
  - O mesmo selo aparece também no cabeçalho do plano, na consulta de alimentos e na prévia de troca.
  - Lista de "registros sem alerta automático" visível e com status do pedido de curadoria.
- **Aceite verificável:** paciente sintético com registro sem alvo exibe o selo nas três telas e continua distinguindo "alimento não classificado" de "paciente não avaliado".
- **Prioridade:** P1.

### NUX-20 — Agregado de vários alvos e prévia que "reaparece" ao aplicar
- **Dificuldade:** o agregado conservador pode ficar sempre alarmante e esconder o item concreto. Se algo mudar entre prévia e aplicar (M12), perder a edição seria uma perda de trabalho.
- **Tipo:** hipótese de fricção.
- **Sugestão:**
  - Lista individual primeiro, agregado como resumo.
  - Se o servidor recalcular e achar diferença, mostrar o que mudou e preservar o rascunho.
- **Aceite verificável:** a nova revisão mostra o diff em relação à prévia e mantém as edições.
- **Prioridade:** P2.

## Oportunidades de produtividade
- Pedido de curadoria em um gesto, com contexto pré-preenchido.
- Revisão agrupada por receita e composição reutilizável.
- Resumo de reconfirmação com um aviso por sessão.
- Entrada múltipla na primeira consulta.
- Fila de pendências (portal, administrativo, questionário antigo) unificada, ordenada por gravidade.

## Perguntas de produto necessárias
1. Quem faz a curadoria e com qual prazo esperado? Para a autônoma, sem equipe, o bloqueio só é viável se houver resposta rápida. A decisão afeta NUX-11.
2. A reconfirmação de 180 dias exige registrar que o paciente foi perguntado, ou basta o clique? (NUX-12)

## Conclusão
A v2 resolve bem o desenho conceitual: bloqueio claro, categorias com reações distintas e honestidade sobre incerteza. O que mais me preocupa na prática não é o bloqueio, mas **o caminho de saída dele** (NUX-11) e a **fadiga de revisões** enquanto não houver regra validada (NUX-18). Ambos precisam ser testados em protótipo antes do fechamento. Prioridades: P1 em NUX-11, NUX-15, NUX-18 e NUX-19; P2 nos demais. Não há achado P0. Tudo isso fica como sugestão para decisão do proprietário. Engenharia mantém autorização, RLS, LGPD, TDD e segurança.
