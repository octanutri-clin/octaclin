# Plano da Fase 305 - leitura longitudinal de questionários e antropometria

## 1. Objetivo e risco

Exibir em uma leitura cronológica única os fatos já registrados em respostas de
questionários e avaliações antropométricas do paciente, para o profissional
autorizado contextualizar o acompanhamento. Esta mudança é R4: inclui respostas
clínicas, medidas protegidas, autorização por tenant/carteira e exibição no
prontuário. A entrega será somente leitura, sem migration, agregação clínica,
inferência causal, classificação nova, alerta ou decisão automatizada.

## 2. Fontes, estado e decisões

- `docs/product/ROADMAP_POS_AUDITORIA_FASES_302_320.md`, Fase 305: cruzamento
  visual de datas, respostas, medidas e consultas; explicitar unidade, origem,
  versões e lacunas.
- `docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`: seção 11 identifica
  respostas longitudinais e série antropométrica como dados já disponíveis;
  não pede um novo mecanismo de coleta.
- Fase 304 está integrada pelo PR #362. Migration 1063 foi informada pelo
  proprietário como aplicada e validada em staging e produção; esta fase não
  consulta os bancos nem repete essa validação.
- Consultas serão exibidas como marcadores temporais já existentes no prontuário;
  não serão usados para sugerir causalidade ou mudança clínica.
- Respostas preservam a versão e os enunciados do `snapshotEstrutura` do envio.
  Sem snapshot, a resposta é identificada como estrutura histórica indisponível;
  não será rotulada com a versão atual do questionário.
- A leitura requer simultaneamente `pacientes.ler` e `questionarios.ler` e
  revalida no backend tenant, papel e carteira profissional. A resposta não
  será incorporada ao endpoint geral do prontuário nem à linha do tempo genérica.
- Cada evento terá data registrada, categoria, origem explícita e unidade
  quando aplicável. Valores nulos/ausentes serão omitidos ou apresentados como
  não registrados, nunca convertidos para zero ou resposta negativa.
- A trilha de auditoria registra o evento sem metadados clínicos, contagens ou
  conteúdo da leitura.
- Sem classificação antropométrica nova: IMC e resultado já gravados podem ser
  mostrados como valores factuais do registro, com protocolo/fórmula e data.
  Este incremento não classifica gestantes, menores ou faixas clínicas.

## 3. Revisão de gaps e soluções

| Gap encontrado | Solução nesta fase | Verificação |
| --- | --- | --- |
| O resumo do prontuário mostra contagens e antropometria separada; não cruza respostas e medidas por data. | Criar endpoint clínico dedicado e seção cronológica na aba Resumo, sem duplicar a timeline genérica. | Teste do contrato ordenado por data e renderização por categoria. |
| O endpoint geral de prontuário tem permissão ampla de paciente e poderia expor respostas a papéis sem acesso a questionários. | Endpoint dedicado protegido por ambas as permissões e validação de paciente antes de qualquer consulta; ocultar a seção no cliente sem `questionarios.ler`. | Testes de permissão negativa no controller e serviço, tenant/carteira. |
| Envio e estrutura do questionário podem mudar após a resposta. | Usar snapshot persistido no envio e expor sua versão; legado sem snapshot recebe estado indisponível, sem fallback para estrutura atual. | Testes para versão histórica, ausência de snapshot e pergunta excluída/alterada. |
| Respostas JSON são heterogêneas e opções guardam valores distintos dos rótulos. | DTO allowlisted por envio/pergunta; mapear valores conhecidos a rótulos históricos, preservar unidade e serializar somente formatos suportados. | Testes para texto, seleção, número, booleano, array e valor inválido/ausente. |
| Antropometria contém medidas e observações cifradas, além de valores derivados. | Reutilizar o mapeador existente, mas projetar apenas campos quantitativos aprovados e unidade; não retornar observações livres, blobs, identidade ou deltas. | Assertivas negativas do DTO e teste de descriptografia/registro ilegível. |
| Listas clínicas sem limite podem causar leitura excessiva; limites separados podem ocultar que o histórico é parcial. | Retornar até 100 eventos por tipo em ordem estável e sinalizador de histórico limitado quando houver mais; nenhuma paginação aberta sem necessidade comprovada. | Teste de limite, ordenação determinística e indicador de truncamento. |
| Um formulário pode ter grande número de perguntas/respostas, ampliando payload e podendo fazer valores omitidos parecerem perguntas não respondidas. | Limitar em 100 perguntas/respostas por formulário; contar valores dentro do tenant e buscar detalhes somente nos formulários dentro do limite. Acima dele, omitir todos os campos desse formulário e sinalizar claramente que não foram classificados como ausentes. | Teste de limite por formulário, prova de que valores não são consultados acima do teto e texto explícito na UI. |
| Datas civis de avaliação e timestamps de resposta podem ser interpretados de forma diferente. | Preservar `avaliadaEm` como data civil e resposta como timestamp ISO; UI identifica o tipo/data local sem converter data civil em instante UTC. | Testes de serialização e data civil no fuso da clínica. |
| Pedido menciona consultas, mas cruzar conteúdo de consulta ampliaria dados e permissões. | Reutilizar somente o marcador/data/tipo da timeline existente já permitida; não retornar conteúdo clínico de evolução nem criar consulta extra. | Testes do DTO sem texto livre e revisão do endpoint. |

