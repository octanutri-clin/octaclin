# Consolidação F05 e manifesto

| Origem / IDs | Problema / evidência | Prioridade | Solução | Complexidade | Arquitetura/segurança | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| NUX01/02/05, PUX01/02 | Correção trabalhosa, hipóteses A + testes de UI relatados B | P1/P2 conforme origem | Resumo, ordem, vínculo, foco e correção seletiva | Pequena | Contexto local e IDs públicos, sem storage | JÁ COBERTO |
| NUX03, PUX03 | Resposta antiga marca nova edição, risco A + prova A→B→A | P1 | Revisão por campo/época, sem roubar foco | Moderada | Preserva ACK e entradas autorizadas | JÁ COBERTO |
| NUX04/06, PUX04/05 | Erros remotos/operacionais ambíguos, risco A + RED de reflexão | P1/P2 conforme origem | Allowlist exata e alerta geral por status | Moderada | Nenhuma regra/permissão/BFF nova | JÁ COBERTO |

Sugestões reiteram o escopo aprovado; nenhum requisito material novo incorporado
por opinião de persona. As prioridades diferentes foram preservadas. “JÁ COBERTO”
é classificação local da solução, não aceite humano, CI verde ou liberação.

## Backlog / D

- AVALIAR P2: leitor de tela manual do resumo e da sequência campo/mensagem; NOT RUN.
- BACKLOG P2: futuras mensagens/novos campos exigem atualizar allowlist com prova de contrato; desconhecidos permanecem gerais.
- BACKLOG, decisão de produto separada: reconciliar semântica de nome vazio. O DTO legado só usa IsOptional/IsString/MaxLength e o serviço só atualiza nome truthy; F05 não acrescenta obrigatoriedade ou limpeza de nome silenciosamente. Não confundir apresentação de erros com nova validação.
- D: reutilizar as revisões por campo e os aprendizados F04 sobre foco visível e ACK. Não ampliar busca histórica da próxima fase sem auditar autorização e criptografia.

## Manifesto

- Data: 26/11/2026, America/Sao_Paulo. Base F04 e4540845, plano cb39c2c5 seção F05.
- Papéis/procedimento versionados em `.codex/agents/` e `docs/agents/ux/PROCEDIMENTO.md`, herdados da base. Runtime com instrução explícita, sem comprovação de seleção TOML nativa ou isolamento forte.
- Instâncias distintas `/root/c2_f05_nux` e `/root/c2_f05_pux`, fork_turns=none, follow-ups B/C separados. Nenhuma ferramenta observada das personas; coordenador único escritor/executor. Nenhuma persona recebeu a opinião da outra antes do parecer.
- Brief e saídas são sínteses editoriais; IDs atribuídos para rastreabilidade. Horários exatos individuais não preservados, não inventados. hashes.sha256 identifica arquivos/papéis/código, não prompts integrais nem validade clínica.
- Coordenador inspecionou capturas reais sintéticas mobile a200%; personas recebem relato, não imagem própria/interação. Sem pesquisa com pessoas ou dados clínicos reais.
- R4 `/root/c2_f05_r4`: independente estática, sem executar testes, serviços ou gates. Contrato HTTP/BFF legado não foi sanitizado neste incremento; a allowlist é da projeção da interface/API client.

## C final

Ambas as personas emitiram parecer favorável por relato do código congelado e4c8619a:70/70 após a correção mobile, mantendo as ressalvas de leitor de tela manual, CI/build e revisão formal. Foco/ARIA/Axe não são prova de anúncio assistivo real. O coordenador confirmou posteriormente os typechecks finais. A análise não autoriza merge ou exposição no portal.
