# Revisão recorrente de experiência e produto

## Papéis e ativação

Os arquivos `.codex/agents/octaclin-nutricionista-ux.toml` e `octaclin-paciente-ux.toml` são as instruções canônicas, versionadas. Não são profissionais/pacientes reais nem processos que ficam rodando. Novas sessões devem ler AGENTS.md, este procedimento e os relatórios/decisões relevantes. O procedimento entra em vigor no checkout desta branch; outras branches/clientes o recebem após integração autorizada ou referência explícita a estes arquivos. Não implica merge automático desta PR.

Em cliente Codex com papéis customizados, após confiar conscientemente no repositório e reabrir a sessão quando necessário: “Use os subagentes octaclin-nutricionista-ux e octaclin-paciente-ux, independentemente, na etapa A, sobre o brief sintético fornecido. Não implementar sugestões.” Verificar na atividade o nome/ID real e o resultado, não apenas menção no texto. Sem modelo fixado nos arquivos: herdar a escolha da sessão, sem troca automática. Cliente/conta/modelo podem limitar delegação.

Os papéis desabilitam shell/apps/plugins/memória/ferramenta de pedir permissões, conforme capacidades suportadas, e não devem usar ferramentas. O coordenador reúne previamente as evidências mínimas e sanitizadas. Permissões/sandbox/provider/MCP são herdados da sessão: um TOML não oferece sandbox read-only independente. **Não declarar isolamento forte por configuração de persona.** Usar sessão realmente restrita/prompt-only quando necessário e nunca encaminhar secrets/PHI/PII. Não rodar em sessão com conteúdo sensível; não ler envs, auth/config global, prontuários ou bancos para preparar brief. Nenhuma credencial operacional deve ser fornecida.

## Modos de execução e fallback

1. **Papel nativo selecionado:** cliente confirma instância com agent_type/nome customizado; registrar ID, config e fonte da evidência de seleção.
2. **Subagentes do runtime com papel fornecido:** se ferramenta de delegação existir mas não aceitar agent_type, ler os TOMLs e enviar suas instruções como prompt a duas instâncias novas, sem herdar conversa (`fork_turns=none` quando disponível). Declarar essa ponte, não alegar seleção automática do TOML. Não habilitar ferramentas/contas para compensar. Papel fornecido e ausência de dados não constituem restrição técnica de ferramentas herdadas; registrar chamadas efetivamente feitas e limitações. Instruir a responder sem ferramentas e fiscalizar o resultado.
3. **Fallback sequencial:** se delegação não funcionar, o agente principal faz duas passagens distintas com os mesmos papéis, registra “simulações sequenciais pelo agente principal, não independentes”, modalidade/limitações e parecer separado. Não inventar IDs nem chamar isso R4 independente. Cliente sem TOML nativo pode ler `developer_instructions` como instrução textual.

Falha de disponibilidade não exige instalar pacote, atualizar cliente, liberar rede ou baixar ferramenta. Registrar BLOCKED no modo desejado e usar fallback autorizado com transparência. Se não for possível fornecer contexto seguro, bloquear só a revisão afetada e solicitar sanitização.

## Quatro momentos obrigatórios

| Etapa | Entrada mínima sanitizada | Saída e gate |
| --- | --- | --- |
| A — planejamento | Propósito, decisões aprovadas, cenários, proposta/contratos, versão/commit, limites | Nutricionista e paciente (ou N/A justificado) avaliam separadamente antes de implementar; consolidar decisões que mudam produto para o proprietário |
| B — protótipo/primeira integração | Fluxo real utilizável, código/telas/interações disponíveis e resultados exatos | Comparar com A, registrar fricções/reprodução. Sem UI executada, marcar estático e manter B visual não executado |
| C — pré-conclusão da PR | HEAD testado, journeys/regressões, decisões e achados A/B | Reavaliar jornadas, fechar critérios prioritários com evidência, manter backlog não executado; não substitui CI/a11y/segurança/R4 |
| D — início de próxima fase | Relatórios/decisões relevantes e backlog, não todo histórico do repositório | Reutilizar decisões aprovadas, checar regressão e evitar recomendações repetidas; adicionar oportunidades sem autorizar implementação |