### Gaps examinados e explicitamente fora desta fase

- Não há uma relação clínica validada para correlação estatística entre respostas
  e medidas; proximidade temporal não será tratada como causa, adesão, melhora,
  piora ou diagnóstico.
- Protocolos para gestantes e menores dependem de referência clínica validada
  e permanecem nas Fases 313/314.
- Não serão adicionadas metas, comparação automática, alertas, exportação,
  compartilhamento com paciente nem armazenamento em cache persistente.
- Sem migration: entidades e snapshots necessários já existem; se o código
  demonstrar que a integridade do contrato depende de schema novo, parar esse
  subitem e revisar o plano antes de ampliar risco/escopo.

## 4. Desenho de implementação

1. Acrescentar DTO explícito de leitura longitudinal no módulo de pacientes e
   consultas limitadas por `tenantId` e `pacienteId` para envios finalizados,
   valores e avaliações não excluídas. Limitar a 100 eventos por tipo e 100
   perguntas/respostas por formulário, sinalizando corte sem sugerir ausência.
2. Resolver autorização pelo fluxo existente `garantirPacienteExiste` antes das
   leituras, exigindo ambas as permissões na rota; filtrar apenas envios com
   resposta finalizada e vincular resposta, envio e valores pelos IDs/tenant.
3. Mapear snapshots históricos e opções sem consultar texto atual do formulário;
   excluir score de questionário, anotações livres antropométricas e entidades
   ORM do retorno.
4. Expor rota autenticada e BFF allowlisted com `Cache-Control: private,
   no-store`, sem adicionar o payload sensível à resposta geral do prontuário.
5. Renderizar seção “Questionários e medidas ao longo do tempo” na aba Resumo,
   com filtros de período locais, legenda de unidade/origem, estados de vazio,
   dados legados indisponíveis e aviso factual de não inferência. O período
   filtra eventos localmente após receber o limite definido pelo servidor.
6. Reconciliar roadmap, checklist, status, resumo e matriz de confiabilidade no
   mesmo PR, distinguindo merge confirmado da migration 1063 relatada.

## 5. Plano TDD e critérios de aceite

### Backend

- RED: usuário sem `questionarios.ler`, paciente de outro tenant e paciente fora
  da carteira não recebem dados; nenhuma consulta às respostas antes da
  validação do paciente.
- Somente questionários efetivamente finalizados e associados ao paciente são
  projetados; resposta e valores precisam pertencer ao mesmo tenant/envio.
