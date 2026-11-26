# C2-F06 — auditoria da busca no histórico de respostas

Auditoria de código e evidências de 26/11/2026. Referência de produto: seção 11 de `tasks/plan-ciclo2-login-cadastro-formularios-operacao.md` no commit `cb39c2c5`. A F06 é do ciclo de questionários. Nenhum código funcional, contrato ou ambiente externo foi alterado.

## Base e dependências

| Evidência | Estado observado |
| --- | --- |
| `main` remota `0fd46a01` | Merge da #584. A árvore desse merge é igual à da ponta `df208867` da #584. |
| #590 e #591 | Integradas sucessivamente nas branches das entregas anteriores. A paginação e os índices da #590 estão nessa cadeia. |
| #592 | Merge `b2ed05b2` em `feat/qst10-09-recorrencias`; candidato com paginação, leitor de completude e comparação. A árvore é igual à do HEAD revisado `ea53a6a9`. A cadeia diverge da main no merge da #584. |
| CI da #592, HEAD `ea53a6a9` | 18 success, 1 skipped e 3 failures. Backend na etapa PostgreSQL/RLS, Demo local smoke no Playwright e PR Gate na validação agregada. Diagnóstico posterior pelos logs: comparação com data fixa no teste de workers e fixture QPRO-09 interceptando somente o endpoint antigo. Correção e provas no handoff de estabilização vinculado abaixo. Não foi encontrado run do merge `b2ed05b2`. |
| #596 e #597 | F04 e F05 abertas. A #596 tinha 21 success e 1 skipped. A #597 tinha 19 success, 1 skipped e 1 em andamento na consulta. As duas tratam cadastro de pacientes e são independentes da F06. |

Base técnica para prova isolada: `b2ed05b2`. Antes de abrir a PR funcional, estabilizar a cadeia de questionários com evidência de CI, preservar as mudanças e confirmar a base de integração. Empilhar isoladamente para validação futura é possível. Integrar a cadeia à main é uma operação separada. A migration 1087 existente é de índices para paginação e não introduz busca textual. A auditoria não pressupõe que esteja aplicada em nenhum ambiente externo.

## Contratos observados

| Camada | Evidência na base técnica | Consequência para F06 |
| --- | --- | --- |
| Console | `usar-workspace-questionarios.ts`, `respostasVisiveis` e `perguntasLeituraFiltradas`. Filtro literal case-insensitive sobre a página, com nomes, enunciados e valores formatados. | Preservar o modo da página. A busca clínica histórica precisa ter alcance definido. |
| Persistência | `RespostaValorOrm.valor`, `EnvioQuestionarioOrm.snapshotEstrutura` e gravação em `ServicoQuestionarios`. São JSONB, com leitura e escrita diretas neste fluxo. | O código não demonstra cifragem de campo para esses dois conteúdos. Não inferir proteção física do banco pelo ORM. Usar só valores autorizados e snapshots históricos, sem derivar resultados de um enunciado atual. |
| Candidatos | `ServicoRespostasPaginadas.selecionar`. Tenant, questionário, vínculo do paciente, carteira, ciclo de vida, período e status respondido são filtrados em SQL. Ordenação por finalização decrescente, nulos no fim e UUID para desempate. Materializa conjunto elegível para contagem. | Reaproveitar elegibilidade e ordem. A contagem materializada integral não impõe teto ao trabalho do banco. |
| Valores e snapshots | `hidratar` revalida pacientes, envios e respostas. Trava por ordem global e limita o volume a 8 MiB antes de materializar o conteúdo. O leitor comum pode usar rótulos atuais no legado. | Reaproveitar locks e limites. Na busca histórica, snapshot ausente impede casar enunciado atual como se fosse histórico. Valores históricos textuais podem ser pesquisáveis quando seu conteúdo é suportado. |
| Permissões | `lerQuestionarioAutorizado` abre a transação de tenant. A comparação usa a opção de sessão atual e checa expiração. Paginação e CSV legados chamam a opção padrão. | O novo caminho deve adotar a revalidação da comparação, provar vínculo com a carteira e manter a ordem dos locks. Um cursor válido não concede acesso. |
| Cursor | `CursorRespostas` protege tenant, usuário, questionário, fuso e filtros, preservando microssegundos da data. | Escopo de cursor próprio da busca, vinculado ao termo normalizado e filtros sem expor o termo. Reautorizar a cada chamada. |
| HTTP/BFF | O POST de comparação já valida sessão, origem, tipos, tamanhos e projeção. `private, no-store`, com `Vary: Cookie` no BFF. | Reutilizar essas práticas e conferir logs nos dois lados. Enviar termo no corpo. Retornar identificação mínima de resultados, sem snapshot bruto ou texto livre adicional. |

## Proposta A — pesquisa completa sob orçamento

Após reautorizar sessão, questionário e carteira, selecionar metadados elegíveis com um teto mais uma linha. Se o universo passar do teto de envios, bytes, tempo ou filas de lock, responder com um estado explícito de refinamento e solicitar paciente/período. Não devolver contagem de matches ou rótulo “nenhum resultado” para execução incompleta. Medir também o custo da seleção SQL. Um LIMIT na saída não garante baixo custo de JOIN, ordenação ou lock.

