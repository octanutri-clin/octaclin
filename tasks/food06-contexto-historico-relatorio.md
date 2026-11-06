# FOOD06 — contexto histórico e relatório formato2

## Estado vigente — 2026-11-06
Incremento sobre e67ec236bd97b7409677dc2589d0334767f5e310, base com CI42228544631 concluído success. PR455 Draft. Novo delta com gates locais abaixo; seu CI ainda deve ser conferido no HEAD enviado. FOOD0645,8% administrativos, M05/M08/M10 parciais. Direitos/DRI/G06 bloqueados. Nenhuma escrita em staging/produção, merge, deploy ou migration externa.

## Contratos e reaproveitamento

- Histórico mantém resposta anterior por padrão; incluirContexto booleano opcional solicita resumo versionado. Null/string/número inválidos são rejeitados no DTO e serviço. Toggle reinicia itens/cursor/paginação e próximas páginas conservam a flag. Sem flag não transportar campo novo a clientes com parser antigo estrito.
- POSTrelatorio conserva formato1 por padrão. Novo DTO aceita somente versaoRelatorio=2 quando presente;1/3/null/string/bool são inválidos na negociação HTTP. Serviço interno aceita1|2. Nenhuma rota paralela ou tabela nova.
- Formato2 retorna schemaVersao2/motor food06-relatorio-factual-v2 e contextoClinico resumo_documentado ou nao_registrado. Resumo é cópia por allowlist da projeção congelada, sem nascimento bruto, elegibilidade, hashes ou lookup de cadastro atual. Leitor exige que a resposta tenha exatamente o formato solicitado. Sem fallback/retry silencioso para versão diferente.
- Reutilizados serviço/carteira/tenant/ExecutorTenant/decifragem/registro imutável, BFFbody privado16KiB, projeção mínima da captura, parser nutricional, modal/printscope/reautorização existentes. Extrair projeção contextual comum evitou duplicar sua seleção; parser/render compartilhados histórico/PDF não calculam elegibilidade nem nutrientes.
- Contexto disponibilizado somente após opt-in no histórico; ação identifica análise e inclusão de contexto. Legado com marcador mas sem resumo informa detalhes indisponíveis, sem inferir respostas negativas. PDFmostra data civil original/idade/população quando registradas/tabagismo/motivos e ressalva de época, sem condições atuais presumidas. Nada enviado automaticamente ao portal/paciente.
- Imprimir solicita novamente mesmo registro/formato e compara todos os dados de apresentação, ignorando somente geradoEm. Mudança contextual, formato inesperado ou acesso revogado remove a prévia e não inicia impressão.

## RED/GREEN e achados

1. RED2FAIL/23PASS nas duas suítes backend: formato2 ainda retornava formato1 e DTO recusava negociação. GREENfinal33/33 em3suítes (HTTP, relatório, projeção), incluindo role somente leitura negada na exportação contextual.
2. REDWeb2FAIL/87PASS: leitor formato2 e contexto ainda ausentes. GREENfinal92/92 nas suítes de domínioWeb; datas civis inválidas, campos extras/nascimento, motivos desconhecidos/duplicados e contextos não solicitados falham fechados. Cliente preserva zero/desconhecido e só faz validação de contrato.
3. REDbrowser: opção de carregar contexto inexistente. Primeiras provas novas precisaram ajustar a fixture: StrictMode pode iniciar leitura abortada, então reautorização é contada após prévia pronta; seletor de alerta deve identificar mensagem em vez do anunciador vazio do Next. Em403o aviso está no painel de acesso após unmount da prévia; teste verifica esse aviso, ausência dos dados e print0. Nenhuma redução de assert de autorização/formato, timeout ou segurança.
4. REDde allowlist: helper puro recebendo projeção adulterada propagava campos livres no resumo v2. Serviço já gerava projeção correta; reforço reconstrói o resumo campo a campo, com teste negativo nascimento/CANARIO, sem confiar em tipos TypeScript.
5. REDreal401paginação: rowantiga permanecia visível após sessão negada (esperado0/recebido1). Corrigido ramo401/403/404: limpar itens/cursor/temMais/modal e invalidar acesso. Reteste específico2/2 desktop/mobile PASS após limpeza integral.
6. Uma execução PG atingiu snapshots corrompidos intencionalmente por outros testes e falhou422 corretamente. Caso contextual passou a usar paciente sintético próprio; casos de corrupção e asserts mantidos. Não afrouxada a validação para obter verde.

## Matriz executada

