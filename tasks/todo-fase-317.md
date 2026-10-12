# Checklist — Fase 317

Implementação técnica e testes autorizados pelo proprietário em 2026-10-12.
Piloto desativado; sem migrations externas, merge, deploy ou ativação.
[Plano](../docs/history/phases/PLANO_FASE_317.md), [handoff](plan-fase-317.md).
Escopo recebido: conquistas e comunidade, console/portal, adultos>=18, aceite.
D01–11 confirmadas; D12 técnica, contrato detalhado; autorização de implementação e testes recebida;
revisão operacional/termo ainda pendente. Tarefas abaixo registram o contrato e o progresso;
subdividir em slices de até cinco arquivos antes de executar. Novos caminhos são
candidatos; reconferir base, APIs, versões e migration disponível na retomada.

## T00 — Base e inventário (concluído nesta etapa)

- [x] Fetch main `a84921fb`, worktree dedicada; checkout principal preservada.
- [x] Módulo, DTOs, guards, ORMs, SQL, portal, demo e testes inventariados por leitura.
- [x] Registrar316 em stand-by; sem herdar runtime/commits da pesquisa316.
- [x] D01–11 respondidas; D12 técnica e termos/limites registrados sem presumir aceite.

## T01 — Consolidar produto, legado e contratos (DOCUMENTAL_CONCLUIDO; IMPLEMENTAÇÃO AUTORIZADA)

Dependência: T00/respostas. Scope M documental,3–5 arquivos de planejamento.

Aceites:
- [x] D01–12 documentadas; propósito/termos propostos, retenção, papéis e legado consistentes.
- [x] Matriz ação/estado/papel/tenant/carteira e rotas/DTOs candidatos documentados.
  Status401/403/404/409/422/429 são contrato técnico a executar sob o padrão existente.
- [x] Autorização de implementação/testes registrada; Sol no núcleo e pausa manual antes de Luna na UI.

Verificação prevista: revisão do contrato e cenários de uso com proprietário;
links/diff; sem tratar perguntas aprovadas como release operacional.

Checkpoint C01: nenhuma tarefa de runtime começa sem T01. Pode resultar em
adiar comunidade se moderação/privacidade não forem viáveis; D01 não é NO-GO atual.

## T02 — Definir gates de clínica e elegibilidade (IN_PROGRESS)

Dependências: C01. Scope M por slice; `dtos-piloto.ts`, serviço/configuração,
controller e specs no módulo atual; BFF de ativação em slice separado.

Aceites:
- [ ] Flags do piloto default false; habilitação somente no papel confirmado D07.
- [ ] Elegibilidade server-side de adulto/vínculo/carteira; ausências não deduzidas.
- [ ] Nenhuma flag antiga vira consentimento ou concede privilégio clínico ao gestor.

Verificação prevista: TDD DTO/service/controller e negativos de papel, DOB
17/18, aniversário/29fev, transferência, arquivamento e flags/paciente adulterados.

## T03 — Persistência aditiva e snapshots (IN_PROGRESS)

Dependências: T02. Subtasks03a migration+spec/registro;03b ORMs até3 por slice;
03c codecs cifrados/DTO e specs. Candidatos nas pastas existentes gamificação e
banco-dados; escolher número livre na execução, não reservar1070 por suposição.

Aceites:
- [ ] Estados/versões/gerações/autores/chaves e relações compostas tenant/recurso.
- [ ] Snapshots/textos sensíveis cifrados; sem migração automática de legados para portal.
- [ ] FORCE RLS, índices/uniques e down sem perda do histórico novo.

Verificação prevista: teste SQL/registro, round-trip/tamper/missing-key da cifra;
PG descartável com role runtime real, cross-tenant/FK e introspecção de RLS.

## T04 — Transições com concorrência e replay (IN_PROGRESS)

Dependência: T03. Scope M por helper/serviço+spec e teste de banco separado.

