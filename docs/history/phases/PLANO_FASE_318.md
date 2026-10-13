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
Contrato fechado de planejamento: [CONTRATO_OPENAI_BYOK_FASE_318.md](../../product/CONTRATO_OPENAI_BYOK_FASE_318.md).
Revisão humana proposta: [CORPUS_REVISAO_FASE_318.md](../../product/CORPUS_REVISAO_FASE_318.md).
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
| D02 | Processamento | API externa com chave própria do nutricionista | NOVA DECISÃO em2026-10-13; substitui a preferência local CPU; OpenAI confirmada; chave individual e habilitação pela clínica confirmadas |
| D03 | Quem gera/confirma | Responsável atual, console, confirmação explícita | CONFIRMADA em2026-10-13 |
| D04 | Contexto selecionável | Prévia/seleção explícita de resumo factual, medidas e até3 evoluções; sem identificadores desnecessários | CONFIRMADA; equipe revisará finalidade/base legal e condições do fornecedor antes do uso real |
| D05 | Rascunho/retencão | Apenas na tela, limpar ao sair/trocar de paciente; sem salvar rascunho | CONFIRMADA em2026-10-13; só evolução confirmada entra no histórico |
| D06 | Aceite da avaliação de valor | Proprietário/equipe clínica revisarão30casos e tempo de correção | RESPONSABILIDADE CONFIRMADA; revisão ainda não executada |
| D07 | Modelo/consumo | Seleção num catálogo aprovado, com padrão econômico e limites de chamadas/tokens | CONFIRMADA em2026-10-13; modelos/preços/qualidade ainda devem ser verificados |

D01/D03 confirmadas em2026-10-13. D02 atualizada depois: API externa com chave própria;
a preferência anterior local CPU foi substituída e permanece como histórico. D04–07 confirmadas, incluindo revisão humana a ser realizada.
Não há pergunta de produto pendente; revisão efetiva e autorizações futuras continuam separadas. Os limites abaixo são propostas
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
| GAP09: evidência de qualidade/custo ausente | nenhuma síntese318, modelo, benchmark ou avaliação clínica presente | G01/G02 BLOCKED; medir antes de integrar |
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
   C candidato generativo do fornecedor escolhido (D02). Não penalizar a baseline artificialmente.
2. Rubrica prévia de fatos obrigatórios, fatos proibidos, fontes e afirmações
   sem suporte; aceitar desconhecido/ausente quando a fonte não permite concluir.
3. Barreiras propostas: zero fabricação de fato crítico, zero inversão de
   negação/unidade e zero omissão de fato obrigatório no corpus;100% de refs
   resolvidas e saídas estruturalmente válidas. Não são prova de segurança universal.
4. Tempo inclui leitura, correção e confirmação, não só geração. Propor ganho
   mediano>=20% em tarefas pareadas, sem piorar os critérios de qualidade; equipe
   define/revisa o alvo e rubrica antes dos ensaios. Registrar dispersão/outliers.
5. Medir tokens/consumo estimado e retornado pelo fornecedor, latência p50/p95,
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

OpenAI escolhida pelo proprietário. Modelo/catálogo, contrato revisado, credencial
de teste e desempenho ainda não comprovados.
A escolha BYOK não autoriza o agente a fazer chamadas pagas ou enviar PHI.
A avaliação OpenAI deverá conferir documentação/termos oficiais da API, modelo
permitido e sua versão quando disponível, limites, preços datados, região,
retenção e políticas de dados. Não há necessidade de baixar pesos ou aprovar
licença de runtime local nesta alternativa. A decisão local anterior fica como
histórico; não manter uma segunda integração de inferência por consequência.
Não confundir preço/licença de assinatura de chat com acesso e faturamento da API.

PoC sintética não implica serviço seguro para PHI em produção. Exigir rede
privada/autenticação, timeout/fila limitada, ausência de logs de prompts/respostas,
não treinamento/retenção indevida, egress controlado, threat model e operação.
O fornecedor externo escolhido exige finalidade/base legal, região, contrato,
retenção/suboperadores e aprovação responsável; somente sintéticos nesta pesquisa.
Não introduzir dependência, baixar modelos nem contratar provider nesta rodada.

### Atualização BYOK — chave própria do profissional

A solicitação de2026-10-13 substitui local CPU por credencial externa cadastrada
pelo nutricionista. Confirmadas: OpenAI; chave individual não compartilhada;
integração habilitada pela clínica; cobrança na conta do profissional; contexto
mínimo com prévia/seleção. Equipe assumiu revisar finalidade/base legal e fornecedor,
sem declarar revisão concluída. D05–07 confirmadas; revisão efetiva do corpus/contrato/modelos ainda pendente. Não confundir conta de chat com faturamento da API.

Recomendações técnicas, ainda sem implementação:

- Cadastro HTTPS autenticado; valor nunca em URL/localStorage/analytics/logs,
  fila, auditoria ou resposta de leitura. Backend retorna apenas estado/provider,
  nunca chave em claro, ciphertext ou hash público da credencial.
