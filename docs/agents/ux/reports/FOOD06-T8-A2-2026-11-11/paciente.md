# Parecer PUX (persona paciente) — FOOD06 T8, etapa A, 2ª rodada (contrato v2)

> Texto da persona, preservado como entregue. Ela recebeu **somente o brief** (`brief.md`), não o documento do contrato v2. A frase
> "simulação por um único agente, sem independência de outra persona" abaixo é da própria persona; a modalidade real consta no `manifesto.json`.

## Contexto e limitações
- Etapa: A (planejamento). Modalidade: **somente plano**, avaliando a proposta escrita `tasks/food06-m11-restricoes-contrato-v2.md` conforme o brief (base `main` em `d84b0f11`). Nenhuma tela, protótipo ou código foi visto.
- Execução: simulação por um único agente, sem independência de outra persona. Sem teste visual, de teclado ou de leitor de tela, e sem pessoas reais. Não é validação clínica, jurídica ou de privacidade. Passos e fricções são hipóteses.
- Foco: o portal do paciente (cenários 5, 6 e parte do 3) e o impacto de "ser impedido de aplicar" sobre o que chega ao paciente. Os achados numeram-se a partir de PUX-11. Não reabro as decisões D1 a D11.
- Perfis considerados separadamente: iniciante; baixa familiaridade tecnológica; usuário experiente; pouca familiaridade com termos nutricionais; consulta rápida no celular (trabalho, compras, preparo); teclado e tecnologia assistiva. Para este último, só há sugestões, sem prova de uso.

## Pontos positivos
1. Os três estados do portal em linguagem simples ("Você informou; ainda será conferido", "Revisado pelo seu nutricionista", "Correção solicitada") dizem quem fez o quê e o que vem depois. Isso reduz a incerteza de quem informou uma alergia e não sabe se alguém viu.
2. Ocultar do paciente os estados internos ("indeterminado", "pode conflitar", "sem conflito registrado") evita ansiedade e falsas garantias. É a distinção correta entre transparência e sobrecarga.
3. Propor correção sem sobrescrever o registro confirmado dá autonomia ao paciente sem arriscar o dado clínico. O aviso ao profissional fecha o ciclo.
4. A resposta "nenhuma" do questionário antigo não confirma ausência de restrição. Isso protege o paciente do cenário 5, mesmo que ele nunca perceba.
5. O bloqueio firme do plano em alergia confirmada com presença identificada é, para o paciente, o resultado mais seguro. Ele não precisa fazer nada para se beneficiar dele.
6. As respostas antigas não migram como fato e viram "sugestão histórica a revisar". O paciente não é tratado como alguém que "já informou tudo".

## Dificuldades e riscos (visão do paciente)
- O portal mostra o que o paciente declarou. Falta definir o que ele vê quando o item foi **registrado pelo profissional** ou pelo colaborador administrativo, e quando o profissional **rejeita** ou **altera** a declaração. Os três estados não cobrem "não foi aceito" nem "foi ajustado".
- "Correção solicitada" é ambíguo. Pode ser lido como "eu solicitei" ou como "o nutricionista me pediu uma correção".
- Se uma restrição confirmada tem alvo "não encontrado" ou "não gera alerta automático confiável", o paciente pode supor que está coberto. O texto do portal não deve sugerir proteção automática.
- O bloqueio de aplicar é invisível ao paciente. Ele pode receber um plano atrasado ou um contato do profissional sem entender o motivo.
- A "sugestão histórica" de lactose pode chegar ao paciente com tom de acusação ou de dado esquecido, ou não chegar a ele (cenário 5).

## Achados estruturados

**PUX-11**
- Cenário: paciente no celular (cenário 6) vê "Você informou; ainda será conferido" para a alergia que declarou e quer pedir uma correção.
- Objetivo: corrigir o item sem ligar para a clínica.
- Proposta: o paciente pode "propor" correção, e isso gera pendência e aviso ao profissional.
- Dificuldade: não está dito onde fica a ação, quanto texto ou quais campos ela exige, nem se há confirmação de envio. Um paciente com baixa familiaridade tecnológica pode achar que corrigiu o registro. Outro pode achar que a tela está travada.
- Tipo: hipótese de fricção.
- Evidência: só o texto do brief, sem tela.
- Impacto: pedido duplicado, abandono ou falsa sensação de correção feita.
- Sugestão: botão único, com rótulo de verbo ("Pedir correção"). Depois do envio, uma tela de confirmação que diga "Pedido enviado ao seu nutricionista. O registro atual continua valendo até ele conferir." O item passa ao estado "Correção solicitada".
- Aceite: com protótipo, em teste do fluxo com roteiro sintético, o paciente enuncia sem ajuda o que acontece com o registro depois do envio.
- Prioridade: P2.

