# Roadmap de produto após a Fase 302

Atualizado em 2026-10-10. Fases 309/310 integradas pelos PRs #386/#388
(`34d186ec`/`eb7f2aad`), confirmadas no GitHub neste ciclo. CI principal
pós-merge 309 e CI de PR 310 aprovados, incluindo Demo local smoke;
PostgreSQL/Testcontainers da PR 310 aprovado. CI principal pós-merge 310
`38016413569` SUCCESS; scanners pós-merge aprovados.
Migrations 1065/1066 integradas no código, sem prova de aplicação operacional
neste ciclo. Fase 311 integrada pelo PR #389 (`f5f9ba84`), CI final da PR
`38022212900` e principal pós-merge `38042089805` SUCCESS. Fase 312 com
planejamento/decisões fechados, sem implementação. Plano e handoff em
`docs/history/phases/PLANO_FASE_312.md` e `tasks/plan.md`.
Este é o plano **vigente** para as recomendações ainda abertas de
`OCTACLIN_PRODUCT_FEATURE_AUDIT.md`. O diagnóstico de 2026-09-17 permanece
histórico; uma descrição antiga de lacuna não desfaz uma entrega posterior.

## Como executar e manter

- Seguir a ordem numérica, salvo nova decisão explícita do proprietário. A fase
  ativa em planejamento é a **312**; depois de sua integração, a próxima fase é a **313**. Cada fase recebe plano de execução e revisão de gaps
  antes do código; concluir uma não implica iniciar a próxima sem reconciliar
  código, PRs e evidência operacional.
- Implementar cada fatia funcional em sua branch/PR com a documentação
  necessária no mesmo PR. Não abrir PR isolado só para atualizar o estado do
  roadmap após cada merge. Atualizar checklist, status, resumo e esta matriz
  junto da próxima entrega; não declarar produção validada sem prova direta.
- `Planejada` significa escopo priorizado, não código entregue. `Condicional`
  exige decisão explícita e evidência do gate descrito; se o gate negar a
  função, registrar a decisão e avançar sem simular uma implementação.
- Em toda fase com dados clínicos, PII, autorização, tenant, migration ou
  provider, aplicar R4 ou superior: testes positivos e negativos, isolamento
  por tenant e papel, RLS quando couber, rollback, revisão cruzada quando
  viável e execução de migrations somente fora de banda. Usar dados sintéticos.
- A sugestão de modelo/skills é ponto de partida, não substitui a releitura
  das skills, `AGENTS.md`, ADRs e contratos vigentes no início da fase.

## Sequência aprovada para planejamento

