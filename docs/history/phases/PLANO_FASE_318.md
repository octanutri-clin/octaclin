# Fase 318 — avaliação de valor da síntese e do rascunho clínico

> Para execução futura: usar `superpowers:executing-plans`, tarefa por tarefa.
> Planejamento autorizado; implementação, benchmark, instalação de modelos,
> migrations, envio de dados e ativação não autorizados por este documento.

**Objetivo:** medir se assistência à pré-consulta e à redação economiza tempo
sem perder fatos, alterar significado clínico ou diminuir o controle profissional.
**Arquitetura:** baseline determinística e modelos de texto existentes; PoC
sintética separada do runtime; integração no módulo IA e no prontuário somente
após os gates de valor, segurança, direitos e autorização.
**Stack existente:** NestJS/TypeORM/PostgreSQL, BFF Next.js e FastAPI/Pydantic.
**Especificação:** roadmap302–320, PB-25/15/23, Fase241 e decisões abaixo.
**Base observada:** main `8ea67a08`, PR407 mergeada; CI38324741937 SUCCESS,
reconsultados no GitHub em2026-10-13. Branch `docs/fase-318-planejamento`.

## 1. Limites e continuidade

- Fase316 permanece em stand-by; não integrar sua PoC nem requerer seu OCR.
- Fase317 integrada; liberação global ainda pendente de preflight do processo
  e providers. Seu aceite/autorização anteriores permanecem válidos. A318 não
  ativa317 nem depende da participação na comunidade.
- Fase314 factual pode fornecer medidas/snapshots já permitidos. Classificadores
  bloqueados por direitos/G01 permanecem bloqueados; IA não os substitui.
- Nenhum paciente real, segredo, dado clínico ou derivado em pesquisa, fixtures,
  GitHub, logs, prompts desta sessão ou ferramentas externas.
- Sem diagnóstico, prognóstico, prescrição, cálculo novo, alerta de risco,
  publicação automática, portal, áudio, OCR, embeddings, ferramentas do modelo
  ou alteração retroativa do prontuário nesta proposta.
- Risco documental R0; futura integração de PHI/autorização/migration é R4.

## 2. Decisões de produto — separar confirmação de recomendação

| ID | Questão | Proposta preferencial | Estado |
| --- | --- | --- | --- |
| D01 | Fluxos a avaliar | Pré-consulta e rascunho de evolução; orientações depois | CONFIRMADA em2026-10-13 |
| D02 | Processamento | Local CPU, somente sintéticos, sem chamadas pagas | CONFIRMADA em2026-10-13, resposta específica318 |
| D03 | Quem gera/confirma | Responsável atual, console, confirmação explícita | CONFIRMADA em2026-10-13 |
| D04 | Contexto selecionável | Prévia dos fatos e seleção explícita; texto da consulta fornecido pelo profissional | PROPOSTA, confirmar com equipe antes do piloto |
| D05 | Rascunho/retencão | Sem persistir rascunho na primeira PoC; produção exige política específica antes de schema | PROPOSTA TÉCNICA, decisão pendente antes de integração |
| D06 | Aceite da avaliação de valor | Equipe clínica revisa os casos sintéticos e mede tempo/correções | PENDENTE; não atribuir validação ao agente |

D01–03 confirmadas pelo proprietário em2026-10-13. Perguntas D04–05 enviadas;
respostas atualizam esta matriz antes de fechar o contrato executável. Os limites abaixo são propostas
para a avaliação, não aprovação clínica, jurídica ou de implementação.

## 3. Gaps confrontados com código

