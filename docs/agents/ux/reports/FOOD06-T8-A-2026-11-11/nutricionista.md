# Parecer NUX (persona nutricionista fictícia) — FOOD06 T8, etapa A

> Texto da persona, preservado como entregue. Ela recebeu **somente o brief** (`brief.md`), não o documento da proposta.

## 1. Contexto e limitações
- Etapa: A (planejamento). Base `main` em `d84b0f11`. Documento citado: `tasks/food06-m11-restricoes-contrato-proposta.md`.
- Entrada recebida: somente o brief sintético. Não li o documento em si.
- Modalidade: **somente plano**. Não há tela, protótipo nem interação. Contagens de passos abaixo são **estimativas** e não medições. Não alego teste visual, de teclado ou de leitor de tela.
- Sou persona fictícia. Este parecer não é validação clínica, jurídica ou de privacidade, nem revisão R4. A lista de alérgenos e as regras de conflito precisam de validação humana clínica.
- Avaliação independente. Não vi o parecer da persona paciente. Paciente é tratado só no cenário 5, como ponto de atenção para a nutricionista, não como avaliação da experiência do paciente.

## 2. Pontos positivos
- **Rascunho sem confirmação não gera conflito.** Isso protege a nutricionista de alertas baseados em autodeclaração solta. Ela mantém o controle clínico.
- **Três situações de avaliação**, com `nao_informado` como padrão e `sem_restricoes_confirmadas` com validade. Evita o falso "nenhuma restrição" que fica no prontuário para sempre.
- **Quatro resultados por alimento, com `indeterminado` como padrão.** Evita falsa segurança. Gostei de o texto nunca dizer "seguro".
- **Marcar em vez de esconder.** Respeita a autonomia: a nutricionista pode usar um item marcado de propósito, por exemplo uma tolerância individual.
- **Preferência nunca vira conflito.** Evita ruído e fadiga de alerta.
- **Separar natureza clínica, escolha e preferência.** Reflete a prática: alergia e "não como carne por escolha" são coisas diferentes.
- **Conflitos do "depois" ao lado do "antes"** na troca com prévia. Encaixa no fluxo de troca já existente.
- **Sem IA, sem texto livre, sem semáforo.** Escopo contido.

## 3. Principais dificuldades e riscos operacionais (resumo)
1. **Custo de entrada na primeira consulta.** Cada restrição tem muitos campos: natureza, alvo, gravidade, estado, origem e confirmação. Com cinco restrições em consulta de 40 minutos, isso pode virar um formulário pesado.
2. **Alvo só por lista curada.** Se o catálogo não tem "camarão" ou "crustáceos", ou o paciente cita algo fora da lista, a nutricionista fica sem como registrar. Isso empurra para texto livre fora do sistema, o que anula o contrato.
3. **Alerta que não cobre o caso real.** O sistema pode dizer `sem_conflito_registrado` em um alimento com traço, contaminação cruzada ou ingrediente composto mal mapeado. O texto cuidadoso ajuda, mas a confiança no selo vem do mapeamento curado.
4. **Fadiga e dependência do aviso "restrições não avaliadas".** Se aparecer em toda consulta de alimentos para a base antiga inteira, vira ruído e é ignorado.
5. **Exceção auditada em toda aplicação.** É segura, mas pode atrapalhar. Sem atalho seguro, a nutricionista trava no meio do plano.

## 4. Achados estruturados

**NUX-01 — Entrada de restrições na primeira consulta (hipótese de fricção) — P1**
- Cenário: autônomo, primeira consulta; o paciente diz "alergia a camarão e a amendoim" e "não como carne por escolha".
- Objetivo: registrar as três restrições e confirmar sem perder o ritmo da conversa.
- Proposto: registro por restrição com natureza, alvo, gravidade, estado, origem e confirmação.
- Dificuldade: estimo (hipótese, não medida) de 4 a 6 campos por restrição, possivelmente 15 a 20 decisões para este paciente. Gravidade e origem não devem pedir decisão em cada linha quando o padrão é óbvio.
- Tipo: hipótese de fricção. Evidência: só o plano.
- Impacto: a nutricionista tende a pular o registro estruturado ou deixar tudo em rascunho, e o sistema perde valor.
- Sugestão: padrões inteligentes (origem = profissional quando ela digita, estado = ativa, gravidade = "não informada" sem bloqueio). Entrada rápida com busca por nome e confirmação em lote ("confirmar todas") com revisão visível. Natureza sugerida pelo tipo de alvo, mas editável.
- Aceite verificável: em protótipo, registrar e confirmar as três restrições do cenário sem preencher campo opcional e sem sair da consulta. A medição real fica para a etapa B.