| Fase | Entrega e escopo mínimo | Dependência e critério de aceite | Estado |
| --- | --- | --- | --- |
| 302 | **LGPD da própria clínica.** Gestor do tenant lê os pedidos, assume a tratativa e prepara rascunho; SuperAdmin valida estados finais, eliminação e retenção. A descrição livre passa a ser cifrada. | PB-27 e fluxo LGPD existentes. Tenant/papel validados no backend e BFF; migration 1062 e backfill fora de banda antes do aceite operacional. Plano e decisões em `docs/history/phases/PLANO_FASE_302.md`. | Integrada pelo PR #360; aplicação/validação da 1062 relatadas pelo proprietário |
| 303 | **Integrações para profissionais autorizados.** O gestor concede e revoga diretamente escopos de API e eventos de webhook, cada conjunto de forma independente. | Credenciais profissionais ficam vinculadas ao titular e só alcançam pacientes de sua carteira atual; API, idempotência e entregas de webhook devem provar essa restrição. Não conceder papel `Client`. Testar criação, uso, revogação, negações por papel e tenant; payloads externos mantêm o contrato atual. Plano em `docs/history/phases/PLANO_FASE_303.md`; migration 1063 fora de banda. | Integrada pelo PR #361; migration 1063 aplicada e validada em staging/produção conforme relato do proprietário, sem consulta direta neste ciclo |
| 304 | **Adesão longitudinal factual e substituições.** Mostrar ao profissional check-ins declarados, respostas ausentes e escolhas de troca junto da versão publicada do plano; expor na UI a consulta à versão histórica já disponível na API interna. | Não inferir consumo real a partir de uma troca ou ausência de resposta. Restringir por carteira/tenant, distinguir versões e dados faltantes; evitar duplicar a linha do tempo. | Integrada pelo PR #362; sem migration nova |
| 305 | **Questionários e antropometria na mesma leitura longitudinal.** Cruzar visualmente datas de respostas, métricas antropométricas e consultas, reutilizando a matriz longitudinal e séries existentes. | Sem causalidade ou diagnóstico automático; filtros de período, unidades, origem e lacunas explícitos. Permissões clínicas e versão do formulário preservadas. | Integrada pelo PR #379 (`32c2aa5b`); checks obrigatórios passaram e `Provenance do SBOM` `SKIPPED`; sem migration. Plano em `docs/history/phases/PLANO_FASE_305.md` |
| 306 | **Retorno e evasão factuais.** Indicadores agregados de intervalo observado entre consultas, pacientes sem próxima consulta, faltas por horário e tempo de resposta a formulários, para o Painel de Operação do `Client`. Reusar a mediana de até três intervalos da Fase 294. | Denominadores, janela e população explícitos; histórico insuficiente sinalizado; contagens sem pacientes identificáveis; sem diagnóstico nem contato novo. Preserva a trava de contato de 30 dias; sem migration. | Integrada pelo PR #383 (`104a1546`); código coberto pelo CI principal aprovado da integração 307 |
| 307 | **Progresso do paciente além do peso.** Exibir no portal apenas métricas autorizadas e metas/marcos que o profissional escolheu compartilhar, com unidade, data e origem. | Consentimento e acesso do próprio paciente; sem revelar anotações internas ou meta implícita. Ausência de meta aparece como tal; nenhuma comparação clínica automática. | Integrada pelo PR #384 (`04e66efc`); CI principal aprovado, aplicação da 1064 não verificada neste ciclo. Plano em `docs/history/phases/PLANO_FASE_307.md` |
| 308 | **Completar o resumo clínico com exames fora da faixa.** Consumir PB-17 no resumo PB-16, com resultado, unidade, referência e data, limitado à carteira/aba permitida. | Factual, sem interpretação/alerta; último resultado por grupo, livre por nome/unidade/método, 100 coletas/10 destaques com limites explícitos; sem referência válida não classificar, duplicado sem escolha. Regressão negativa de tenant/papel. | Integrada pelo PR #385 (`1dec202f`); CI pós-merge em andamento. Sem migration nova ou aceite de produção. Plano e gaps em `docs/history/phases/PLANO_FASE_308.md` |
| 309 | **Preferências individuais de notificações internas e digest.** Configurar classes opcionais, frequência e resumo sem conteúdo clínico sensível. | Alertas críticos/obrigatórios continuam visíveis; preferências por usuário, deduplicação, fuso e autorização. Não confundir com opt-out de canais externos do paciente. | Integrada pelo PR #386 (`34d186ec`); CI pós-merge `38000687212` aprovado. Aplicação operacional da 1065 não consultada |
| 310 | **Receitas nutricionais organizadas e compartilháveis.** Categorias livres internas e entrega explícita ao paciente de uma versão revisada da receita, no portal seguro; avisos genéricos opcionais por e-mail/WhatsApp/push com consentimento específico. | Não publicar automaticamente todo o acervo; profissional escolhe até 10 itens por paciente e confirma. Cópia/versionamento, permissão, retirada e trilha de leitura sem conteúdo clínico em aviso externo. | Integrada pelo PR #388 (`eb7f2aad`); CI da PR/Testcontainers aprovados; CI principal pós-merge SUCCESS. Aplicação operacional da 1066 não consultada |
| 311 | **Ativação de conteúdo em clínicas existentes.** Client/SuperAdmin instalam itens escolhidos do kit genérico 297 e podem complementar depois; conferência global das quatro bases TACO/USDA/IBGE no onboarding do ambiente. | Opt-in/seleção por clínica; SuperAdmin confirma em nome do alvo; itens instalados não são recriados nem sobrescritos; legado 1 completo e marcador 2 seletivo. Estruturas sem alimentos/revisão profissional; catálogos somente leitura e cargas separadas; pendências não bloqueiam kit. Sem TBCA. | Integrada pelo PR #389 (`f5f9ba84`); CI final e pós-merge SUCCESS. Plano histórico em `docs/history/phases/PLANO_FASE_311.md` |
| 312 | **Documentos clínicos adicionais.** Desenhar e entregar encaminhamento no motor existente; avaliar atestado apenas após validação jurídica do tipo, competência profissional e assinatura exigida. | Sem afirmar que qualquer nutricionista pode emitir atestado médico. Variáveis permitidas, versão imutável, autorização e trilha; se o gate jurídico de atestado negar, registrar exclusão fundamentada e concluir apenas encaminhamento. | Encaminhamento: planejamento fechado, aguardando implementação. Prévia/confirmar pelo responsável atual, snapshot imutável, impressão/PDF do navegador. Atestado aguarda validação específica. Plano `docs/history/phases/PLANO_FASE_312.md` |
| 313 | **Avaliação antropométrica de gestantes.** Regra específica baseada em referência clínica validada, idade gestacional e dados necessários; exibir classificação somente quando o protocolo for aplicável. | Revisão clínica da fonte, limites e ausência de dados; classificação adulta permanece bloqueada para gestantes. Nenhuma inferência a partir apenas do IMC atual. | Condicional à validação clínica |
| 314 | **Avaliação antropométrica de crianças e adolescentes.** Referência etária e por sexo aplicável, percentil/escore quando cabível, com proveniência e cálculo reproduzível. | Revisão clínica/legal do protocolo e dados exigidos; menores de 20 anos não recebem faixas adultas. Casos fora da faixa ou incompletos ficam sem classificação. | Condicional à validação clínica |
| 315 | **Retirada controlada do `score_risco` legado.** Inventariar consumidores, migrar contrato/formulários/fixtures remanescentes e planejar eventual remoção da coluna. | A prioridade calculada da Fase 300 segue **operacional** e fora da API pública. Compatibilidade de clientes e dados históricos verificada antes de migration destrutiva; rollback/limite de não reversão explícito. | Planejada |
| 316 | **PB-30, extração assistida de exames.** PDF/imagem para rascunho estruturado de marcador, valor, unidade e faixa, com confirmação item a item pelo profissional antes de persistir. | PB-17 pronto; antes do código, fechar finalidade/base legal, provider, retenção, local de processamento, custo e antimalware/arquivo seguro. Falha do serviço mantém digitação manual; nunca persistir extração como exame confirmado sem aceite humano. | Condicional aos gates jurídico, privacidade e operação |
| 317 | **Gamificação e comunidade: decisão de propósito e piloto controlado.** Avaliar se badges/desafios existentes ajudam acompanhamento sem pressionar ou expor paciente; implementar apenas desenho aprovado. | Padrão desligado até decisão explícita, opt-in/saída e métricas de dano/benefício; sem ranking clínico ou exposição entre pacientes. Se não houver propósito validado, registrar NO-GO. | Condicional à decisão de produto/clínica |
| 318 | **IA de pré-consulta e rascunho clínico: avaliação de valor.** Comparar preparação determinística PB-25 e templates PB-15/PB-23 com pilotos de síntese pré-consulta e rascunho de evolução/orientação, apenas se houver ganho mensurável. | Gate de PHI/provider e critérios de qualidade/omissão antes de qualquer envio externo; revisão e assinatura humana; sem prescrição ou conduta autônoma. Se a versão determinística bastar, registrar NO-GO. | Condicional |
| 319 | **Busca semântica no prontuário: avaliação e possível piloto.** Medir necessidade frente à busca/linha do tempo existentes; só então desenhar índice isolado por tenant e permissão. | Volume, relevância, minimização de PHI, retenção e custo aprovados; testes de vazamento entre tenant/carteira. Sem evidência de valor/privacidade, registrar NO-GO. | Condicional |
| 320 | **TBCA: decisão de direitos e ingestão.** Obter licença/autorização de redistribuição e referência de versão; se aprovada, adicionar importador próprio à arquitetura multifonte da Fase 299. | Sem carga ou exposição TBCA até comprovação dos direitos. Preservar `source + externalId`, origem e metadados, sem mesclar com TACO/USDA/IBGE; importação versionada, reproduzível e idempotente. Se não autorizada, registrar NO-GO. | Condicional à licença |