Aceites:
- [ ] Cada comando usa versão esperada, fingerprint protegido e chave de idempotência.
- [ ] Retry idêntico retorna mesmo recurso; payload diferente409; rollback parcial integral.
- [ ] Aceite/saída/transferência/encerramento competem sob lock sem reativação indevida.

Verificação prevista: PG real concorrente (não só mocks), duplo submit, autorização
revogada entre leitura/escrita, replay de outra sessão/tenant/geração e out-of-order.

Checkpoint C02: modelo, cifra/RLS e transições comprovados em ambiente descartável.

## T05 — Conceder conquistas privadas (IN_PROGRESS)

Dependência: C02. Scope M: serviço/DTO/controller+specs por slice.

Aceites:
- [ ] Autor profissional da sessão; paciente atual; concessão manual sem diagnóstico/pontos.
- [ ] Snapshot imutável, ícone interno e compartilhamento/retirada explícitos separados.
- [ ] Alterar catálogo não altera concessão; legado sem snapshot não é compartilhado implicitamente.

Verificação prevista: service/controller, double click e snapshot após edição,
profissional sem vínculo, SuperAdmin/administrativo, paciente de outra carteira.

## T06 — Aceite e leitura privada no portal (IN_PROGRESS)

Dependência: T05. Scope M por consentimento/service/controller+specs; BFF na T13.

Aceites:
- [ ] Próprio Patient; consentimento conquistas separado/versionado/revogável.
- [ ] Projeção allowlist paginada de snapshot autorizado; zero notas/regras/IDs internos.
- [ ] Revogação/retirada/flags impedem nova leitura mesmo em URL antiga; no-store.

Verificação prevista: objetos JSON reais/extra fields, cursor de outro contexto,
cache/erro/tamper, transferência e revogação concorrentes; nenhum Patient no console.

## T07 — Jornada de conquistas (NOT_STARTED)

Dependência: T06/T13a. Scope M por componentes individuais+teste; reusar UI da307.

Aceites:
- [ ] Seleção explícita de paciente, confirmação antes de compartilhar/retirar.
- [ ] Portal exibe data/origem, opt-in/saída e estados vazios, sem comparação entre pacientes.
- [ ] Desktop/mobile/teclado e mensagens de ausência não atribuem falta de progresso.

Verificação prevista: Playwright/axe sintético e regressões portal307, BFF/fixtures.

Checkpoint C03: conquista privada completa sem comunidade ou ranking expostos.

## T08 — Círculo e convite explícito (IN_PROGRESS)

Dependência: C02/contrato confirmado. Scope M por serviço/DTO/controller/specs.

Aceites:
- [ ] Um tenant/profissional; somente pacientes elegíveis da carteira e convidados.
- [ ] Convite não adiciona paciente sem aceite nem revela lista de participantes.
- [ ] Expiração/encerramento/transferência impedem aceite; reenvio nova geração.

Verificação prevista: negativos de papel/paciente/carteira, link antigo/replay,
clínica desligada, profissional arquivado, tentativa de circulação entre clínicas.

## T09 — Participação, nome de exibição e saída (IN_PROGRESS)

Dependência: T08. Scope M por serviço/consentimento/controller/specs.

Aceites:
- [ ] Consentimento de comunidade independente de conquistas e termos gerais.
- [ ] Nome confirmado/estados conforme D09; não copia perfil clínico sem escolha.
- [ ] Saída/retirada D08 imediata; nenhum novo convite recupera aceite anterior.

Verificação prevista: alteração de nome de exibição, autoidentificação/limites/escape,
termo/generation stale, saída repetida e corrida com submit/lista/moderação.

## T10 — Submissão imediata, comentários e curtidas (IN_PROGRESS)

Dependência: T09/D05. Subtasks10a posts/DTO/spec;10b comentários/DTO/spec;10c curtidas/DTO/spec;
10d revisão/retirada/filas após denúncia. Até5 arquivos por subtarefa.

