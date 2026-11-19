# Parecer PUX — FOOD06 P3-6, etapa B

Instância distinta do runtime desta sessão, com o papel `octaclin-paciente-ux` fornecido como prompt (sha256 `a40b1ded…ff7d7`),
0 chamadas de ferramenta, sem ver o parecer da outra persona. Transcrição editorial fiel do parecer entregue.

**Contexto e limitações.** Só o brief sintético (texto renderizado da tela da equipe). Sem tela, portal, leitor de tela ou pessoas.
Foco: impacto indireto sobre o paciente e sobre quem é registrado como responsável.

**Pontos positivos.** A descrição diz o que a pessoa poderá fazer e pede conferência antes de registrar; o "não encontrado" não
confirma existência de conta e indica o próximo passo; a remoção explica a consequência e tem saída segura ("Manter"); a lista mostra
como e quando a conferência foi feita.

| ID | Prioridade | Achado | Sugestão / aceite |
| --- | --- | --- | --- |
| PUX-01 | P1 | Nenhum aviso ao paciente nem ao responsável quando alguém entra ou sai | Enquanto não houver notificação, orientar a equipe na tela: "Avise o paciente e a pessoa ao registrar ou remover". Aceite: orientação nas telas de registro e remoção |
| PUX-02 | P1 (hipótese) | A confirmação mascarada não ajuda a pegar erro de digitação; um e-mail errado de outra conta real daria acesso a um estranho | Repetir o e-mail digitado por inteiro antes de registrar e sugerir conferir com a pessoa. Aceite: a equipe compara o endereço completo que digitou antes do botão |
| PUX-03 | P2 | "Conta p***@e***.test" não é um nome legível; leitor de tela lê asteriscos | Nome acessível compreensível; botão "Remover" com nome único |
| PUX-04 | P2 | "Restrições" é vago para leigos | Exemplo curto: "restrições alimentares, como alergias e intolerâncias" |
| PUX-05 | P2 | "Pedidos já feitos continuam no histórico" é ambíguo (de quem? a pessoa ainda vê?) | Explicitar quem vê e o que acontece com pedidos em aberto |
| PUX-06 | P3 | "Responsável" pode soar como tutela para procurador de adulto | Registro de risco; decisão já tomada |
| PUX-07 | P2 (hipótese) | Teclado e tecnologia assistiva não verificáveis pelo brief | Legenda acessível, erro sem opção, região viva, foco do diálogo |

**N/A.** Usuário experiente de apps (telas da equipe); celular não avaliável pela persona (não viu a tela).

**Perguntas.** (1) O paciente vê no portal quem o acompanha? (2) Pedidos em aberto do ex-responsável continuam sendo analisados?
(3) A equipe vê o e-mail completo antes de confirmar?

**Conclusão.** Tela clara e prudente; sem P0. Riscos principais: falta de aviso (PUX-01) e erro de digitação não percebido (PUX-02),
ambos resolvíveis com texto e confirmação, sem reabrir decisões.
