# FOOD06 M08 — relatório factual, correção do gate de linguagem

## Estado

Incremento local sobre árvore a428f0cbf74145255eafc18b7c3400cedc354e55: local973b3765 e remoto159ced04 são commits distintos com a mesma árvore. Sem reset/rebase/descarte. Novos envios devem comparar pai remoto e árvore, usando Git/conector autenticado. Credencial CLI expirou no ciclo anterior; não ler/expor tokens para recuperar.

Solicitação vigente: agrupar uma entrega maior e validar localmente antes de novo push, pois o CI leva cerca de40min. Incremento M08 enviado em d04551e08e3a2326b0952dbdbdd729ace4bba2a4; PR455 continua Draft e gates científicos/operacionais bloqueados. Os checkpoints abaixo são históricos e não substituem o estado vigente.

## Checkpoint inicial — backend/BFF

- POST /pacientes/:pacienteId/planos-alimentares/analises-factuais/relatorio com registroId UUID em body, DTO estrito e cabeçalho private,no-store. Não aceita valores de análise do navegador.
- Papel Professional e permissões ler+gerenciar no backend. Serviço também exige gerenciamento diretamente e delega a consulta existente que reautoriza carteira/tenant/paciente e decifra dentro da transação.
- Documento factual versionado com registro/origem exatos, data da captura separada da geração, seleção congelada e projeção nutricional existente. Sem motor novo ou consulta a catálogo atual. Zero conhecido e ausências preservados.
- DRI/contexto completo/fontes de composição não projetadas ficam explicitamente indisponíveis; isso não encerra M08. Não inventar fontes, formas ou contexto para preencher relatório.
- BFF POST com limite16KiB, autorização antes do corpo e proxy autenticado/sanitizado existente. Permissão de leitura isolada não exporta.
- Sem schema, dependência, storage público, arquivo persistido, PDF gerado ou alteração do plano. Prévia/impressão ainda não implementadas.

## Evidências

RED HTTP funcional: rota ausente404 para pedido válido. Após implementação:26/26 backend (HTTP, projeções e relatório);112/112 BFF, com permissões antes de corpo, limites,409 e cache. Typecheck backend PASS Node22; rotas Next assíncronas PASS. Typecheck Web PASS Node22. Verificador de APIs dinâmicas171/171 PASS. Scanner local de segredos e diff-check PASS. Primeira tentativa do verificador de rotas usou nome de script inexistente; erro de setup corrigido executando test:apis-dinamicas real, não RED funcional. Testes de serviço usam consulta projetada simulada; não são provas PostgreSQL/RLS. Sem execução nova de PG, build, PDF, UX B/C ou R4 final deste incremento.

## UX A delimitada

Subagente food06_m08_ux_a sem conversa herdada/ferramentas, papel textual nutricionista fictício, baseado somente em brief sintético. Recomendações: identificar origem/revisão/datas; reautorizar antes de imprimir; preservar zero/ausência e lacunas; resumo com cancelar/imprimir e limpeza em memória; inspecionar PDF real e não inferir acessibilidade só do HTML. Paciente direto N/A: não há envio automático nem portal novo. Não é seleção nativa TOML, validação humana/clínica ou R4.

## Sequência original — atualizada pelos checkpoints seguintes

1. Revisar contrato de fontes/identificação mínima antes do template; não ampliar dados pessoais.
2. Cliente estrito, prévia e impressão usando infraestrutura existente. Nova consulta autorizada ao registro antes de imprimir, proteção de cancelamento/respostas tardias/contexto, sem cache persistente ou URLs com dados clínicos.
3. Isolar folha de impressão para não imprimir outros documentos/planos presentes na tela. Testar PDF real com texto selecionável, ordem, paginação, unidades e lacunas. Não declarar PDF acessível apenas por axe/HTML.
4. Completar autorização/RLS descartável, regressões, revisão R4 e UX B/C aplicáveis antes de encerrar incremento. Fontes/DRI/contexto pendentes não são liberados pela exportação factual.
5. Agrupar backend+BFF+UI+evidências em envio necessário à branch existente; checar CI do novo HEAD, sem merge/deploy/migrations externas. M08 não concluída e percentual administrativo não aumenta por contrato parcial local.