## Cobertura das recomendações e limites

| Origem na auditoria | Encaminhamento |
| --- | --- |
| Item 8 da ordem e seção 10: LGPD, API profissional, carga/produtividade | Carga, concluídas e taxa factual: Fase 301 integrada; LGPD 302; API 303. |
| Seções 6, 8 e 11: adesão, substituições, questionários, antropometria, retorno, evasão, progresso | Fases 304–307. Dados factuais, sem score ou diagnóstico novo. |
| Seção 5.3: últimos exames alterados no resumo | Fase 308 integrada: resumo consome PB-17 com agrupamento e limites explícitos. |
| Seções 2–3: preferências/digest, receitas sem categoria e sem entrega | Fases 309–310 integradas; comprovação operacional separada. |
| Seções 2 e 10: onboarding parcial; versões de plano disponíveis sem tela | Kit para clínicas existentes na 311; versão do plano na 304. Catálogos TACO/USDA/IBGE já integrados, com cargas externas relatadas pelo proprietário, não verificadas neste ciclo. |
| Seções 6 e 9 e Fase 286: documentos, IMC gestantes/menores | Fases 312–314, com gates jurídicos/clínicos explícitos. |
| Seções 3, 5.1 e 14: campo de risco manual | Uso operacional resolvido nas Fases 265/300; retirada técnica do legado na 315. Fórmula de **risco clínico** não está autorizada; só reabrir por nova decisão. |
| PB-30, seção 12 e item 9 da ordem | Fase 316. |
| Seções 8, 12 e item 10: gamificação, pré-consulta/rascunho IA e busca semântica | Fases condicionais 317–319. |
| Seção 16: TBCA adiada | Fase condicional 320; sem implementação antes de licença. |