Aceites:
- [ ] Autoria Patient da sessão; autor profissional é separado e nunca se passa por paciente.
- [ ] Publicação imediata D05/limites D06; comentários herdam acesso ao post.
- [ ] Edição cria revisão; curtidas idempotentes/lista de nomes D10; nenhum replay duplica contagens.

Verificação prevista: estado de publicação adulterado, injeção HTML/Markdown/URLs,
rejeição/retirada, bloqueio auxiliar divergente, moderação sem texto em logs/analytics.

## T11 — Denúncia e retirada com retenção definida (IN_PROGRESS)

Dependência: T10. Scope M por serviço/controller/DTO/spec; cleanup em slice extra
obrigatório para90 dias D11; não reutilizar prova316 como cleanup real.

Aceites:
- [ ] Denúncia só por membro autorizado, privada; paciente não vê denunciante/justificativa interna.
- [ ] Moderador pode retirar conteúdo; sem readmission por replay de publicação anterior.
- [ ] Retenção/deleção e acesso residual conforme política explicitamente aprovada em T01.

Verificação prevista: abuso/rate limit, postagem retirada, membro saiu, denúncias
duplicadas, validação de prazo/eliminação e concorrência conforme política final.

## T12 — Feed paginado autorizado (IN_PROGRESS)

Dependência: T10/T11. Scope M serviço/projeção/controller/DTO/spec.

Aceites:
- [ ] Apenas versões publicadas/permitidas no círculo atual, paginação data+id e contexto seguro.
- [ ] Sem patientId/usuarioId/lista de membros/conquistas/reportes/texto pendente de terceiros.
- [ ] Toda página revalida idade, vínculo, aceite, estado da clínica/círculo e D08.

Verificação prevista: projeção real com campos extras, vários círculos/pacientes,
cache/cursor malicioso, post/comentário retirado entre páginas, contador inconsistente e saída/transferência.

Checkpoint C04: exposição em grupo e moderação testadas; sem conteúdos reais.

## T13 — BFFs mínimos por jornada (NOT_STARTED)

13a depende T06 (conquistas);13b depende T08–T12 (comunidade); scopes de até5 arquivos
por rota/helper/spec. Reusar sessao-bff e guards, novos testes BFF isolados.

Aceites:
- [ ] Cookies/sessão/origem/papel/erro sanitizado; tenant resolvido somente no backend.
- [ ] No-store/sem cache persistente e DTO de saída explicitamente aplicado.
- [ ] Manual/portal atual mantém contrato; nenhum proxy genérico aceitando rota arbitrária.

Verificação prevista: `pnpm test:authz` + script focado da317 a criar, status e
headers reais, origens maliciosas e revogação. Não apenas testes de tipos TS.

## T14 — Comunidade no console e portal (NOT_STARTED)

Dependência: C04/T13b. Subtasks14a convites/participação;14b moderação/denúncia;
14c feed/submit; componentes/clients/types+teste no máximo5 por slice.

Aceites:
- [ ] Consentimento explica leitura por outros pacientes; sair/denunciar acessíveis.
- [ ] Formulário/comments/likes D06; retirada oculta o conteúdo e suas interações.
- [ ] Views vazia/carregando/falha/encerrado/paginação e responsive sem dados em URL/cache.

Verificação prevista: Playwright/axe desktop/mobile/teclado/reflow e estados com
fixtures sintéticas. Reusar shell do portal, não construir app paralelo.

## T15 — Regressões e segurança da entrega (NOT_STARTED)

Dependência: T07/T14. Scope M por correção/revisão específica.

Aceites:
- [ ] Banco/RLS/concorrência + suites backend amplo/focado e redaction proporcionais.
- [ ] BFF/authz/demo smoke/Playwright/axe, typecheck/build/lint dos pacotes afetados.
- [ ] Revisão R4 independente identificada ou explicitamente pendente; nenhum falso PASS.