| Gap | Evidência real | Consequência / menor solução |
| --- | --- | --- |
| GAP01: baseline existe | `servico-pacientes.ts:1220`, `prontuario-paciente.tsx:1309`, testes PB-25 | Comparar com preparação existente; não recriar como novidade de IA |
| GAP02: primeira consulta / cobertura | preparação undefined sem atendimento concluído; contadores sobre arrays carregados | Não inventar encontro anterior nem declarar cobertura integral; medir paginação/limites por fonte |
| GAP03: redação manual/modelos existem | `ServicoModelosEvolucaoClinica`, `modelos-evolucao-clinica.ts`, UI aplica ao formulário | Baseline também inclui template preenchido; texto livre continua disponível |
| GAP04: não existe LLM integrado | FastAPI tem sentimento/reconhecimento heurísticos; schemas e Bearer | Não chamar heurística de síntese; escolher artefato somente com evidência/licença/hardware |
| GAP05: fronteiras temporais | `ServicoIa.analisarSentimento` autoriza antes do await e salva depois; novo contexto não existe | Não copiar esse fluxo para318; validar vínculo/sessão/gate antes e depois, rejeitar resultado obsoleto |
| GAP06: confirmação não é idempotente por contrato | `criarEvolucaoClinica` faz save direto, DTO sem nonce; limite6000/título180 | Não prometer assinatura digital/imutabilidade nem replay seguro do manual; desenhar confirmação318 com ledger/referência atômicos se houver persistência |
| GAP07: provenance específica ausente | evolução tem autor/consulta opcional/texto cifrado, não modelo/contexto/versão318 | Decidir registro mínimo cifrado de origem; migration aditiva só após necessidade demonstrada |
| GAP08: gate legado é abrangente | flags conhecidas `ia.clinica` e `mobile.sync`; não há gate318 | `ia.clinica=true` não pode ativar318 implicitamente; gate318 literal/piloto específico se GO |
| GAP09: evidência de qualidade/CPU ausente | nenhuma síntese318, modelo, benchmark ou avaliação clínica presente | G01/G02 BLOCKED; medir antes de integrar |
| GAP10: autorização legado não equivale ao escopo novo | ControladorIa permite SuperAdmin/Professional; listagens ORM existentes | Novas projeções allowlist e papel D03 no serviço; preservar legado sem estender permissões |

As referências são anchors da base acima; executores devem reconferir linhas e
contratos. GAP05/10 descrevem diferenças que o novo fluxo precisa tratar; não
constituem nesta rodada exploração ou correção geral do módulo legado.

## 4. Contrato da avaliação e fontes mínimas

A. Pré-consulta: fatos com data/origem, desde último atendimento concluído;
sem esse marco mostrar primeira consulta/sem histórico. Seleção limitada e
explícita: resumo factual existente, até3 evoluções privadas recentes escolhidas
pelo profissional e medidas factuais selecionadas. Exames/planos só entram após
fechar projeção e direitos do conteúdo; não carregar respostas/mensagens inteiras
por consequência de um contador. Fontes não selecionadas ficam excluídas.

B. Rascunho: texto explicitamente registrado pelo profissional para a consulta,
mais contexto selecionado. Não converter hipótese/negação em fato; não tratar
narrativa gerada como evento ocorrido. Tipos existentes: consulta, retorno,
observação e ajuste_plano; eventual orientação depende de D01.

C. Contrato sintético proposto, compartilhado por baseline e candidato:
`ContextoSintetico318 {versao:1, modalidade:'pre_consulta'|'evolucao', fontes:[{ref,tipo,data,texto}],
textoProfissional?, cobertura:{limites,omitidos}}`.
`SaidaSintetica318 {versao:1, itens:[{texto,refs:string[]}], limitacoes:string[]}`.
Tipos de fonte na primeira proposta: preparacao, evolucao, medida; flags e
contagens são fatos, não inferência de adesão ou risco.
Refs são chaves locais sintéticas/ opacas na avaliação, não IDs reais enviados
para modelo externo. Pydantic extra=forbid; limites no backend e microserviço;
refs desconhecidas, schema inválido ou resposta acima do limite rejeitados.

Limites iniciais de engenharia:20 itens de fonte,12.000 caracteres de entrada,
6.000 de saída, título180 se utilizado. Mostrar qualquer truncamento; não cortar
silenciosamente números/unidades ou ocultar fontes. Não interpolar classificação
314 bloqueada, não recalcular indicadores e não usar score de confiança inventado.
Cada afirmação deve apontar a uma fonte; essa ligação não prova correção semântica.