| Verificação | Resultado / limite |
|---|---|
| Backend focado |33/33PASS; autorização/DTO/versões/allowlist/legado |
| PostgreSQL15 Testcontainers |44/44PASS,0skip, runtime não owner/nobypass+FORCERLS, histórico opt-in/default, relatório1/2, fonte cifrada/imutabilidade após mudança de cadastro/dia e transferência negando leitura. Fixture representativa+migration1081, não cadeia completa ou produção |
| Webdomínio |92/92PASS; parser e negociação |
| BFF |115/115PASS; flags/versão só no body, no-store, destino/autorização/limites/erros existentes |
| Browser final conjunto |28/28PASS desktop/mobile: novos14contextuais +14legados de relatório, incluindo8PDFsreais opt-in. Reteste4012/2 adicional não somado como cenário novo |
| Acessibilidade delimitada |Tab/Enter em detalhes, axe no histórico/relatório; não é leitor de tela humano ou certificação PDF |
| PDFreal |Chromium tagged=true, pdftotext; contexto/data e exclusão de canário de outra folha/nome sintético/botões. PDFcontextual3A4, primeira/última páginas renderizadas e inspecionadas pelo coordenador, não inspeção humana integral de todas as páginas |
| Node22 |Typechecks backend/Web e buildsNest+dist/main.js/Nextwebpack195páginas PASS; avisosNext preexistentes |
| Governança local |LintWeb afetado, linguagem8/8+varredura integral PASS; diff-check e scanner de segredos antes do envio |
| R4 independente |Estática do incremento e re-revisão401/allowlist favoráveis, /root/food06_contexto_fundamento_r4; não executou testes/SQL/browser e não antecipou401 ausente no parecer anterior |
| UX |A/Btextuais com papel explícito, observações reais fornecidas pelo coordenador; sem ferramentas/visão própria das personas, pacienteN/A, C integral FOOD06 pendente |
| Backend completo/CI do novo delta |NOTRUN local antes do envio; verificar novo HEAD, sem herdar verde da base |

Identidade JWT foi simulada nos testes HTTP; guardas de papel/permissão, transação, cifragem e banco foram reais nos cenários correspondentes. Isso não comprova login/validação criptográfica de JWT ou provider externo nesta rodada.

PDFopt-in exige FOOD06_PDF_REAL=true e pdftotext; no CI sem opção esses casos são SKIPPED, não PASS. R4/UX desta tabela não encerram a revisão integral da FOOD06 ou ratificação clínica/jurídica.

## Reprodução e compatibilidade
Node22.21.1, dependências existentes, sem instalação nova. Jest focado: relatorio-analise-factual.spec.ts, projecao-registro-factual.spec.ts e controlador-registros-factuais.http.spec.ts. PG: FOOD06_REGISTRO_TESTCONTAINERS=true na suíte1720000001081-RegistrosAnalisesFactuais.integracao.spec.ts, somente instância local descartável. Web: scripts/test-calculo-combinado-planos.mjs e test-planos-alimentares-bff.mjs. Browser: food06-contexto-historico.spec.mjs + casos relatório/PDF/cancelamento de food06-tabela-factual.spec.mjs; baseURLlocalhost deve corresponder aos cookies sintéticos da fixture.

Backend novo conserva contratos default para clientes anteriores; parsers v1 não recebem campo novo do histórico por padrão. Frontend novo usa opt-in somente quando escolhido; backend anterior pode rejeitar recurso novo400, sem downgrade/impressão de conteúdo não conferido. Fluxos anteriores continuam com pedidos sem flags. Compatibilidade é de contratos exercitados/inspecionados, não ensaio operacional de versões antigas completas.

Rollback deste incremento não exige apagar registros ou desfazer schema: só leitura/projeção novas, envelope gravado permanece v1/v2 existente. Se backend for revertido com modal contextual aberto, nova conferência pode falhar; não imprimir sem reautorização. Ordem operacional backendantesfrontend/reversão deve ser validada em G06 autorizado, sem assumir que rollback de código restaura dados.

## Próxima ação
Enviar checkpoint à PR455 Draft e verificar CI/scanners no SHAexato. Depois auditar catálogo e restrições estruturadas para avançar M11 (sugestões por composição conhecida, sem prescrição/aplicação automática), reutilizando PA06 e contratos aprovados; M12 continua obrigatório. Direitos/referências científicas e acessibilidade/UXC/R4 integral permanecem gates separados. Sem merge/deploy/migrations externas/FOOD05-MDL.