## Continuidade local — validação do cliente

Cliente relatorio-factual.ts consulta por POST sem cache persistente, corpo mínimo registroId e AbortSignal; erros sanitizados. Parser por allowlist vincula ACK ao registro esperado, valida identidade editorial/data/versão e indisponibilidade explícita de referências/contexto/fontes; usa o validador existente para micronutrientes e cobertura, sem novo cálculo. O modelo de apresentação inicial ainda não expõe macros/seleção, necessários na evolução do template conforme escopo; não o tratar como relatório final.

TDD do parser: RED funcional com implementação provisória indisponível (80PASS/1FAIL), depois GREEN; uma tentativa inicial teve erro de tipagem do teste e não foi considerada RED. Suíte final82/82 PASS incluindo fonte alheia, revisão inválida, referência ativada, zero/ausência, requisição mínima e erro403 sem canário. Lint dos arquivos novos PASS. Typecheck Web final executado. Não há prévia imprimível, PDF gerado ou prova de PDF acessível. O renderer, ciclo de cancelamento, nova autorização antes de imprimir e isolamento da folha são próximos passos. Todo delta M08 continua local e sem novo push, conforme solicitação de agrupar entregas para reduzir rodadas de CI. M08 não concluída; percentual administrativo mantido.

## Prévia e impressão inicial — delta local

Prévia conectada ao histórico com seleção do registro exato. Dados renderizados por React em portal e diálogo nativo (sem innerHTML), sem armazenamento persistente. Cancelar aborta requisições e remove prévia; unmount impede resposta tardia. Antes de imprimir há novo POST autorizado ao mesmo registro e comparação semântica com a prévia (data de geração é variável). Divergência ou acesso negado remove dados e bloqueia print. Folha recebe classe de impressão somente após essa revalidação; demais raízes do documento são excluídas por CSS apenas durante a operação, com limpeza posterior. Não é prova suficiente de PDF correto.

TDD browser: botão de relatório ausente reproduzido RED antes da integração. GREEN2/2 desktop/mobile de revogação entre prévia e impressão: nova consulta ocorreu, prévia foi removida e print não foi chamado. O primeiro mock negava por contagem de requisições, incluindo consulta abortada do StrictMode; foi corrigido para simular revogação explícita após exibir a prévia. Isso não foi falha clínica comprovada. Reexecução2/2 após integração do diálogo nativo PASS. Primeiro typecheck/lint da prévia PASS; verificação do diálogo/estilos finais ainda deve ser repetida.

Ainda pendentes: caminho autorizado de print, PDF real/texto/paginação, teclado/foco/escape, cancelamento/resposta tardia, teste de isolamento contra outra folha, macros/seleção no modelo de apresentação, referências/fontes/contexto indisponíveis devidamente delimitados, R4 e UX B/C aplicáveis. M08 não concluída; sem novo push ou CI deste delta.

## Validação de impressão e PDF real — continuidade local