O pipeline não executa instruções presentes em notas, anexos ou saída do modelo.
Testar prompt injection, HTML/script, links, pedidos de buscar outro paciente,
exfiltração, saída incompatível e invenção de fontes. Texto puro/escape na UI.
Não renderizar HTML/Markdown não sanitizado nem oferecer ferramentas ao modelo.

## 5. Protocolo de valor antes de integração

Proposta:30 casos inteiramente sintéticos, congelados antes de avaliar. Cobrir
primeira consulta, ausência de dados, histórico extenso/limite, conflito entre
fontes/datas, gestação, pediatria factual, adultos, negação, unidade/decimal,
conteúdo adversarial e troca de contexto. Corpus idêntico nas alternativas.

1. Comparar A preparação/modelo atual, B composição determinística melhorada e
   C candidato generativo local (D02). Não penalizar a baseline artificialmente.
2. Rubrica prévia de fatos obrigatórios, fatos proibidos, fontes e afirmações
   sem suporte; aceitar desconhecido/ausente quando a fonte não permite concluir.
3. Barreiras propostas: zero fabricação de fato crítico, zero inversão de
   negação/unidade e zero omissão de fato obrigatório no corpus;100% de refs
   resolvidas e saídas estruturalmente válidas. Não são prova de segurança universal.
4. Tempo inclui leitura, correção e confirmação, não só geração. Propor ganho
   mediano>=20% em tarefas pareadas, sem piorar os critérios de qualidade; equipe
   define/revisa o alvo e rubrica antes dos ensaios. Registrar dispersão/outliers.
5. Medir hardware real da PoC, RAM pico, CPU, cold/warm, latência p50/p95,
   concorrência e taxa de abandono. Alvo inicial p95<=30s, timeout máximo60s;
   compatibilidade com timeout legado15s precisa ser tratada, não ocultada.
6. Revisores humanos e ordem de apresentação devem ser registrados. Execução e
   revisão pelo mesmo agente não são validação clínica nem revisão independente.
7. Pré-registrar modelos/versões, hash, seed quando suportada, quantização,
   prompt/transformação e critérios. Não ajustar rubrica para transformar FAIL
   em PASS; nova hipótese implica nova rodada identificada e evidência preservada.

Sem ganho mensurável: recomendar NO-GO para IA e preservar baseline. Resultado
indeterminado/sem revisão humana é BLOCKED; não declarar sucesso por matemática
plausível ou aparência do texto. Não executar benchmark neste planejamento.

## 6. Pesquisa de motor e direitos

Ainda não há modelo aprovado, download autorizado ou desempenho demonstrado.
A shortlist futura deverá conferir no fornecedor original: licença de pesos,
código/runtime e quantização; restrições comerciais/saúde/distribuição;
procedência, versão imutável/hash e manutenção. Registrar cada licença separada.
Não inferir licença de pesos pela licença do servidor de inferência.

PoC local isolada não implica serviço seguro para PHI em produção. Exigir rede
privada/autenticação, timeout/fila limitada, ausência de logs de prompts/respostas,
não treinamento/retenção indevida, egress controlado, threat model e operação.
Fornecedor externo, se D02 mudar, exige finalidade/base legal, região, contrato,
retenção/suboperadores e aprovação responsável; somente sintéticos nesta pesquisa.
Não introduzir dependência, baixar modelos nem contratar provider nesta rodada.

## 7. Arquitetura candidata após GO — não executar agora

- Reusar ExecutorTenant, criptografia, guardas, auditoria redatada, wrappers BFF,
  padrões FastAPI e formulário de evolução. Serviço318 pequeno no módulo IA;
  não ampliar ServicoIa nem criar nova aplicação de prontuário.
- Proposta de API após GO: POST `/ia/pacientes/:id/sintese-pre-consulta` e
  POST `/ia/pacientes/:id/rascunho-evolucao`, Professional + ia.executar e
  pacientes.gerenciar; backend valida responsável atual/ativo. Sem acesso novo
  de SuperAdmin ao conteúdo318. Confirmação só fecha após D05; manter separada
  da rota manual e reaproveitar sua construção clínica.
- As fontes são montadas pelo servidor conforme papel/permissão/tenant/paciente;
  nunca aceitar tenant, prontuário integral ou IDs arbitrários como contexto confiável.
