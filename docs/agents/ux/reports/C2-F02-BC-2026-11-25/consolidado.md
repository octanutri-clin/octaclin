# Consolidação F02 B/C e manifesto

| ID / origem | Problema e natureza | Estado / prioridade | Aceite / complexidade / segurança |
| --- | --- | --- | --- |
| NUX-04 e PUX-03 | Falta de ACK/fallback comprovada antes da implementação | JÁ COBERTO nos testes | ACK real, erro público e retry explícito; componente pequeno sem mudar MFA |
| NUX-05 | Risco de retorno antigo sobre conteúdo novo | JÁ COBERTO automatizado | Troca, regeneração, rejeição tardia e desmontagem não exibem resultado antigo |
| C2-F02-UX-01, paciente | Leitor de tela manual ausente, não defeito | AVALIAR / P2 | Anunciar resultado sem sucesso antecipado ou perder foco; validação manual |
| C2-F02-UX-02, ambos | Seleção por toque não observada, hipótese de fricção | BACKLOG / P2 paciente, sem prioridade de correção pelo profissional | Selecionar/copiar conteúdo autorizado após falha; validar antes de criar controle |

Sem nova decisão de produto incorporada. Preservar diferença de prioridade,
sem fabricar consenso. Itens não viram vulnerabilidades ou novas funcionalidades
por opinião das personas. CI/build pendentes impedem aceite global. Personas não
autorizam merge/deploy nem substituem R4.

## Manifesto

- Data 25/11/2026, base `f6f3e06b`; papéis versionados em `.codex/agents/`.
- Runtime com papel explícito, continuação das instâncias previamente originadas
  com `fork_turns=none`: `/root/c2_f01_nux_bc` e `/root/c2_f01_pux_bc`. Nomes da F01,
  escopo F02 explicitado. Sem seleção nativa TOML ou duas novas instâncias nesta rodada.
- B e follow-up C separados entre perspectivas, sem parecer da outra como entrada.
  Zero chamadas de ferramentas observadas. Coordenador único escritor/executor.
- Brief e retornos são sínteses editoriais. Horários exatos não expostos, não
  inventados. Hashes em `manifesto-sha256.txt` identificam arquivos preservados,
  papéis e código examinado, não o prompt original transmitido.
- A e D reutilizam C2-F01-F02-A e C2-F01-BC. Coordenador viu recortes reais de
  botão/status desktop/mobile e fonte 200%; personas só receberam descrição.
- Sem isolamento técnico forte presumido, teste com pessoas reais, validação
  clínica, prova de clipboard real ou leitor de tela manual.