- Caminho autorizado/revogado, Escape, cancelamento de leitura e resposta tardia: matriz10/10 desktop/mobile PASS, incluindo PDF normal e tentativa de cancelar durante print. Teste adicional de unmount durante print2/2 PASS. PDFs opt-in gerados pelo Chromium real com tagged=true e texto extraído por pdftotext; teste exclui canário de outra folha, nome sintético do paciente e botões. Unmount produz PDF vazio, sem repintar outra folha. Ver teste parametrizado PDF real em food06-tabela-factual.spec.mjs.
- RED funcional: print assíncrono limpava escopo cedo e PDF capturava CANARIO_OUTRA_FOLHA. Nova prova RED após cancelar durante print também revelou a mesma classe de vazamento. Corrigido por proprietário UUID e isolamento global @media print que permanece no unmount até afterprint. Cancelar/Escape não encerram impressão iniciada; enquanto aguarda autorização, fechamento interrompe pedido. Sem afterprint, novas impressões ficam bloqueadas em vez de liberar outra folha; nenhuma liberação por timeout arbitrário.
- Foco após cancelar carregamento teve RED; retorno explícito ao botão de origem adicionado e teste GREEN. Uma execução de browser foi invalidada por sobreposição do diretório de traces (ENOENT); provas finais usaram diretórios separados e execuções encerradas. Não contar essa falha como defeito funcional do produto.
- Revisão R4 independente delimitada m08_print_review somente estática: apontou cancelamento/unmount e reavaliou correção favoravelmente, sem teste próprio. Não é revisão integral FOOD06 ou aprovação clínica. A prova dinâmica do coordenador complementa, sem transformar leitura estática em execução independente.
- PDF normal sintético com2 páginasA4; primeira página renderizada e inspecionada pelo coordenador, tabela/unidades/zero legíveis. Texto extraído inclui limitações. Isto não comprova acessibilidade humana/AT ou todas as páginas/formas. Teste PDF local exige FOOD06_PDF_REAL=true e pdftotext; sem opt-in é SKIPPED, não PASS; caminhos autorizados/revogados e cancelamento rodam sem esse opt-in. Sem dependência runtime nova.

Próximo: completar macros/seleção e fontes/contexto permitidos no template, revisar demais páginas do PDF e teclado/AT conforme escopo, negativos de divergência entre prévia/print, RLS/integrações descartáveis aplicáveis e UX B/C. Typecheck Node22 e lint de fechamento PASS; diff-check e scanner local de segredos PASS. Sem novo push: agrupar o incremento completo antes de consumir nova rodada de CI.

## Conteúdo factual — macros e seleção

Parser agora inclui seleção congelada (bools e identidades únicas até50 refeições), energia e quatro macronutrientes usando o leitor de valores já existente nas prévias, exportado para reutilização sem segundo motor. Contagens de componentes devem corresponder à cobertura; desconhecido não vira zero. Template apresenta resumo de refeições selecionadas/ativas, tabela de energia/macros, micronutrientes e rótulos legíveis de cobertura. Instantes formatados pt-BR explicitamente UTC; não são timezone clínico nem base para idade/população.

TDD novo:83testes,82PASS/1RED por macros ausentes; versão final84/84PASS. Typecheck/lint afetados PASS Node22. Matriz browser final12cenários:11PASS e1falha de carregamento do console antes da ação; reteste focado2/2 desktop/mobile PASS, sem ampliar timeout nem assumir causa conclusiva da falha anterior. PDF real opt-in gerou2páginasA4, texto selecionável verificado, macros/200kcal/seleção e limitações incluídos; coordenador inspecionou última página e cabeçalhos repetidos sem corte aparente. Isso não comprova AT humana/PDF plenamente acessível. Contexto/fontes/referências completas seguem indisponíveis, sem inferir dados faltantes.

Progresso administrativo atualizado para45,8%: M08 agora PARCIAL na worktree; nenhum gate global encerrado ou alteração enviada. Restam M11/M12 pendentes e demais melhorias parciais, respeitado método fixo. Sem novo push, merge, deploy, migrations externas ou novo CI.

## Proveniência factual e acessibilidade da prévia

Resumo de fontes deriva exclusivamente dos itens congelados incluídos. Projeção por allowlist de tipo TACO/USDA/IBGE/manual/custom, versões numéricas delimitadas quando disponíveis, contagens e até50grupos; itens de grupos adicionais são contados sem expor metadados livres. Hashes, IDs dos itens, nomes livres e catálogo atual não entram no resumo. Origem não significa cobertura de cada nutriente nem autorização de direitos. Versões fora do formato seguro ficam indisponíveis no relatório, sem alterar o registro histórico. Contexto clínico continua não disponibilizado até integração de confirmação autorizada.