- Não segurar transação/lock durante inferência. Capturar versão/fingerprint
  autorizado e, no retorno, revalidar sessão, responsável, arquivamento, fontes,
  gate e geração monotônica do contexto; retorno A→B→A também invalida.
- Hash de snapshot cifrado identifica conteúdo, não assinatura nem anonimização.
  Fonte/modelo/base alterados entre prévia e confirmação =>409/refazer conferência.
- D05 é checkpoint obrigatório: se rascunho persistir, TTL, purge, leitura,
  revogação, idempotência e FORCE RLS devem ser definidos antes da migration.
  Não copiar a retenção90dias da comunidade para dado clínico.
- Confirmar não publica no portal; visibilidade privada. Profissional edita e
  confirma; aprovação318 deve chamar a mesma construção clínica de evolução na
  mesma transação, sem duplicar criptografia ou simular aprovação no frontend.
- Ledger de confirmação somente se necessário e aprovado: UUID, fingerprint
  cifrado, CAS, unique e ponteiro da evolução criados atomicamente; retry idêntico
  devolve mesmo ID, divergente409. Transferência/role/gate revalidados antes do replay.
- Nova migration, se indispensável, numeração livre reconferida em opcoes-typeorm;
  nunca editar1070 ou presumir número1071 disponível. Aplicação externa separada.
- BFF private,no-store inclusive erros, sem URLs clínicas, tokens no navegador,
  cache persistente ou telemetria de texto. Cancelamento/abandono/mudança de
  paciente ignora respostas tardias e limpa seleção/editor.
- Rollback desliga318 sem desativar funcionalidades IA legadas; mantém evolução
  confirmada/provenance e leitura; expira rascunhos conforme política aprovada.

## 8. Gates individuais

| Gate | Estado observado | Condição de saída |
| --- | --- | --- |
| G00 base / gaps | PASS para inspeção | main8ea67a08 e contratos localizados; alteração principal preexistente preservada |
| G01 valor | BLOCKED | corpus/rubrica congelados, comparação pareada e decisão humana GO/NO-GO |
| G02 clínica/privacidade/direitos | BLOCKED | D01–06, responsável revisor, licença e finalidade/base legal do piloto |
| G03 técnica/segurança | SKIPPED | implementação autorizada; testes reais de tenant/carteira/RLS/replay/contexto/CPU |
| G04 CI/interface | SKIPPED | testes/builds/BFF/Playwright/a11y/scans do HEAD de implementação |
| G05 operação | BLOCKED | provider/piloto/configuração/retencão e autorização operacional explícitos |

CI da317 não fecha nenhum gate de implementação318. Nenhuma migration ou
configuração externa foi consultada/alterada nesta análise318.

## 9. Modelo suficiente e handoff

Planejamento/segurança e futura integração R4: GPT-6.1 Sol médio. Luna alto é
suficiente para preparar fixtures sintéticas/rubrica mecanizada e UI isolada
com contratos fechados; não delegar ao Luna sozinho decisões de PHI, licença,
concorrência ou ratificação clínica. Se o ganho de dividir não compensar contexto
novo, manter Sol médio na integração. Não houve troca/modelo delegado nesta rodada.
Antes de qualquer transição manual, informar alvo e pausar; autorização desta
etapa é só planejamento. Checklist e interfaces condicionais: tasks/todo-fase-318.md.

## 10. Verificações desta etapa

Executados: leitura de AGENTS/regras/políticas e contratos relevantes; Git
status/branch/HEAD/worktree/fetch/diff; inspeção das fases241/271/272/274 e dos
serviços/formulários atuais; consulta GitHub407/CI38324741937; verificação dos
links locais dos seis documentos de handoff/plano/checklist e git diff --check
(PASS). Scanner de secrets PASS: nenhum secret real identificado pelos padrões locais.

Não executados: testes de implementação318, benchmark, instalação/download de
modelos, comparação externa, avaliação clínica humana, migrations, consultas
operacionais318, deploy/merge/flags. Modelos e direitos continuam não verificados.
Não abrir PR exclusiva de documentação; commit local acompanha futura entrega.
