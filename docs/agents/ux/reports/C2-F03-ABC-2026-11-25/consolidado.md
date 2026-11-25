# Consolidação e manifesto F03

| ID / origem | Evidência ou hipótese | Estado | Aceite / impacto |
| --- | --- | --- | --- |
| NUX-01/02; PUX-02/03 | Coerência/duplicidade reproduzidas e corrigidas | JÁ COBERTO local | Limpar contexto, uma pendente, foco/retry; sem alterar backend |
| NUX-03; PUX-01/04/05 | Regras de prazo, texto e token conferidas no código/testes | JÁ COBERTO local | Público condicional, 429 sem prazo, 410 neutro |
| PUX-01, refinamento textual B | Sugestão de clareza, sem defeito comprovado | BACKLOG / P3 | Avaliar entendimento antes de mudar texto; baixa complexidade, sem autorização automática |
| PUX-03, anúncios assistivos | Verificação manual ausente | AVALIAR / P2 | Ouvir espera/resultado correto sem perder foco; não deduzir pelo axe |

Prioridades da A preservadas: profissional P2, paciente P1 para os quatro primeiros
itens e P2 para link. Não fabricar consenso. Sem nova decisão material de produto.
Os pareceres não aprovam merge, segurança, entrega ou usuários reais.

## Manifesto

- 25/11/2026, main0fd46a01. Papéis `.codex/agents/` da base; plano cb39c2c5 por referência.
- Runtime com papel explícito: instâncias novas `/root/c2_f03_nutricionista_ux` e
  `/root/c2_f03_paciente_ux`, `fork_turns=none`. Follow-ups B/C às mesmas instâncias.
  Seleção nativa TOML não comprovada. Zero chamadas de ferramentas observadas.
- Cada persona recebeu brief sanitizado, sem parecer da outra. Não há isolamento
  técnico forte presumido pelo TOML. Coordenador é único escritor/executor.
- Entradas/saídas aqui são sínteses editoriais. Horários exatos não expostos pelo
  runtime, não inventados. Hashes identificam arquivos/papéis/código preservados,
  não o texto original enviado. A preservada como proposta anterior à execução.
- B/C analisam relatos; coordenador viu captura real, personas não viram imagens
  ou navegaram. Sem pesquisa com pessoas, clínica, leitor de tela ou SMTP real.
- R4 separada `/root/c2_f03_r4`, estática, sem testes próprios. Seu apontamento
  sobre fixture foi corrigido e confirmado estaticamente, sem reabrir toda revisão.