- Snapshot e versão históricos são preservados; legado sem snapshot não usa
  questionário atual.
- Valores opcionais ausentes não viram zero/negativo; score e textos não
  necessários não aparecem no DTO.
- Medidas incluem unidade e data civil; registros excluídos não aparecem; erro
  de descriptografia mantém aviso explícito de ilegibilidade.
- Limites por tipo/formulário, sinalizador de truncamento e desempate
  determinístico são testados; formulário acima do teto não converte dados
  omitidos em perguntas sem resposta.

### Web/BFF

- A rota exige sessão e as duas permissões; rejeita parâmetros não allowlisted
  e aplica `private, no-store`.
- A seção não carrega nem renderiza quando falta permissão.
- Falha de leitura apresenta ação de nova tentativa sem misturar resposta
  antiga ou remover o restante do prontuário.
- Renderização inclui formulário/versão, resposta, valor/unidade, antropometria,
  origem, datas e lacunas; não afirma causalidade nem diagnóstico.
- Filtro de período, loading, erro, vazio, teclado e layouts desktop/mobile
  possuem cobertura automatizada apropriada.
- Respostas concorrentes de pacientes anteriores não podem substituir a leitura
  do paciente atual; nenhum conteúdo é gravado em Cache Storage.

### Documentação/fechamento

- Atualizar os quatro documentos canônicos e o roadmap neste mesmo PR.
- Revisar diff para IDOR, autorização, isolamento, PHI em logs/cache, paginação,
  validade do snapshot e consistência de datas/unidades.
- Nomear cada verificação como PASS, FAIL, NA ou SKIPPED; migration/deploy não
  são executados nesta fase.

## 6. Sequência de tarefas e checkpoints

1. Fechar este plano e validar contratos, permissões e comandos de teste.
2. Testes RED do serviço/controlador para autorização, proveniência, limites e
   valores ausentes; implementar projeção mínima do endpoint.
3. BFF e testes de contrato/headers/autorização.
4. UI com filtro temporal por datas, unidades, estados, nova tentativa e
   proteção contra respostas concorrentes; Playwright focado desktop/mobile.
5. Checkpoint: suítes focadas backend/BFF/UI e typecheck dos pacotes.
6. Rodar suites/gates proporcionais, segurança, linguagem, `git diff --check`,
   `pnpm security:secrets`; corrigir todas as falhas próprias do diff.
7. Revisão final R4 e reconciliação documental no mesmo branch/PR.

## 7. Risco, rollout e rollback

Risco R4 devido à exposição de PHI. Tenant vem somente da sessão validada; o
backend verifica papel, permissões e carteira antes de ler qualquer resposta.
Não criar migration, alterar RLS ou executar operação de ambiente. Rollback é
de código: remover rota/BFF/seção e respectivos testes restaura o comportamento
anterior sem apagar registros. CI PostgreSQL/RLS real permanece evidência
obrigatória quando acionado pelo ruleset.

## 8. Revisão crítica do plano antes do código

- **Permissão:** dupla permissão explícita e defesa no backend resolvem a
  exposição indireta via prontuário amplo.
- **Proveniência:** resposta ligada a envio do mesmo tenant/paciente e pergunta
  ligada ao snapshot; dado legado não recebe rótulo inventado.
- **Privacidade:** sem conteúdo em logs, timeline genérica, Cache Storage,
  auditoria ou API pública; campos de saída são mínimos.
- **Integridade temporal:** data civil e timestamp são tipos distintos; eventos
  têm desempate estável e limite sinalizado.
- **Semântica clínica:** somente valores registrados; sem score, causalidade,
  diagnóstico ou recomendação.
- **Escopo:** consultas aparecem apenas como marcadores já existentes; nenhum
  schema ou fluxo de escrita clínica novo é necessário.