**NUX-02 — Alvo fora da lista curada (risco plausível que exige teste) — P1**
- Cenário: 1 e 4. Paciente cita "camarão"; o catálogo tem só "crustáceos" ou não tem. Também, alimento do catálogo ainda não classificado.
- Proposto: alvo apenas por ID de lista curada.
- Dificuldade: o sistema não diz o que fazer quando não acha o alvo. A tentação é anotar em observação livre, que não gera nenhum alerta.
- Tipo: risco plausível que exige teste. Evidência: só o plano.
- Impacto: alergia real registrada fora do contrato, sem proteção, e com a sensação de que está registrada.
- Sugestão: grupo mais próximo como alvo ("crustáceos" cobre camarão). Se não houver, caminho explícito "não encontrei", que cria pendência visível de curadoria. Ele deve avisar claramente que esse registro ainda não gera alerta automático. Idem para alimento não classificado: `indeterminado` com texto próprio, "alimento ainda não classificado quanto a alérgenos", diferente de "avaliação ausente".
- Aceite: com alvo fora da lista, a tela mostra o aviso de que não há alerta automático. Para alimento não classificado, o texto é distinto do aviso de avaliação ausente.

**NUX-03 — Aviso "restrições não avaliadas" e a base legada (risco plausível que exige teste) — P1**
- Cenário: 3. Paciente antigo respondeu "lactose" e "nenhuma" e nunca teve avaliação.
- Proposto: `nao_informado` por padrão; o questionário não gera conflito sem confirmação.
- Dificuldade: a nutricionista vê o aviso em toda busca de alimentos. Se a resposta "lactose" do questionário ficar escondida, ela pode ignorá-la, ou ter de reabrir o questionário para lembrar.
- Tipo: risco plausível que exige teste. Evidência: só o plano.
- Impacto: dois extremos ruins, ruído constante (ignora o aviso) ou perda de informação útil (não vê "lactose").
- Sugestão: mostrar a resposta antiga como **sugestão a confirmar**, com "transformar em restrição" em um gesto, sem gerar conflito até a confirmação. Aviso no contexto do paciente (uma faixa discreta, uma vez por sessão ou fixa no cabeçalho), não repetido a cada busca. A resposta "nenhuma" nunca deve virar `sem_restricoes_confirmadas` automático.
- Aceite: com paciente legado, a resposta "lactose" é visível e promovível em um gesto. "nenhuma" não altera a situação. O aviso não repete a cada consulta de alimento na mesma sessão.

**NUX-04 — Validade vencida durante uma troca (risco plausível que exige teste) — P1**
- Cenário: 2. Equipe de clínica; `sem_restricoes_confirmadas` vencida há dois meses; a nutricionista troca um ingrediente.
- Proposto: vencida volta a `nao_informado`; a troca mostra conflitos "depois", mas o resultado fica `indeterminado`.
- Dificuldade: ela está no meio da troca e é obrigada a reavaliar o paciente, ou segue e ignora. Em clínica, quem fez a confirmação original pode ser outra profissional. Não está claro quem pode reconfirmar.
- Tipo: risco plausível que exige teste. Evidência: só o plano.
- Impacto: ou bloqueia o fluxo, ou se aprende a ignorar o aviso.
- Sugestão: não bloquear a troca. Aviso proporcional com ação "reconfirmar agora" na própria tela da prévia, em um gesto, após ela conferir com o paciente. Mostrar data e autor da última confirmação. Definir o prazo de validade com o proprietário e a validação clínica; não sugiro um número. Verificar se qualquer profissional com acesso ao paciente pode reconfirmar.
- Aceite: na prévia, com avaliação vencida, aparece a data/autor da última confirmação e há ação de reconfirmar sem sair da troca. A troca continua possível.

**NUX-05 — Exceção auditada ao aplicar item conflitante (risco plausível que exige teste) — P1**
- Cenário: nutricionista aplica ao plano um item que conflita com restrição clínica confirmada (por exemplo, o paciente tem tolerância a traços e ela sabe disso).
- Proposto (recomendação, a decidir): exceção auditada com motivo do profissional.
- Dificuldade: concordo que exige confirmação. Mas o custo pode ser alto se for um diálogo com motivo digitado a cada item, sobretudo ao aplicar um plano com vários itens do mesmo alérgeno.
- Tipo: risco plausível que exige teste. Evidência: só o plano.
- Impacto: fricção forte, ou motivos genéricos ("ok") que esvaziam a auditoria.
- Sugestão: manter a exceção (não abro mão). Motivos pré-definidos mais campo livre opcional. Exceção reutilizável por paciente e alérgeno, visível e revogável, em vez de repetida item a item. Para natureza "escolha" (religiosa/ética) ou gravidade leve, apenas confirmação simples, sem motivo digitado. Decisão sobre o que exige motivo é do proprietário com validação clínica.
- Aceite: aplicar três itens do mesmo alérgeno exige um único motivo. A exceção aparece no histórico do plano.