**Já coberto, sem recriar:** ações e gatilhos da automação (PB-02/03/05),
expediente e duplicação de consulta (PB-18/19), comparação de fotos (PB-20),
trilha de auditoria do tenant (PB-27), conversa do paciente (PB-28),
notificações de plano/tarefa (Fases 289/296), materiais visualizados (PB-07),
catálogos TACO/USDA/IBGE (Fase 299) e indicadores por profissional (Fase 301).
Wearables, pagamentos online, assinatura digital, chatbot aberto, push real
genérico para eventos fora de receitas compartilhadas e decisão clínica
autônoma por IA não entram neste backlog sem nova decisão.
O uso e os limites do plano já aparecem no portal do cliente; um novo painel
comercial não é uma lacuna comprovada por esta auditoria. Modelos prescritivos
prontos também não foram aprovados: a Fase 297 adotou estruturas genéricas que
o profissional completa antes de salvar.

## Comprovações operacionais separadas de novas funções

Estas pendências não são novas fases de produto nem prova de que o código falha:

1. Confirmar, por ambiente identificado e role autorizada, aplicação e resultado
   dos procedimentos fora de banda de PB-10 e do backfill opt-in da Fase 287,
   se ainda necessários. As cargas 1060/1061 e catálogos foram relatadas pelo
   proprietário; esta revisão documental não consultou staging/produção.