Os gaps foram cobertos no desenho e nos critérios verificáveis antes do início
do código. A implementação concluiu os blocos de API, BFF e UI. Qualquer achado
que exija schema, mudança de permissões globais ou nova interpretação clínica
exigiria revisão do plano; nenhum foi necessário.

## 9. Resultado da implementação e verificações

| Verificação | Resultado | Evidência/limite |
| --- | --- | --- |
| Backend Jest completo | PASS | 257 suítes; 2.335 testes passaram; 4 suítes e 43 testes ignorados pela configuração existente. |
| Backend typecheck e build | PASS | Executados localmente. |
| Web typecheck e build | PASS | Build incluiu a nova rota BFF; avisos preexistentes do Next registrados no log local. |
| Web lint completo | PASS | 0 erros; 65 avisos. Arquivos alterados da Fase 305 passaram lint focado sem avisos. |
| Testes de autorização/BFF | PASS | `pnpm test:authz` terminou com exit code 0; contrato da rota nova: 3 testes. |
| Playwright visual | PASS | 10 testes desktop/mobile focados na entrega e nas regressões reportadas passaram; a suíte CI completa ainda será reexecutada. |
| Verificação de linguagem | PASS | 8 verificações passaram. |
| Mobile Expo e supply chain | PASS | Frozen install, typecheck, auditoria Expo offline 21/21, testes de segurança 10/10, acessibilidade 15/15, auditoria de dependências e export Android/iOS/web passaram. Três advisories transitivos foram corrigidos por overrides limitados às faixas vulneráveis; os dois backports locais existentes continuam verificados. |
| Licenças Mobile em Windows | SKIPPED | O scanner local inclui `lightningcss-win32-x64-msvc` (MPL-2.0), opcional e específico de Windows, que não está na alteração do lockfile. O gate de licenças passou no CI Linux antes da atualização; deve ser confirmado de novo no CI atualizado. |
| `pnpm security:secrets` | PASS | Scanner local não identificou secrets reais. |
| `git diff --check` e preflight documental | PASS | `validar-preflight.ps1 -DocsOnly` validou documentos canônicos e diff. |
| PostgreSQL/RLS local | SKIPPED | Docker não está disponível; a prova real depende dos gates de CI. |
| Node 22 local | SKIPPED | Ambiente local disponível é Node 24.19.0; requisito do repositório é Node 22. CI Node 22 continua autoritativo. |
| Migration/deploy | NA | Não há mudança de schema; nenhum ambiente foi alterado. |
| Revisão independente | SKIPPED | Não havia revisor independente disponível neste ciclo; revisão própria do diff não equivale a revisão independente. |
| CI/GitHub | PENDENTE | Smoke visual, governança e PR Gate precisam concluir no commit atual. A auditoria dinâmica do Mobile detectou três advisories transitivos novos, corrigidos localmente por overrides. Gate de licenças atualizado ainda precisa confirmar-se no CI Linux. |

O trabalho local da Fase 305 está concluído e reconciliado. Na primeira execução
remota, os contadores por tipo da auditoria foram rejeitados pela cobertura de
redação; um mock retornou formato inválido para a nova rota e derrubou a tela do
prontuário; dois seletores visuais ficaram ambíguos após a inclusão de conteúdo
com o mesmo texto. A correção remove metadados da auditoria, valida o contrato
da resposta antes de renderizar, fornece payload válido nos mocks e especifica
os seletores. A suíte de 10 testes visuais focados, o teste de cobertura de
redação e o teste do controlador passaram localmente depois da correção. Uma
execução seguinte detectou três advisories transitivos adicionais no Mobile,
divulgados depois da execução anterior. Overrides limitados às faixas
vulneráveis e o lockfile foram atualizados; auditoria, testes de
segurança/acessibilidade, SDK, typecheck e export local passaram. O merge, a
validação RLS em CI e qualquer deploy permanecem etapas posteriores, sem
declaração antecipada de aprovação.