Verificação prevista: `pnpm test --runInBand` (backend), `pnpm test:rls:testcontainers`,
`pnpm typecheck`, `pnpm build`, web `pnpm test:authz`/`pnpm lint`; localizar comandos
Playwright existentes antes de executar. Reexecutar após fixes. CI do HEAD real.

## T16 — Documentar e abrir PR única (NOT_STARTED)

Dependência: T15. Scope M docs/handoff/runbook/variáveis/ADR somente se necessários.

Aceites:
- [ ] Gates PASS/FAIL/BLOCKED/SKIPPED honestos; não alegar validação clínica por testes.
- [ ] Rollback preserva dados, papéis, consentimentos; plano de piloto/apoio à moderação.
- [ ] PR única Draft enquanto gates pendentes; sem merge/deploy/migrations externas automáticos.

Verificação prevista: diff/links/secrets, branch/base/diff novamente, checks reais
da PR. Migrations/alvos/aprovação de piloto são etapa separada.

Checkpoint C05: entrega técnica revisável, migrações/piloto operacional sujeitos a
aprovação específica. Sem depender do fechamento da316 ou de G01 da314.

## Registro desta rodada

PASS de leitura/inventário e decisões D01–11; D12 técnica documentada.
Autorização de implementação/revisão operacional de termos e moderação PENDING.
Código/migrations/testes de implementação/builds/CI/banco externo NOT_RUN.
Somente validações documentais ao finalizar esta rodada; registrar resultados reais
no handoff. Nenhuma autorização de implementação inferida da seleção de escopo.

### Execução inicial

T02: domínio e configuração administrativa implementados;20 testes novos PASS
após RED por módulos ausentes. Node22.23.3/pnpm11.25.0, instalação congelada.
Build PASS; restantes registros de execução serão atualizados após cada slice.
T03: teste da migration1070 escrito, RED; código da migration ainda não adicionado.
Gate operacional ausente mantém piloto indisponível, sem alterar flags antigas.

## Registro do incremento backend — 2026-10-12

- Implementados gate operacional literal e flags novas, domínio adulto, contexto
  autenticado/carteira, cifra vinculada ao recurso e ledger idempotente.
- Migration aditiva 1070, seis tabelas novas FORCE RLS e trigger do snapshot;
  ainda não aplicada fora do banco descartável. FKs legadas NOT VALID exigem
  preflight externo e validação explícita antes da ativação.
- Serviços/rotas de conquistas, convite/aceite/saída, posts, comentários, nomes
  de curtidas, edição/revisões, denúncia privada e moderação; APIs legadas
  filtradas por modelo1. Não existe publicação em nome do paciente.
- Retenção: expurgo de corpos/revisões/nomes vencidos e tombstones de comandos;
  worker somente em processos worker/all, incluindo tenants inativos e flags
  desligadas. Exceção legal registra justificativa cifrada e prazo pelo gestor
  da própria clínica; não concede leitura de conteúdo ao gestor.
- Evidências parciais: 34 testes focados do núcleo; provas PG evoluíram de4 para5
  e depois19 casos; rodada final combinada:50 testes PG/RLS e2703 backend PASS; nenhuma contagem implica conclusão de T02–T12.
- HTTP/DTO/guards reais com identidade/serviços simulados passaram; pendem
  revisão R4 independente, BFF, interface,
  demo, acessibilidade, governança e PR. Não marcar C02/C04 ou G03/G04 como PASS
  apenas pelo incremento ou pelos mocks.

## Checkpoint do núcleo para troca manual de modelo

T02–T06/T08–T12 têm implementação backend e evidências locais; permanecem
IN_PROGRESS na entrega integrada até BFF/UI e revisão final. T07/T13–T16 ficam
para Luna alto, sob contrato da API. G00 PASS; G01/G02/G05 BLOCKED para liberação;
G03 PASS local; G04 IN_PROGRESS.73 testes condicionais pulados pela suíte geral
não são PASS; PG foi executado separadamente. Revisão independente não executada.
Não abrir nova rodada de perguntas de produto nem alterar a316 em stand-by.