Modo interno incluirFontesDoRelatorio não é DTO: controller de consulta comum não o encaminha e mantém projeção anterior. Serviço exige gerenciamento também na chamada direta com modo ativo; relatório continua exigindo ler+gerenciar e carteira. Não há nova consulta nem gravação de contexto, snapshot ou catálogo. Flag enviada no corpo HTTP é recusada.

TDD:2testesRED do resumo → GREEN; backend final30/30 (HTTP, projeções, relatório e fontes), Web85/85; typechecks backend/Web e lint afetado PASS Node22.12/12 browser desktop/mobile PASS com PDF real opt-in, fontes, teste teclado mantendo foco no diálogo e axe da prévia, revogação, cancelamento, resposta tardia e unmount. PDF sintético agora3páginasA4; última página inspecionada pelo coordenador, limitações legíveis. Isso não é AT humana, certificado de PDF acessível ou estudo com pessoas.

R4 independente m08_fontes_review somente estática, sem novos achados bloqueadores no escopo. Revisou autorizacão, enumeração mínima, imutabilidade, limites e reconciliação de contagens; não executou testes/browser/SQL. Não substitui R4 integral FOOD06 ou nova prova de PostgreSQL/RLS. Nenhum novo push realizado. Próximos gates: integração/PG aplicável, revisões UX B/C/segurança do incremento completo, build e PDF/AT integral nos limites possíveis; contexto/fontes científicas DRI ainda bloqueados conforme contratos. Progresso45,8% administrativo, M08 parcial na worktree.

## Gate PostgreSQL e fechamento da revisão do incremento

PostgreSQL15 Testcontainers local:42/42PASS,0SKIPPED, role runtime sem owner/bypass e FORCE RLS. A rota real /relatorio foi incluída no testeHTTP+PG e negou acesso após transferência. Teste específico provou energia100 e fonteTACOversão1 preservadas após item materializado mudar para999; ciphertext do registro permaneceu idêntico. Relatório negou outro paciente, tenant divergente e leitura semgerenciamento. Fixture aplica migration1081 e relações representativas; não é cadeia completa de migrations nem evidência de produção. Nenhuma operação externa executada.

Buildbackend+artefatodist/main.js PASS; buildWeb antes do P2 passou com Node22/webpack e avisosNext existentes. RebuildWeb do código corrigido necessário. Regressão backend completa em execução; sem atribuir PASS antecipado.

R4 integral do incremento factual m08_integral_review, somente estática, encontrou P2: cancelamento no segundo POST pendente ficava desabilitado em mobile. Reproduzido RED com botão Received disabled; corrigido separando ocupado/imprimindo, mantendo Cancelar enquanto reautoriza e bloqueando só após dono de print atribuído. Mensagem NUX orienta concluir/cancelar na janela nativa. Re-revisão favorável sem novos achados concretos e sem testes próprios. Matriz final14/14cenários desktop/mobile PASS, incluindo PDF opt-in e cancelamento do segundo POST pendente. UX B delimitada e manifesto em docs/agents/ux/reports/FOOD06-M08-B-2026-11-05; pacienteN/A, sem B visual própria das personas ou C integral da FOOD06.

Contexto confirmado depende de integração nova na captura, não de inferência no relatório: DTO atual de registro aceita somente origem/seleção; ainda não recebe confirmações. Fonte de nascimento/data civil deve ser obtida pelo servidor sob autorização e timezone clínico do tenant; não aceitar data civil/nascimento arbitrários do navegador. O relatório factual mantém contexto indisponível e não habilita DRI. Essa dependência não foi implementada neste incremento.

## Fechamento local do agrupamento factual

