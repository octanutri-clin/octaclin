# Brief sintético — FOOD06 T8, etapa A (segunda rodada, contrato v2)

Etapa A, só sobre uma **proposta escrita** (nenhuma tela, protótipo ou código). Base: `main` em `d84b0f11`; documento:
`tasks/food06-m11-restricoes-contrato-v2.md`. A primeira rodada (v1) está em `reports/FOOD06-T8-A-2026-11-11/`. Agora o proprietário
**decidiu** D1 a D11. Avalie **o que mudou** e **riscos novos**; não reabra decisões do proprietário por gosto.

## Decisões do proprietário que mudam a experiência

- **Alergia confirmada com presença identificada do alérgeno: o sistema IMPEDE aplicar o item ao plano, sem botão de ignorar.** A
  saída é corrigir a classificação (curadoria versionada) ou fazer a revisão formal do registro (deixar "em reavaliação", que **continua
  valendo**, ou inativar com motivo e autor). Não existe exceção permanente por paciente e alérgeno. Gravidade "leve" não libera nada.
  Doença celíaca com glúten identificado: mesmo controle.
- **Alergia confirmada com possibilidade ("pode conter"):** o sistema mostra a evidência e a incerteza e exige esclarecer a composição
  e rever antes de aplicar. **Intolerância:** avisa; permite decisão individual só se existir regra de tolerância validada, com
  justificativa. **Escolha** (ética, cultural, religiosa): incompatibilidade não clínica, o profissional confirma. **Preferência:** informa e
  sugere alternativas, nunca bloqueia.
- **Sem regra clínica validada (e hoje nenhuma foi validada, nem lista de alérgenos nem mapeamento):** o resultado é "indeterminado" e o
  aplicar exige **revisão explícita** quando há presença identificada ou possível. Nunca aparece "sem conflito" por falta de dado.
- **Avaliação "sem restrições" tem validade de 180 dias** (política de produto). Vencida, some o "sem conflito" e aparece pedido de
  reconfirmar **no contexto da troca/prévia, sem perder o trabalho**; não bloqueia a edição do plano. Proposta do coordenador: uma
  restrição **já confirmada nunca deixa de valer por prazo**.
- **Só profissional assistencial habilitado confirma.** Colaborador administrativo pode **registrar declaração pendente**, não validar.
  Confirmação em lote é permitida, com visão individual e ação expressa.
- **Declaração do paciente (portal ou questionário) entra como pendência**, visível ao profissional, sem virar conflito confirmado.
  Respostas antigas do questionário **não migram**: aparecem como "sugestão histórica a revisar" e podem ser promovidas com um gesto
  (corrigindo a categoria e escolhendo o alvo). A resposta "nenhuma" nunca confirma ausência de restrição.
- **Alvo não encontrado:** o profissional registra mesmo assim ("não encontrei", pedido de curadoria); o registro mostra **"este registro
  ainda não gera alerta automático confiável"**. Diferencia-se visualmente "alimento não classificado" de "paciente não avaliado".
- **Paciente no portal:** vê o resumo das restrições próprias (declaradas por ele ou registradas pelo profissional) com três estados em
  linguagem simples: "Você informou; ainda será conferido", "Revisado pelo seu nutricionista", "Correção solicitada". Pode **propor**
  inclusão, correção ou remoção; isso **nunca sobrescreve** um registro confirmado e gera pendência e aviso ao profissional. Nunca vê os
  estados internos do sistema (por exemplo "indeterminado", "pode conflitar", "sem conflito registrado").
- Consulta de alimentos (M11): **continua mostrando** os alimentos com conflito, com fonte e versão; um aviso por paciente/sessão (não por
  linha). Troca com prévia (M04): "antes" e "depois", com o **ingrediente exato** que causa o conflito; a prévia **não pode omitir** um alerta que
  reapareceria só ao aplicar. Cenários (M12): cada alternativa tem avaliação própria; ao aplicar, o servidor recalcula tudo e, se algo
  mudou desde a prévia, exige nova revisão.
- Vários alvos: mostra a lista individual **e** um agregado pela regra mais conservadora; o "sem conflito" de um alvo nunca esconde o conflito de outro.

## Cenários sintéticos para simular

1. Nutricionista autônoma, plano em andamento: o paciente tem alergia a crustáceos **confirmada**; ela tenta aplicar uma troca que o
   catálogo mapeia como "contém crustáceos". Ela sabe que o mapeamento está errado para aquele produto específico.
2. Equipe de clínica: a avaliação "sem restrições" foi confirmada há 200 dias por outra profissional; uma nutricionista troca um ingrediente
   numa receita com vários ingredientes.
3. Primeira consulta: o paciente diz "alergia a camarão e amendoim" e "não como carne por escolha religiosa"; ela quer registrar as três.
4. Colaborador administrativo da clínica registra o que o paciente contou por telefone; depois a nutricionista confirma em lote.
5. Paciente antigo: respondeu "lactose" e "nenhuma" no questionário antigo e nunca foi avaliado.
6. Paciente no celular, no portal: vê "Você informou; ainda será conferido" para a alergia que declarou, e quer pedir uma correção.
7. Receita com um ingrediente industrial cuja composição não está cadastrada.

## Limitações a respeitar

Sem pessoas reais; não é validação clínica, jurídica ou de privacidade; a lista de alérgenos, o mapeamento e as regras clínicas **ainda não
existem e exigem validação humana clínica**; sem telas, não alegue teste visual, de teclado ou de leitor de tela. Perguntas de produto só se
realmente necessárias. Foque no impacto de **ser impedido de aplicar** e no portal do paciente.