Nos conjuntos elegíveis dentro do teto, usar o leitor histórico autorizado para inspecionar todos os candidatos daquela consulta e paginar correspondências pelo par data/UUID. Preservar os bytes máximos antes da leitura dos valores, impor prazo SQL e da operação e evitar retries automáticos. O orçamento inicial é uma hipótese a calibrar em PostgreSQL descartável com dados sintéticos densos/esparsos. Testar concorrência, cardinalidade e casos de termo raro ou ausente. Se limite estourar entre páginas, exigir refinamento ou reinício. Cada página reflete autorização atual. A proposta não promete snapshot imutável entre requisições.

Semântica proposta para ratificação de produto: substring literal, NFC e minúsculas pt-BR com acentos preservados. Buscar enunciados congelados associados às respostas e valores textuais persistidos, incluindo escolhas textuais. Usar filtro de paciente para restringir identidade. Nomes, números formatados, aliases, busca sem acento e rótulos de opções que não foram congelados precisam de definição antes de prometer paridade com a busca da página. Nenhuma interpretação clínica. No legado, usar somente o que o registro comprova.

Resposta proposta: resultados mínimos com IDs necessários ao leitor/comparador existente, data disponível, cursor e estado do alcance. Sem contagem global obrigatória. No console, exibir o questionário, filtros e modo selecionado, enviar por ação explícita, descartar respostas antigas após troca de contexto e respeitar seleção no mesmo paciente para comparar. CSV mantém seus alcances atuais.

## Alternativas

| Caminho | Vantagem | Custo ou limitação |
| --- | --- | --- |
| A. Varrer conjunto autorizado dentro do orçamento | Sem persistir índice clínico. Resultado completo para o conjunto aceito. | Varredura se repete entre páginas. Consultas amplas podem exigir refinamento. Recomendada para a primeira prova. |
| B. Varrer lotes com continuação explícita | Distribui o custo e permite percorrer históricos maiores. | Página pode estar vazia e ainda ter lotes. Cursor deve seguir os candidatos examinados. Exige decisão de UX sobre progresso, interrupção e consistência entre ondas. |
| C. Índice textual persistido mantido pelo servidor | Reduz varredura em volumes maiores. | Cria nova representação de conteúdo sensível. Exige desenho próprio para tenant, acesso, índice, temporalidade, armazenamento e descarte. Não recomendado para esta rodada. |

## Sequência e aceite

1. Estabilizar a base do ciclo anterior. Apurar as falhas do CI #592 e repetir os gates no commit usado para integrar. A prova local direcionada abaixo não substitui os gates completos.
2. F06A. Validar semântica e medir o caminho A em PostgreSQL descartável. Fixar limites demonstrados antes do endpoint. Provar role runtime com FORCE RLS, duas carteiras, revogação e transferência concorrente, cursor fora de contexto ou expirado, datas iguais/nulas/microssegundos, campos legados, limites e ausência de materialização fora do orçamento. Isolar a prova de privacidade de corpo/erros/cache/logs.
3. F06B. Usar leitor individual e comparação existentes. Revisões UX A/B/C/D, desktop/mobile, teclado, filtros, troca de contexto, cancelamento, estado vazio incompleto e regressões de CSV. R4 independente no caminho funcional antes da entrega.

A auditoria não registra PASS de desempenho nem de RLS para a futura busca. A aprovação principal do produto nessa proposta é o comportamento de refinamento quando o volume impede uma resposta completa e quais conteúdos entram na busca histórica inicial.

## Verificações desta auditoria

- PASS 66/66 no Node 22.21.1, árvore `b2ed05b2`. Suítes `consulta-respostas.spec.ts`, `comparacao-retornos.spec.ts` e `controlador-respostas-paginadas.http.spec.ts`. A seleção cobre comportamentos existentes de cursor, comparação e contrato HTTP. A F06 ainda é proposta.
- Checkpoint anterior, substituído pela retomada abaixo: BLOCKED no PostgreSQL local. A execução de `copia-pergunta.integracao.spec.ts` com `QST_P05_POSTGRES=true` e filtro `QST10-08|QST10-10` registrou 26 falhas de setup, com Docker retornando `no space left on device` ao iniciar o banco. Os 37 casos fora do filtro foram skipped. Nenhum caso selecionado comprovou comportamento de banco. O erro local não explica por si só a falha do CI remoto.
- NOT RUN para benchmark, prova de RLS da futura busca, revisão UX de implementação e smoke integral. A auditoria usou código e fixtures existentes, sem acesso a pacientes reais.

## Retomada da base — evidência posterior

A estabilização está em `fix/c2-f06-base-questionarios`, baseada em `b2ed05b2`, sem integrar branches à main. Ver [handoff da correção](c2-f06-base-questionarios.md). Após recuperação de espaço de caches gerados de servidores encerrados, a prova completa de duas suítes em PostgreSQL descartável passou: **87/87**, sem skipped. Isso comprova os fluxos existentes dessas suítes; não comprova a futura busca F06.

A consulta de produto sobre busca completa dentro de orçamento com refinamento, versus varredura em lotes, permanece pendente. Os limites de desempenho ainda precisam de medição; nenhum endpoint de busca novo foi implementado.