**NUX-06 — Vocabulário do selo `sem_conflito_registrado` (risco plausível que exige teste) — P2**
- Proposto: o texto nunca diz "seguro".
- Dificuldade: "sem conflito registrado" pode ser lido como "pode usar". Traços, contaminação cruzada e ingrediente composto não estão cobertos.
- Tipo: risco plausível que exige teste.
- Impacto: falsa confiança em um sistema que a nutricionista passa a tratar como validador.
- Sugestão: texto que diga o que foi verificado, por exemplo "sem alérgeno mapeado para as restrições confirmadas deste paciente", mais indicação de que a avaliação clínica continua sendo dela. Teste de leitura com nutricionistas reais na etapa B.
- Aceite: texto aprovado em revisão com profissionais reais; nunca "seguro", "liberado" ou ícone verde.

**NUX-07 — Registro e correção de restrições do paciente no portal (hipótese de fricção) — P2**
- Cenário: 5. Paciente vê o que declarou e quer corrigir.
- Dificuldade: a correção do paciente vira o quê? Sobrescreve uma restrição confirmada? Fica como rascunho para ela revisar? O brief diz que ver as próprias restrições é decisão aberta.
- Tipo: hipótese de fricção. Evidência: só o plano.
- Impacto: risco de o paciente alterar silenciosamente uma restrição clínica confirmada, ou de a nutricionista não notar a mudança.
- Sugestão: correção do paciente entra como rascunho com origem "declaração do paciente", sem alterar a restrição confirmada. A nutricionista recebe notificação de pendência no painel. Ela confirma, rejeita ou ajusta. Para o paciente, uma mensagem clara de que a mudança aguarda revisão. Se o paciente puder ver, mostrar só as próprias declarações, sem julgamento de compatibilidade. A opinião sobre a experiência do paciente é da outra persona.
- Aceite: uma correção do paciente nunca remove nem altera conflito confirmado sem ação da nutricionista. Aparece na fila de pendências dela.

**NUX-08 — Reavaliação periódica e restrições em reavaliação (sugestão de melhoria) — P2**
- Dificuldade: o estado "em reavaliação" existe. Não está claro se ele ainda gera conflito, e como a nutricionista é lembrada da reavaliação (por exemplo, intolerância que melhora, alergia infantil que remite).
- Sugestão: "em reavaliação" mantém o conflito ativo por padrão e mostra seu estado na marcação. Lembrete opcional ligado a retorno, não um alerta separado.
- Aceite: item com restrição em reavaliação aparece marcado com esse estado, não como inativo.

**NUX-09 — Troca em lote e receitas (hipótese de fricção) — P2**
- Dificuldade: em receita com muitos ingredientes, o conflito do "depois" deve apontar qual ingrediente causa o problema, não só o prato. Quantidade de preparo e quantidade consumida têm papel diferente: o conflito é qualitativo, não depende de porção, e o texto não deve sugerir que dose pequena é aceitável.
- Sugestão: marcação no nível do ingrediente, com origem do conflito (qual alérgeno, qual restrição) em uma linha curta.
- Aceite: a prévia de troca de uma receita mostra qual ingrediente e qual restrição geram o conflito.

**NUX-10 — Escolha ética/religiosa e preferência (sugestão de melhoria) — P3**
- Em "não como carne por escolha", a gravidade (leve a grave) não faz sentido. Gravidade só para natureza clínica. Evita campo sem sentido no formulário e reduz o NUX-01.

## 5. Oportunidades de produtividade (estimativas, não medições)
- Entrada rápida por busca e padrões, com confirmação em lote, na primeira consulta.
- Promover em um gesto a resposta do questionário a restrição.
- Reconfirmação na própria prévia da troca.
- Exceção reutilizável por paciente e alérgeno.
- Faixa única de contexto por paciente em vez de aviso a cada busca.
- Fila de curadoria para alvo e alimento não encontrados, com retorno visível à nutricionista.

## 6. Perguntas de produto realmente necessárias
1. Qual profissional pode confirmar e reconfirmar a avaliação em clínica (quem confirma vale para toda a equipe)?
2. A exceção auditada vale por item ou por paciente e alérgeno? A recomendação "a decidir" muda muito o custo diário.
3. Alvo ou alimento não classificados: o sistema só avisa, ou impede a exceção/registro até a curadoria? Recomendo só avisar.

## 7. Conclusão proporcional
A proposta é prudente e, na minha leitura como persona, protege bem contra falsa segurança. O ponto forte é `indeterminado` como padrão. Os riscos principais não são de conceito, mas de **atrito** (NUX-01, NUX-05) e de **lacunas silenciosas** (NUX-02, NUX-03, NUX-04). Recomendo seguir para a etapa B com esses pontos como critérios de teste real, sem mudar o escopo. A lista de alérgenos, o prazo de validade, as regras de conflito e o que exige motivo na exceção são decisões do proprietário com validação clínica humana, que este parecer não substitui. Paciente: tratado apenas em NUX-07; a avaliação da experiência do paciente cabe à outra persona. Não houve P0, pois não há evidência concreta de risco grave, e a execução independente é desta persona sobre o brief, sem ferramentas.
