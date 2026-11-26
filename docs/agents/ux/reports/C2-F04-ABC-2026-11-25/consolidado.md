# Consolidação A/B e preparação C

Relatórios são sínteses editoriais do coordenador, com argumentos separados, não transcrições. Nenhuma nova decisão de produto necessária: sugestões reiteram o escopo aprovado do plano `cb39c2c5`, seção 9. Sem consenso clínico fabricado e sem autorização de merge/deploy.

| IDs | Funcionalidade / problema | Evidência | Prioridade de triagem | Solução | Complexidade | Arquitetura / segurança | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NUX-A01, PUX-A01/A02 | Saída e ambiguidade de descarte | Hipótese A + relato de browser B | P2 | Lista de seções e ação segura inicial; salvos preservados | Pequena | Somente estado volátil | JÁ COBERTO |
| NUX-A02, PUX-A04 | Falha parcial e resposta atrasada | Risco A; achados concretos R4 | P1 | ACK por seção e leitura atual autorizada na reabertura | Moderada | Mantém backend; sem promessa de CAS | JÁ COBERTO, provas finais pendentes |
| NUX-A03 | Novo texto após envio | Risco A; teste específico do coordenador | P1 | Baseline dos valores enviados | Pequena | Nenhum rascunho em storage | JÁ COBERTO |
| NUX-A04, PUX-A03 | Retorno de foco e teclado | Hipótese A + provas relatadas B | P2 | Modal existente, retorno ao campo/contexto | Pequena | Sem controles novos de acesso | JÁ COBERTO, revisão C pendente |

Limites: saídas suportadas não incluem garantia de Back/Forward SPA ou redirects programáticos. Beforeunload depende do navegador. Não bloquear logout nem persistir dados ao encerrar sessão. Dois saves de identificação não são transação; sem Salvar tudo. Revisão assistiva manual permanece separada dos testes Axe/teclado. B não viu capturas diretamente.

## C e adendo de acessibilidade

Personas emitiram pareceres favoráveis no escopo relatado da rodada 42/42, sem interação própria, pesquisa com pessoas ou aprovação de merge. Nenhum requisito novo sugerido foi implementado automaticamente.

Revisão crítica adicional do coordenador: foco DOM não bastava para comprovar visibilidade após retirar a seção Qualidade. Assert `toBeInViewport` produziu RED funcional (ratio 0); a correção foi `scrollIntoView({block:'nearest'})` após focus. Preserva o deslocamento anterior quando possível e faz o mínimo necessário para tornar o controle visível quando a estrutura muda. R4 conferiu estaticamente essa linha e manteve parecer favorável. Rodada final: **44/44 PASS**, com assert mais forte e navegação confirmada; ambas as personas receberam o adendo e mantiveram parecer favorável por relato. Detalhes no handoff; não apresentar restauração pixel a pixel como requisito comprovado.

## Aprendizados D / backlog

| ID | Tipo / prioridade | Próxima ação | Estado |
| --- | --- | --- | --- |
| BK-F04-01 | Validação manual assistiva, P2 | Ouvir anúncio do diálogo e retorno de foco com tecnologia assistiva | AVALIAR, NOT RUN |
| BK-F04-02 | Limite arquitetural, P2 | Propor guardas SPA gerais em escopo próprio, sem hacks de histórico | BACKLOG, não implementado |
| BK-F04-03 | Concorrência entre profissionais, P2 | Avaliar contrato revisionado/CAS cadastral em entrega própria | BACKLOG, sem enfraquecer autorização |
| BK-F04-04 | Refinamento de produtividade, P3 | Considerar indicação de salvamento só no botão da seção ativa, mantendo as demais ações desabilitadas | BACKLOG do coordenador, sem defeito de integridade alegado |

D para F05: reutilizar baseline/ACK, foco por rótulos públicos e erros que preservam a entrada; não repetir bugs já resolvidos. A F05 não é autorização implícita para CAS, autosave ou novo contrato de remoção de nascimento.

## Manifesto de execução

- Base main 0fd46a01; referência de plano cb39c2c5, seção 9. Papéis/procedimento da base em `.codex/agents/` e `docs/agents/ux/PROCEDIMENTO.md`.
- Modalidade: instâncias independentes do runtime com papel fornecido em prompt e `fork_turns=none`: `/root/c2_f04_nux_a` e `/root/c2_f04_pux_a`. Follow-ups separados B/C; nenhuma persona recebeu o parecer da outra antes de responder.
- Nenhuma chamada de ferramenta observada dos revisores UX. Configuração TOML nativa/isolamento forte não comprovados. Coordenador foi único escritor e executor dos testes.
- Brief/saídas preservados como sínteses editoriais, não cópias integrais dos prompts. Hashes em hashes.sha256 identificam arquivos/papéis/código, não comprovam autoria humana ou validade clínica.
- Horários exatos de início/fim de cada instância não expostos no registro preservado; não inventados. Data da avaliação: 25/11/2026, America/Sao_Paulo; fechamento pode atravessar meia-noite.
- Coordenador viu capturas sintéticas reais desktop/mobile. Personas receberam descrição/relatos, sem imagens/interação próprias. Sem pacientes reais, segredos, bancos ou infraestrutura operacional.
- R4 separada `/root/c2_f04_r4`, leitura estática, sem execução própria de testes. P2 e limites em r4.md. Personas não substituem R4/CI ou aceite do proprietário.
