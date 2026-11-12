# Brief sintético — FOOD06 T8, etapa A (planejamento)

Etapa A, só sobre uma **proposta escrita** (nenhuma tela, nenhum protótipo, nada implementado). Base: `main` em
`d84b0f11`; documento avaliado: `tasks/food06-m11-restricoes-contrato-proposta.md`. Decisões do proprietário ainda
**não** existem: é a proposta que será decidida. Modalidade esperada de evidência: somente plano.

## O que está proposto

O sistema hoje não guarda alergias/restrições de forma confiável: existe uma pergunta de questionário com 4 opções
("lactose", "glúten", "vegetariano/vegano", "nenhuma") e nada liga isso a alimentos. A proposta cria um contrato:

- **Registro de restrição** por paciente: natureza (clínica: alergia/intolerância/doença; escolha: religiosa/cultural/
  ética; ou preferência), alvo por ID de uma lista curada (alérgeno, grupo ou alimento), gravidade (leve, moderada,
  grave, não informada), estado (ativa, em reavaliação, inativa), origem (profissional, declaração do paciente,
  questionário) e **confirmação do profissional**. Sem confirmação é rascunho e não gera conflito. Preferência nunca
  vira conflito.
- **Situação da avaliação** do paciente: `nao_informado` (padrão), `sem_restricoes_confirmadas` (o profissional
  confirma ativamente, com validade; vencida volta a `nao_informado`) e `restricoes_registradas`.
- **Mapeamento alimento→alérgeno** curado e versionado. Resultado por alimento: `conflita`, `pode_conflitar`,
  `sem_conflito_registrado` (só com mapeamento "não contém" confirmado e avaliação confirmada; o texto nunca diz
  "seguro") ou `indeterminado` (o padrão).
- **Uso:** na consulta de alimentos o item é marcado, **não escondido**; sem avaliação aparece o aviso "restrições não
  avaliadas". Na troca com prévia e nos cenários, os conflitos do "depois" aparecem ao lado do "antes". O ato de
  aplicar ao plano um item que conflita por restrição clínica confirmada exige exceção auditada com motivo do
  profissional (recomendação, a decidir). O paciente não vê julgamento de compatibilidade; se vê as próprias
  restrições declaradas é decisão aberta.
- Não há classificação por IA, não há inferência de texto livre, não há diagnóstico nem semáforo.

## Cenários sintéticos para simular

1. Profissional autônomo, primeira consulta, paciente que diz "tenho alergia a camarão e a amendoim" e "não como
   carne por escolha".
2. Equipe de clínica: um paciente tem `sem_restricoes_confirmadas` vencida há dois meses e a nutricionista vai trocar
   um ingrediente de uma receita.
3. Paciente antigo (criado antes desta proposta) que respondeu "lactose" e "nenhuma" no questionário e nunca teve
   avaliação.
4. Alimento que o catálogo ainda não classificou.
5. Paciente que, no portal, vê o que declarou e quer corrigir.

## Limitações a respeitar

Sem pessoas reais; não é validação clínica, jurídica ou de privacidade; a lista de alérgenos e as regras de conflito
exigem validação humana clínica que esta revisão não substitui; sem telas, não alegue teste visual, de teclado ou de
leitor de tela. Perguntas de produto só se realmente necessárias.