2. Antes da Fase 316, verificar health, quarentena e disponibilidade real do
   serviço antimalware e o fluxo seguro de upload. A infraestrutura externa
   não é comprovada pela existência do código ou pelo status de uma issue.
3. Manter os gates externos de piloto, segurança e distribuição mobile em suas
   trilhas próprias. `SKIPPED`, relato de aplicação e merge não provam
   operação em produção.

## Reconciliação e handoff em 2026-10-05

**Decisões confirmadas:** a unidade de leitura é a versão publicada do plano,
com janela inclusiva na publicação e exclusiva na publicação seguinte.
Check-ins permanecem declarações do paciente; questionários ausentes são
envios `pendente`, `enviado` ou `expirado`, nunca campos opcionais vazios em
formulário concluído. Envio sem `enviado_em` não é atribuído a uma versão.
Trocas permanecem fatos append-only e não comprovam consumo. O plano completo
e a revisão de gaps estão em `docs/history/phases/PLANO_FASE_304.md`.

**Fase 304:** integrada pelo PR #362, confirmado no GitHub. O plano e os gates
históricos permanecem em `docs/history/phases/PLANO_FASE_304.md`.

**Fase 305:** integrada pelo PR #379 (merge `32c2aa5b`, confirmado no GitHub).
Checks obrigatórios passaram; `Provenance do SBOM` ficou `SKIPPED`. Sem
migration ou prova de produção. Plano e evidências em
`docs/history/phases/PLANO_FASE_305.md`.

**Fase 306 integrada pelo PR #383:** indicadores agregados de retorno, ausência
de consulta futura, faltas por horário e resposta a formulários. Código coberto
pelo CI principal aprovado da integração 307; run histórico da 306 inalterado.

**Fase 307 integrada pelo PR #384:** progresso do paciente além do peso,
limitado a métricas e metas explicitamente compartilhadas. CI principal
`37971450248` aprovado; aplicação da 1064 não verificada neste ciclo.

**Fase 308 integrada:** PR #385, merge `1dec202f` confirmado no GitHub.
CI pós-merge `37987983251` e scanners concluídos com sucesso. Sem migration
nova ou aceite de produção. Monitor produção
`37977323201` falhou em “Saude externa”; causa não diagnosticada e sem vínculo
demonstrado com esta implementação.

**Fase 309 integrada:** PR #386 (`34d186ec`), merge confirmado neste ciclo;
CI principal pós-merge `38000687212` aprovado. Aplicação operacional da
migration 1065 não consultada. Plano em `docs/history/phases/PLANO_FASE_309.md`.

**Fase 310 integrada:** PR #388 (`eb7f2aad`), merge confirmado em 2026-10-10.
CI da PR `38014957842` aprovado, incluindo Governança, Backend, Web e Demo
local smoke; step de PostgreSQL/Testcontainers aprovado. Scanners pós-merge
aprovados; CI principal `38016413569` SUCCESS. `Provenance
do SBOM` `SKIPPED`; aplicação da 1066 e envio real não consultados.

**Fase 311 integrada:** PR #389 (`f5f9ba84`), CI da PR `38022212900` e
principal pós-merge `38042089805` SUCCESS. Revisão independente não comprovada.

**Fase 312 planejada:** seis decisões fechadas para encaminhamento;
responsável atual, prévia/confirmar, snapshot e impressão/PDF do navegador.
Sem código; migration 1067 proposta. Atestados aguardam validação específica.
Plano/gaps em `docs/history/phases/PLANO_FASE_312.md`; handoff em `tasks/plan.md`.
Pausa antes do código para troca manual de Sol médio para Luna alto.