- Backend completo:403suítesPASS/10SKIPPED,4319testesPASS/236SKIPPED. Skips não comprovam bancos/providers; PG42/42 executados separadamente,0skip. BuildNest e verificador dist/main.js PASS.
- RebuildWeb corrigido PASS Node22/webpack,195páginas; avisosNext existentes. Lint afetado, diff-check e scanner local PASS. DomínioWeb85/85 e BFF112/112 do incremento permanecem evidências delimitadas;14browserfinais PASS apósP2, com PDFreal opt-in.
- R4 integral estática do incremento factual reavaliada favoravelmente apósP2, sem execução independente de testes. UXBdelimitada/manifesto arquivados; Bvisual própria das personas, C/R4 integrais da FOOD06 e AT/PDF integral não concluídos.
- Próximo: único envio agrupado necessário ao CI da branch existente. Não herdar CI da base159ced04, nem marcar software completo enquanto restarem requisitos. M08 parcial e45,8% administrativos. Sem autorização/ação de merge, deploy, DDL externo ou ativação de comparadores.

## Estado vigente — envio agrupado e CI manual confirmado

Árvore local d05ee0d3 e commit remoto d04551e0 compartilham a árvore testada6aeecaae250c0f61e52c6a84dddb2cdc85506121. A publicação agrupou28arquivos sem reset, force-push ou descarte. O pai remoto159ced04 foi preservado; os SHAs locais diferem pela ancestralidade, não pelo conteúdo testado.

Consulta nesta retomada confirmou a branch remota emd04551e0, enquanto a API da PR e refs/pull/455/head ainda informam159ced04. Essa inconsistência continua BLOCKED; CI da base não valida M08. A chamada workflow_dispatch por ID retornou HTTP500 anteriormente; o disparo posterior pelo arquivo ci.yml foi aceito e criou o run [42131762437](https://github.com/octanutri-clin/octaclin/actions/runs/42131762437), evento workflow_dispatch, head_sha d04551e08e3a2326b0952dbdbdd729ace4bba2a4.

CI do novo SHA: EM EXECUÇÃO, não PASS. Mobile e gates iniciais de governança passaram na consulta; Backend/Web ainda em execução. Evidência de workflow manual deve ser distinguida da sincronização/checks da PR. Não foram criados commits vazios nem alterados workflows, permissões, estado Draft ou infraestrutura para disparar execução.

Próxima ação: verificar conclusão do run exato, corrigir falhas reproduzíveis se surgirem e reconciliar o HEAD interno da PR sem descarte ou bypass. Atualizações documentais deste checkpoint ficam locais, para agrupamento posterior; não consomem nova rodada de CI. M08 parcial, FOOD06 em45,8% administrativos, direitos/DRI/G06 bloqueados.

Scanners manuais confirmados no mesmo SHA d04551e0: CodeQL42132150892, Semgrep42132154639 e Trivy42132158223 (queued/in_progress na consulta, não PASS). Não substituem Dependency Review/eventos específicos de PR ainda não executados no novo HEAD interno. O ci.yml usa suíte completa em workflow_dispatch, incluindo Backend/PostgreSQL e Demo smoke conforme dependências. Diff-check e scanner local de segredos deste checkpoint documental PASS. Nenhum novo push.

## Correção de linguagem — 2026-11-06

Run42131762437 terminou FAIL: Backend/Web/Mobile PASS; Demo smoke falhou no passo Linguagem e microcopy e PR Gate falhou em consequência. CodeQL42132150892, Semgrep42132154639 e Trivy42132158223 concluíram success no SHA d04551e0. Esses resultados não aprovam a correção posterior.

RED local reproduzido com Node22: test-linguagem-interface.mjs recusou o canário sintético CANARIO_TARDIO_RELATORIO no seletor Playwright. Corrigidas somente as duas ocorrências correspondentes para CANARIO_TARDIO_RELATÓRIO (resposta simulada e asserção negativa); verificador/asserções/políticas preservados. GREEN:8/8 testes da biblioteca e varredura integral de linguagem aprovada, sintaxe do spec, diff-check e scanner local de segredos PASS. Não foi reexecutada a matriz browser nesta correção textual; novo CI exigido.

Worktree anterior preservada. Delta documental já existente consolidado neste envio corretivo, sem mudanças runtime. PR permanece Draft; FOOD06 parcial, direitos/DRI/G06 bloqueados.