- Chave cifrada no servidor, vinculada ao tenant e ao profissional autenticado;
  gestão própria com substituição/revogação. Impersonação de SuperAdmin não
  autoriza ler/testar/usar a chave; opção de chave da clínica exige contrato próprio.
- Criptografia/rotação/backup seguem serviços/políticas atuais; separar credenciais
  de IA_SERVICE_TOKEN. Não inserir chave de API nos envs globais do backend.
- Somente endpoints oficiais allowlist do fornecedor escolhido; nenhuma URL
  arbitrária configurável, redirect, ferramenta ou transporte a terceiros implícitos.
- Chamadas pagas apenas por ação explícita do usuário autorizado; cache/retry
  não reutiliza conteúdo entre pacientes/profissionais. Falha incerta não dispara
  retry pago automático; mostrar consumo conhecido/estimado como tal.
- Modelo permitido, limite de tokens e quotas por profissional; catálogo de preço
  datado e limites de estimativa. Limite local não é garantia do saldo/fatura do
  fornecedor; cobrar na conta externa não elimina custo nem obrigação da clínica.
- Revalidar versão/revogação da chave e vínculo do profissional antes da chamada
  e do retorno; revogação não pode desfazer dados já enviados ao fornecedor.
- Testar contrato local sem credenciais reais; teste real com sintéticos só por
  configuração segura e orçamento autorizado, sem chave nesta conversa.
- Uso com pacientes exige aprovação do fornecedor/finalidade/base legal e
  condições de retenção/treinamento/região/suboperadores. Remover nome não
  anonimiza narrativa clínica. Chave própria não autoriza compartilhar PHI.

### Fontes oficiais OpenAI consultadas em2026-10-13

- [Data controls](https://developers.openai.com/api/docs/guides/your-data), HTTP200:
  a API não usa entradas/saídas para treinamento por padrão, salvo opt-in;
  logs de abuso podem conter conteúdo e são retidos por até30dias, com exceções
  descritas. Zero Data Retention/Modified Abuse Monitoring exigem aprovação
  e têm condições por endpoint. Não prometer retenção zero por store=false.
- [API key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety),
  HTTP200: chave individual, backend seguro, acesso/rotação; compartilhamento
  de chaves é vedado segundo o guia. Chave não compartilhada entre profissionais
  é necessária, mas não prova autorização de custódia por SaaS terceiro.
- [Services Agreement](https://openai.com/policies/services-agreement/), HTTP200
  por redirect oficial de business-terms: seção3.3(g) restringe compra/venda/
  transferência de chaves a terceiros; seção5.3 incorpora DPA; seção5.4 trata
  PHI/HIPAA/Healthcare Addendum e serviços elegíveis. Não inferir que a exigência
  HIPAA se aplique automaticamente a toda clínica brasileira, nem dispensar
  LGPD por isso. A equipe responsável precisa verificar o contrato aplicável,
  custódia BYOK e finalidade antes de liberar dado real.

Esses são fatos documentais e pontos para revisão, não parecer jurídico nem
conclusão de que BYOK é autorizado/proibido em todos os casos. Respostas do
proprietário aprovam o desenho do produto, não encerram essa verificação.
Evidência de consulta/hash: docs/product/FONTES_OPENAI_FASE_318.json.

## 7. Arquitetura candidata — desenvolvimento só após autorização; uso clínico após GO

- Reusar ExecutorTenant, criptografia, guardas, auditoria redatada, wrappers BFF
  e formulário de evolução. O adaptador OpenAI fica no backend, sem encaminhar
  chaves individuais ao FastAPI legado ou ao navegador. Serviço318 pequeno no módulo IA;
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
- D05: rascunho não persiste; chave, ledger/provenance e geração de vínculo
  são necessidades diferentes. Conferir schema mínimo e retention do metadata
  antes de migration. Não copiar90dias da comunidade para conteúdo clínico.
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
| G02 clínica/privacidade/direitos | BLOCKED | D01–07 registradas; concluir revisão humana/contratual/custódia BYOK, finalidade/base legal e condições do piloto |
| G03 técnica/segurança | SKIPPED | implementação autorizada; testes reais de tenant/carteira/RLS/replay/contexto/credencial/custo |
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


## Consolidação final do planejamento — 2026-10-13

D01–07 confirmadas; Fase318 mantida por decisão do proprietário, Fase316
permanece stand-by. ContratoBYOK e corpus documental30casosREV0 preparados.
Não há pergunta genérica de produto pendente. Revisão humana ainda não executada,
modelos/preços e condições da API ainda não aprovados; gates correspondentes
permanecemBLOCKED. Corpus documental não é benchmark nem resultado da PoC.

Desenvolvimento técnico futuro pode avançar isolado após autorização específica,
com mocks/sintéticos e bloqueio efetivo no backend. GO de qualidade/contrato é
condição de uso clínico e não aprovação atribuída ao agente. Teste real da API
continua dependente de chave por canal seguro e orçamento autorizado; não enviar
chave nesta conversa. Nenhuma dessas autorizações foi inferida de “continue”
no planejamento. Próxima entrega prevista: implementação técnica única/Draft,
Sol6.1 médio suficiente; sem transição de modelo necessária para o núcleoR4.
