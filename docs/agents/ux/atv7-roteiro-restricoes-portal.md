# ATV-7: roteiro do teste de compreensão do portal de restrições

- **Objetivo:** confirmar com pessoas reais que os textos e selos do portal são entendidos como pretendido.
- **Ativação:** o ATV-7 do contrato v3 bloqueia a ativação de `restricoes.clinicas` até que este teste seja **executado**. Este
  documento é só o roteiro. Ter o roteiro **não** é PASS.
- **Validação clínica:** a validação clínica dos textos (ATV-1) está em `docs/clinico/README-validacao-textos.md`. Ela vem antes, para
  não testar com pessoas um texto que ainda vai mudar.

## Regras

- Só **dados sintéticos**: ambiente de staging com pacientes, nomes e alergias inventados, e nenhuma conta real. O participante usa
  uma conta de teste preparada.
- Consentimento antes de começar, com o objetivo e a possibilidade de parar a qualquer momento.
- Gravar só anotações. Nada de vídeo do rosto, nome ou contato do participante.
- Nenhum dado de saúde do participante. As perguntas são sobre o que a tela diz, nunca sobre a saúde dele.
- Quem conduz não explica a tela durante a tarefa. A dúvida é registrada como achado.

## Participantes (de 5 a 8)

Distribuir os perfis abaixo, sem juntar todos numa pessoa:

- paciente adulto que usa o celular no dia a dia;
- paciente com pouca familiaridade com tecnologia;
- responsável por uma criança, que representa outra pessoa no portal;
- pessoa com pouca familiaridade com termos de nutrição;
- pelo menos 1 pessoa que usa leitor de tela (TalkBack ou VoiceOver) ou navega só pelo teclado.

## Tarefas (celular, conta de teste)

1. "Veja quais restrições estão registradas para você."
2. "Diga o que significa este selo": Restrição registrada no seu acompanhamento / Informação enviada pelo portal; ainda será
   conferida / Anotado por quem faz seu acompanhamento; ainda será conferido.
3. "Informe que você tem alergia a camarão." A tarefa termina na mensagem de envio e no aviso de urgência.
4. "Peça a correção de um item que está errado." Depois: "cancele esse pedido".
5. Só para responsáveis: "Agora veja as informações do seu filho." Usa o seletor de pessoa.
6. "Uma informação que você enviou foi revisada. O que aconteceu?" Exige o estado de informação revisada (PUX-01, 30 dias)
   implementado.

## Perguntas de compreensão

O critério de cada pergunta está entre parênteses.

| Texto | Pergunta | Entendimento esperado | Entendimento crítico (falha) |
| --- | --- | --- | --- |
| Selo "registrada" | "Isso quer dizer o quê para a sua alimentação?" | A equipe registrou | "O plano já evita isso" ou "estou protegido" |
| Selo "ainda será conferida" | "Já vale?" | Ainda não foi confirmado | "Já foi aceito" |
| `portal.planoNaoMuda` | "Registrar aqui muda o seu plano?" | Não muda automaticamente; falar com a equipe | "Muda sozinho" |
| `portal.urgencia` | "Se tiver falta de ar agora, o que você faz?" | Urgência ou 192 | "Mando mensagem pelo portal" |
| `portal.informarSucesso` | "E agora, o que acontece?" | A equipe vai conferir | "Já está resolvido" |
| Vazio ("Isso não quer dizer que você não tenha restrições") | "O que esta tela diz sobre você?" | Ainda não há registro | "Não tenho nenhuma restrição" |
| Grupo "Outras condições" (NUX-14) | "O que entraria aqui?" | Condições como doença celíaca | Confusão com preferência |
| Pedido decidido "Sua solicitação foi analisada e não houve alteração" | "O que aconteceu com o seu pedido?" | A equipe analisou e manteve | "Foi ignorado" ou "deu erro" |
| Inativação sem aviso (NUX-21) | "Um item sumiu da lista. O que você acha que aconteceu?" | Registra a interpretação | Achar que foi erro e reenviar sem falar com a equipe |

## Critério de aprovação

- **Para cada texto:** pelo menos 80% de entendimento esperado e **nenhum** entendimento crítico. Um único entendimento crítico
  reprova o texto, que volta para o ATV-1 com a mudança proposta.
- **Tecnologia assistiva:**
  - as tarefas 1 a 4 concluídas só com teclado e com o leitor de tela;
  - os selos e os estados anunciados em texto;
  - o foco visível e devolvido depois dos diálogos.
- **Registro:** uma linha por participante e tarefa, com perfil (sem identificação), concluiu (sim ou não), tempo aproximado,
  entendimento (esperado, parcial ou crítico) e citação curta **sem dado pessoal**.

## Resultado

Registrar em `docs/agents/ux/reports/FOOD06-ATV7-<data>/`, com o mesmo formato dos relatórios de UX (brief, notas consolidadas e
manifesto). O status de cada texto vai para o registro de validação. Até lá, o ATV-7 continua **SKIPPED** em toda PR.
