# Consolidação e manifesto B/C — C2-F01

| Origem / item | Evidência ou hipótese | Prioridade / estado | Aceite e impacto |
| --- | --- | --- | --- |
| NUX-01/02/03/06; PUX-01/02 | Testes reais executados pelo coordenador, relatos às personas | JÁ COBERTO no escopo automatizado | Foco/campos, erro público, tentativa única, ARIA; sem mudança de permissão |
| NUX: link quebrado a 200% | Hipótese de fricção, não defeito | BACKLOG / observação futura | Só mudar se teste de jornada mostrar dificuldade; complexidade baixa |
| PUX-02: anúncio com leitor de tela | Teste manual ausente | AVALIAR, validação pendente | Executar tecnologia assistiva real, sem atribuir PASS pelo axe |
| PUX: limite sem prazo | Risco sem prova de problema | JÁ COBERTO pela mensagem segura | Não inventar tempo; backend é autoridade |

O profissional registra hipótese de legibilidade do link; paciente não a considera
dificuldade demonstrada. Preservar diferença de análise, sem fabricar consenso.
Nenhuma sugestão nova de produto incorporada automaticamente.

## Manifesto

- Data da rodada: 25/11/2026; base `0fd46a01`. Papéis versionados da base.
- Runtime com papéis explícitos, `fork_turns=none`; seleção nativa TOML não comprovada.
  Instâncias: `/root/c2_f01_nux_bc`, `/root/c2_f01_pux_bc`.
- Uma invocação B por instância e follow-up C após gates, sem contato com outro
  parecer. Zero chamadas de ferramentas observadas nos retornos; sem edição.
- Brief aqui é síntese editorial das entradas, retornos são sínteses editoriais.
  Hashes dos arquivos preservados em `manifesto-sha256.txt`; não são hashes do
  prompt original nem prova de usuário real. Horários exatos de início/fim não
  expostos pelo runtime; não estimados como fatos.
- Coordenador viu screenshot mobile e executou testes; personas apenas receberam
  descrição sanitizada. Não alegar teste visual/interação delas.
- Código funcional sem alteração entre B/C; fingerprint do patch no handoff F01.
  Nenhuma revisão aprova merge, substitui CI/R4, clínica ou teste manual de leitor.

Etapa D da F02 deve reutilizar estes critérios e separar novo feedback de cópia.