**PUX-12**
- Cenário: o paciente tem uma pendência "Correção solicitada" e o profissional a recusa, ou a aceita com ajuste.
- Objetivo: saber o resultado do pedido.
- Proposta: três estados, nenhum para "não acatado" ou "ajustado".
- Dificuldade: o item pode ficar em "Correção solicitada" indefinidamente, ou voltar a "Revisado" sem explicação.
- Tipo: risco plausível que exige teste.
- Impacto: ansiedade e dúvida sobre a segurança do próprio plano.
- Sugestão: um estado ou mensagem curta para o desfecho, em tom neutro: "Seu nutricionista conferiu e manteve o registro" ou "...atualizou o registro". Se houver um motivo, ele deve ser dito de forma breve e sem termos técnicos. Também mostrar a data da última atualização.
- Aceite: todo desfecho de pedido aparece ao paciente com texto próprio e data.
- Prioridade: P2.

**PUX-13**
- Cenário: o paciente lê "Correção solicitada" sem ter pedido nada.
- Objetivo: entender o estado do item.
- Proposta: o rótulo é igual para pedido do paciente e, possivelmente, para pedido do profissional.
- Dificuldade: sujeito ambíguo. "Correção solicitada por quem?"
- Tipo: hipótese de fricção.
- Sugestão: distinguir os dois sentidos: "Você pediu uma correção" versus "Seu nutricionista pediu que você confirme". Se o segundo não existe no escopo, trocar o rótulo por "Você pediu uma correção".
- Aceite: leitura do rótulo sem contexto não admite duas interpretações (revisão de texto).
- Prioridade: P2.

**PUX-14**
- Cenário: o paciente vê no portal item registrado pelo profissional, ou pelo colaborador administrativo e ainda pendente (cenário 4).
- Objetivo: saber se a restrição que ele contou por telefone foi anotada.
- Proposta: os estados citam "você informou" e "revisado", sem indicar origem.
- Dificuldade: "Você informou" para algo que ele disse ao telefone pode causar estranheza ou confusão sobre onde foi anotado. Não se sabe se o paciente vê o item antes da confirmação.
- Tipo: risco plausível que exige teste.
- Impacto: dúvida de que o relato por telefone tenha sido ouvido.
- Sugestão: decisão de produto: o item registrado pelo administrativo aparece ao paciente com a mesma mensagem ("anotado pela clínica; ainda será conferido pelo nutricionista"). A origem é descrita em palavras do dia a dia, sem citar cargo interno.
- Aceite: todo item visível tem uma origem em linguagem simples (paciente ou clínica).
- Prioridade: P2.

**PUX-15**
- Cenário: restrição confirmada cujo alvo "não foi encontrado" no catálogo, ou ingrediente sem composição (cenários 1 e 7).
- Objetivo: o paciente saber se a restrição dele vale.
- Proposta: o aviso "este registro ainda não gera alerta automático confiável" é pensado para o profissional.
- Dificuldade: se algo parecido chegar ao paciente, ele pode ler "não está protegido". Por outro lado, se nada chegar, ele pode supor cobertura total.
- Tipo: risco plausível que exige teste.
- Sugestão: o portal não repete a frase de engenharia. Mostrar o estado em termos de pessoa: "Seu nutricionista está conferindo este item". Questão de produto para o proprietário: dizer ou não ao paciente que a conferência é manual.
- Aceite: texto do portal sem sugerir proteção automática ou ausência dela.
- Prioridade: P2.

**PUX-16**
- Cenário: paciente antigo (cenário 5) respondeu "lactose" e "nenhuma" no questionário antigo e nunca foi avaliado.
- Objetivo: não ser surpreendido nem ignorado.
- Proposta: "sugestão histórica a revisar" para o profissional; "nenhuma" nunca confirma ausência.
- Dificuldade: a proposta não diz se o paciente vê alguma coisa. Sem aviso, ele acredita que informou e está tudo registrado. Com aviso mal escrito, pode soar como cobrança ou como "você errou".
- Tipo: hipótese de fricção.
- Sugestão: se o paciente vir algo, usar tom acolhedor e pedir confirmação simples: "Há um tempo você contou sobre lactose. Isso continua valendo?" Opções: "Continua", "Mudou", "Prefiro falar com meu nutricionista". Sem termos como "sugestão histórica".
- Aceite: o texto não contém culpa nem jargão e cabe em uma tela de celular sem rolar.
- Prioridade: P3, subindo a P2 se o paciente for ver a pendência.

**PUX-17**
- Cenário: o paciente espera um plano ou uma troca, e o profissional não consegue aplicar o item (cenário 1). Ele recebe um plano atrasado, ou um contato do profissional sem explicação.
- Objetivo: entender, sem alarme, por que um alimento não entrou.
- Proposta: o bloqueio é só do profissional, sem exceção por paciente.
- Dificuldade: é um risco de comunicação, não de bloqueio. Se o nutricionista é impedido por um mapeamento errado, a pessoa em acompanhamento sente o atraso, mas não sabe a razão. O portal não deve nunca revelar "bloqueado por alergia" como estado interno.
- Tipo: hipótese de fricção.
- Impacto: ansiedade ("será que há algo errado comigo?"). Isso compete ao profissional resolver, e o portal deve evitar informação que gere alarme.
- Sugestão: não criar mensagem automática ao paciente por causa do bloqueio. Para o profissional, o caminho de revisão do registro (reavaliação ou inativação) precisa ser rápido, para o paciente não esperar. Questão para o proprietário: existe um prazo-alvo para a curadoria de "classificação errada"?
- Aceite: nenhum estado interno de conflito chega ao portal (verificável por teste de contrato).
- Prioridade: P2.

