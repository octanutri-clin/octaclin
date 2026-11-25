# Consolidação A — C2-F01/F02

| Sugestões | Fase | Decisão técnica / estado | Complexidade / segurança |
| --- | --- | --- | --- |
| NUX-01/02/03/06, PUX-01/02 | F01 | JÁ COBERTO pelo escopo autorizado; comprovar nos testes | Baixa; auth R4, sem mudar autorização |
| NUX-04/05, PUX-03 | F02 | JÁ COBERTO pelo escopo autorizado; ainda não implementado | Baixa; nunca incluir chaves/códigos no feedback |

Diferença preservada: profissional atribui P1 ao risco de cópia e paciente P2.
Não há consenso clínico fabricado nem nova funcionalidade aprovada pelas personas.
Não há pergunta de produto bloqueante. Avaliações são de proposta e não evidência
de funcionamento. As etapas B/C devem apontar interface/testes efetivos.

## Manifesto e limitações de preservação

- Modalidade: subagentes do runtime com papel explícito, sem seleção nativa TOML
  comprovada. Nomes recuperados do checkpoint: `/root/c2_nutricionista_a` e
  `/root/c2_paciente_a`. O checkpoint registra zero chamadas de ferramentas.
- Papéis da base `0fd46a01`, em `.codex/agents/`; brief sintético acima.
- Outputs acima: sínteses editoriais do checkpoint, não transcrições integrais.
  Horários exatos, IDs opacos e hashes do prompt originalmente transmitido não
  foram preservados. Não inventar esses dados nem usar hashes atuais como prova
  retroativa. Os arquivos preservados podem ser identificados por Git.
- Não é isolamento técnico forte, R4, teste de interface, leitor de tela, clínica
  ou pesquisa com usuários. B/C ainda pendentes quando este registro foi escrito.