Paciente N/A: explicar por que a mudança não afeta sua jornada, conteúdo, visibilidade, notificações ou documentos. Não dispensar paciente só por ser uma tela de console se o conteúdo chega ao portal. A etapa D alimenta A da nova fase. Segurança/engenharia podem solicitar prova adicional sem que persona substitua a validação técnica.

## Brief e evidência

Usar o [template](templates/RELATORIO.md). Coordenador inclui: etapa, escopo autorizado, SHA/versionamento dos arquivos avaliados, quais telas/código foram fornecidos, cenários sintéticos, decisões anteriores e o que não está em execução. Cada papel recebe o mesmo brief factual e sua própria instrução; não recebe o parecer do outro antes de entregar. Revisor não altera artefatos, conta, banco ou runtime.

Cada achado exige cenário, objetivo, comportamento proposto/observado, dificuldade, evidência ou hipótese, impacto, sugestão, aceite mensurável e prioridade. Distinguir defeito comprovado, risco plausível/teste necessário, hipótese de fricção, sugestão de melhoria e preferência estética. Plano implica avaliação de comportamento proposto; ausência de desenho não prova falha visual. P0 exige evidência concreta e escalonamento a segurança/clínica; P1 bloqueia jornada essencial; P2 eficiência/clareza/a11y; P3 refinamento. Opinião estética não é vulnerabilidade.

O coordenador mantém propostas discordantes e explica recomendação. Aprovação técnica de detalhe reversível já autorizado não exige nova pergunta; mudança de produto, dose/porção/consentimento/acesso ou escopo vai ao proprietário antes de implementar. APROVAR no relatório é **recomendação para decisão**, não aceite humano. Estados: APROVAR, AVALIAR, JÁ COBERTO, REJEITAR, BACKLOG. Acrescentar decisão humana (pendente/aceita/rejeitada/adiada), referência da decisão, tarefa e prova posterior. Nunca marcar aceito porque um agente concordou.

## Persistência e prova de ocorrência

Relatórios em `docs/agents/ux/reports/<ID>-<etapa>-<data>/`: brief, nutricionista, paciente e consolidado com manifesto de execução. Histórico/backlog em `docs/agents/ux/BACKLOG.md`; só itens relevantes para nova fase. Não modificar relatório antigo para aparentar aprovação retroativa; atualizar decisão por registro datado ou addendum. Relatório completo é escrito pelo coordenador a partir da saída recebida; identificar transcrição ou síntese editorial.

Manifesto mínimo: fonte/commit+hash do brief e dos papéis, modalidade real, ID/nomes das instâncias, início/fim, entrada comum, ferramentas usadas, resultado/limitações e hashes das saídas preservadas. Hash só identifica artefato, não prova validade clínica nem autoria humana. Para provar atividade independente, conferir a trilha do runtime e os dois IDs/retornos distintos; dois textos no disco não bastam. Arquivos locais não tornam essas avaliações pesquisa com pessoas ou R4 de segurança.

## Validação da infraestrutura

`python3 scripts/validar-papeis-ux.py` e `python3 -m unittest discover -s scripts -p 'test_papeis_ux.py' -v` usam apenas stdlib Python3.11+. O gate existente `pnpm test:tooling-agentes` inclui esses testes (Python já usado no workflow). Eles detectam identidade trocada, TOML ausente/malformado, symlink e tentativa de habilitar ferramentas ou adicionar autoridade/modelo/MCP/sandbox. Não medem qualidade da persona nem fornecem proteção absoluta contra prompt injection.

Conferir suporte a cada nova versão: `codex --version`, `codex features list` e documentação oficial https://developers.openai.com/codex/subagents/. O cliente instalado e a API de delegação podem ter capacidades diferentes; registrar separadamente. Não instalar dependências sem necessidade/autorização. Não versionar auth/config global, dumps de prompt ou resposta completa de config/read.

Enquanto esta infraestrutura estiver apenas na PR Draft, uma sessão em outra branch pode receber a referência explícita `chore/ux-product-agents` e consultar seus arquivos com `git show` para executar o modo ponte/fallback. Sem essa referência ou integração autorizada, AGENTS.md antigo de outra branch não passa a conter estas regras automaticamente. Não fazer cherry-pick/merge silencioso para forçar ativação; registrar a versão dos papéis utilizada no relatório da fase.