**PUX-18**
- Cenário: paciente com baixa leitura ou uso de leitor de tela, no celular.
- Objetivo: entender o estado de cada restrição.
- Proposta: três estados textuais.
- Dificuldade: se o estado depender de cor ou de ícone, perde-se a informação. Não é possível provar nada sem tela.
- Tipo: sugestão de melhoria (acessibilidade), sem prova de teclado ou leitor de tela.
- Sugestão: cada item é um bloco com texto completo ("Alergia a camarão. Você informou; ainda será conferido. Atualizado em..."), com o estado em texto e alvos de toque grandes para "Pedir correção". Para leitor de tela, ler o nome da restrição antes do estado.
- Aceite: na primeira tela, verificar com leitor de tela real e com teclado antes do fechamento (etapa C).
- Prioridade: P2.

**PUX-19**
- Cenário: primeira consulta (cenário 3): "alergia a camarão e amendoim" e "não como carne por escolha religiosa".
- Objetivo: ver no portal as três restrições com a distinção certa.
- Dificuldade: o portal mostra o resumo "das restrições próprias". Uma escolha religiosa ou cultural não é uma alergia. Se aparecer na mesma lista e com o mesmo peso visual, o paciente pode se sentir julgado ou ter a dignidade da escolha rebaixada. O contrário também vale: ele pode achar que uma alergia foi tratada como preferência.
- Tipo: risco plausível que exige teste.
- Sugestão: agrupar por tipo com rótulos familiares: "Alergias", "Alimentos que você evita por escolha", "Preferências". Sem palavras como "restrição" no título, se o teste mostrar que assusta. Não colocar uma escolha em seção de saúde.
- Aceite: com protótipo, o paciente sintético consegue dizer em que grupo cada um dos três itens está.
- Prioridade: P2.

**PUX-20**
- Cenário: pedido de inclusão, correção ou remoção pelo paciente.
- Objetivo: poder retirar uma restrição que não vale mais.
- Dificuldade: pedir "remoção" de uma alergia é um ato carregado. Se a tela facilitar demais, o paciente pode pedir sem pensar. Se o texto for severo, ele pode ter medo de errar.
- Tipo: hipótese de fricção.
- Sugestão: texto de apoio sem pressão: "Seu nutricionista vai conferir antes de qualquer mudança. Enquanto isso, o registro atual continua valendo." Campo livre opcional e curto para explicar. Não pedir justificativa clínica ao paciente.
- Aceite: texto aprovado em revisão de linguagem e sem termos clínicos.
- Prioridade: P3.

**PUX-21**
- Cenário: o paciente usa o portal ao consultar o plano na hora de comprar ou cozinhar.
- Objetivo: saber, de relance, o que evitar, sem entrar na tela de restrições.
- Dificuldade: não está dito se o resumo aparece junto ao plano ou receita. Ele pode estar em uma tela escondida.
- Tipo: sugestão de melhoria.
- Sugestão: decisão de produto, sem criar funcionalidade nova: o resumo fica a um toque do plano. Exibir somente itens do próprio paciente, sem "sem conflito" nas receitas.
- Aceite: resumo acessível em no máximo um toque a partir do plano (estimativa, a validar em protótipo).
- Prioridade: P3.

## Oportunidades
- Reaproveitar o padrão dos três estados em outros avisos ao paciente, para não multiplicar rótulos.
- Alinhar com o time os textos do portal antes de construir. Os rótulos são o produto nessa tela.
- Uma única tela de "pedido enviado" serve a inclusão, correção e remoção.

## Perguntas de produto realmente necessárias
1. O paciente vê itens registrados pelo profissional ou pelo administrativo antes da confirmação? Com que texto (PUX-14)?
2. Existe estado visível ao paciente para pedido recusado ou ajustado (PUX-12)?
3. O paciente é avisado, e como, sobre respostas antigas do questionário (PUX-16)?

## Conclusão proporcional
Do ponto de vista do paciente, a v2 melhora a segurança e a clareza: o bloqueio protege sem exigir ação dele, e os três estados em linguagem simples são uma boa base. Os principais riscos que restam são de texto e de lacunas no ciclo de vida do pedido (desfecho, origem, tom), e não de arquitetura. Não identifiquei achado P0 ou P1. Os P2 pedem decisão sobre o texto do portal antes de qualquer tela. Tudo é hipótese a testar na primeira interface, incluindo teclado e leitor de tela. Este parecer não valida o aspecto clínico, jurídico ou de privacidade, que continuam com a engenharia, a segurança e a revisão R4.
