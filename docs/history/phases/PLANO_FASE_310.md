# Fase 310 — receitas categorizadas e compartilhadas

> Reconciliação em 2026-10-10: Fase 310 integrada pelo PR #388 (`eb7f2aad`),
> confirmado no GitHub neste ciclo. CI da PR `38014957842`, incluindo Demo local
> smoke/Governança/Backend/Web e step Testcontainers, aprovado. Scanners
> pós-merge aprovados; CI principal `38016413569` em andamento na consulta.
> Aplicação operacional da 1066 e envio real não consultados. O conteúdo
> anterior abaixo é histórico, não checklist de pendências atuais.
> Handoff corrente: `tasks/plan.md` (Fase 311).

Estado em 2026-10-09: implementação em andamento na branch
`feature/fase-310-receitas-compartilhadas`; migration 1066 registrada no código,
sem aplicação externa. Permanecem pendentes os gates R4/PostgreSQL, testes
BFF/PWA e build integral antes da PR.
Base observada: `main` no merge `34d186ec` da Fase 309, em 2026-10-09.
Branch de trabalho: `feature/fase-310-receitas-compartilhadas`.

## Objetivo

Organizar a biblioteca existente de receitas e refeições prontas com categorias
pesquisáveis e permitir que o profissional escolha uma receita revisada e a
entregue, de forma explícita e individual, ao paciente certo no portal seguro.
O portal deve mostrar a versão efetivamente enviada, não o conteúdo mutável da
biblioteca.

## Estado observado e gaps

- A Fase 234 já criou `receitas_nutricionais`, CRUD protegido, conteúdo cifrado,
  escopo de receita pessoal/clínica, auditoria de escrita, arquivamento e
  aplicação por cópia no rascunho do plano.
- O registro atual não tem categoria nem número de revisão; `PUT` sobrescreve o
  nome e conteúdo cifrados. O nome não pode ser pesquisado em SQL sem um índice
  de busca protegido. A Fase 310 precisa oferecer categoria/filtros sem expor
  nome ou conteúdo em claro no banco.
- A tela `biblioteca-receitas-nutricionais.tsx` lista até 100 itens, filtra
  apenas por origem/tipo no backend e não tem categoria, busca ou envio ao
  paciente.
- Materiais educativos já podem ser enviados individualmente e vistos no
  portal, mas `envios_material_paciente` referencia conteúdo educativo mutável
  e seus campos não servem como armazenamento para composição nutricional.
  Reutilizar essa tabela faria alterações na biblioteca alterarem o que o
  paciente recebeu.
- O resumo do portal carrega materiais junto dos demais dados; receita deve
  usar projeção mínima na listagem e carregar o conteúdo cifrado somente após
  abertura explícita, por endpoint autenticado `no-store`.
- O portal já resolve o paciente por `tenantId + usuarioId`, tem sessão de
  papel `Patient` e marca leitura de material de forma idempotente. O envio
  profissional existente valida paciente ativo e carteira do profissional.
- A trilha de auditoria existente aceita ação, recurso e metadados redigidos.
  Leitura/envio/retirada devem registrar somente IDs opacos, versão e estado;
  nunca nome da receita, ingredientes, instruções, paciente nomeado ou payload.
- Dados da receita e do paciente são PHI. A superfície é R4: autorização de
  tenant/carteira/papel, conteúdo cifrado, RLS forçada, testes negativos,
  PostgreSQL real, rollback e revisão independente.

## Contrato recomendado

- Categorias com nomes livres por clínica, conforme decisão do proprietário.
  São compartilhadas dentro do tenant, usadas para organização interna, com
  normalização/duplicatas e limite de tamanho definidos no contrato; nunca
  conter nome ou dado individual de paciente.
- Não introduzir busca em texto livre sobre nome cifrado nesta fase. Busca por
  categoria e filtros por tipo/origem usam índices explícitos; a interface pode
  selecionar a categoria sem criar índice pesquisável de conteúdo clínico.
- Cada envio guarda snapshot imutável; editar a receita-fonte não altera o que o
  paciente recebeu. Compartilhar uma nova versão exige ação explícita.
- Canais de entrega: portal, e-mail, WhatsApp e/ou push, com seleção de canais,
  quantidade e horário. Exigir opt-in específico por canal para avisos de
  receitas, desligado por padrão; as preferências gerais atuais não servem como
  consentimento para esse fluxo. O paciente pode alterar ou revogar; o
  profissional inicia cada compartilhamento e seleciona apenas canais
  autorizados. O envio pode ser imediato ou agendado. Lote: até 10 receitas
  para um paciente por ação, com confirmação.
- E-mail/WhatsApp podem usar adaptadores reais já existentes; push usa hoje um
  placeholder. O proprietário confirmou push real nesta fase; será necessário
  cadastrar/remover subscription do paciente autenticado, armazená-la em tabela
  protegida, tratar evento `push` no service worker e implementar adaptador
  servidor. Expirar/remover subscriptions inválidas e nunca declarar entrega
  quando o provedor falhar.
- A janela geral de contato do paciente continua valendo no despacho. Push exige
  tanto permissão do navegador/subscription válida quanto opt-in específico do
  fluxo. Preferências específicas precisam registrar quando foram alteradas e
  revalidar no envio agendado; revogação antes do despacho suprime/cancela o
  canal ainda não iniciado.
- O backend valida tenant, paciente ativo, usuário de portal vinculado,
  carteira atual, receita acessível, autorização do papel e permissões em cada
  operação. O paciente só acessa envios ativos associados à própria conta.
- A política RLS existente é tenant-level (`app.tenant_id`); não há contexto de
  usuário disponível para impor titularidade do paciente no PostgreSQL. A
  leitura no portal precisa resolver `tenantId + usuarioId` no serviço,
  restringir toda consulta ao paciente resolvido e provar tentativas de acesso
  cruzado no teste de integração. Não documentar RLS tenant-level como prova
  isolada de autorização por paciente.
- O envio armazena snapshot cifrado e imutável da versão revisada: nome, tipo,
  categoria, instruções e itens/quantidades/unidades. Atualizar a biblioteca
  não modifica um snapshot já enviado; novo envio é explícito.
- Enviar uma revisão nova substitui o acesso ativo à revisão anterior daquela
  receita para aquele paciente; a revisão antiga permanece indisponível ao
  paciente e rastreável na trilha. Retirada revoga o acesso de forma explícita,
  preservando somente estado, autoria, horários e auditoria necessários.
- O portal apresenta primeiro metadados mínimos e busca o snapshot cifrado
  somente quando o paciente abre a receita. A primeira abertura marca leitura
  idempotente. Respostas autenticadas usam `private, no-store` e não entram no
  cache PWA.
- Avisos externos são genéricos, sem nome de receita, ingredientes ou conteúdo
  nutricional; o clique abre o portal autenticado. Categorias livres são apenas
  organização interna, não aparecem ao paciente. Não calcular nutrientes,
  prescrever, inferir alergias/restrições ou afirmar adequação clínica.
- Receitas ligadas a alimento de catálogo inativo devem ser bloqueadas no envio
  com indicação para o profissional revisar; conteúdo manual sem ID de catálogo
  continua sujeito à revisão humana explícita.
- Registros legados sem categoria não recebem classificação por heurística nem
  backfill semântico. Exibir como “Sem categoria”; exigir classificação válida
  antes de compartilhar. Novas receitas passam a exigir categoria.

## Decisões recebidas

Respostas recebidas:

1. Nomes livres por clínica.
2. Snapshot imutável; atualizar uma versão enviada exige novo envio explícito.
3. Opt-in específico por canal para receita, default desligado, separado das
   preferências gerais; paciente pode revogar, e profissional escolhe somente
   canais autorizados.
4. Envio em lote permitido com confirmação e limite explícito.
5. Avisos externos genéricos; receita completa disponível apenas no portal.
6. Categorias internas, ocultas ao paciente.
7. Push real incluído na Fase 310.
8. O profissional pode enviar ao confirmar ou agendar data/hora futura.
9. Lote limitado a 10 receitas para um paciente por ação, com confirmação.

## Arquitetura / persistência proposta

- Migration aditiva `1066` (confirmar número livre no início da implementação):
  categoria em `receitas_nutricionais`, revisão atual com valor inicial `1`, e
  tabela própria de envios/version snapshots. Não alterar nem reinterpretar
  receitas existentes.
- Guardar categoria com escopo de clínica, validação de tamanho/formato e
  unicidade após normalização no tenant. Valores antigos podem continuar `NULL`
  até classificação explícita; novas receitas exigem categoria. Não permitir
  identificadores nem texto individual de paciente; categorias nunca aparecem
  no portal do paciente.
- Tornar edição otimista por `versaoEsperada`, incrementando revisão sob lock e
  registrando autoria/horário. Cada envio captura `versao_origem` e snapshot
  cifrado; índice parcial garante no máximo uma revisão ativa por receita e
  paciente. Enviar revisão nova marca a anterior como substituída sem apagar
  histórico.
- Tabela de envio deve ter `tenant_id`, `receita_id`, `paciente_id`,
  `enviado_por_usuario_id`, `versao_origem`, `snapshot_criptografado`, estado,
  `enviado_em`, `agendado_para`, `visualizado_em`, `retirado_em`, timestamps e
  FKs compostas por tenant. Cada entrega por canal tem estado/idempotência
  própria. Índices de listagem devem iniciar por tenant/paciente e estado.
- Preferências e consentimentos específicos para avisos de receita por paciente
  e canal, default `false`, separados das preferências gerais; armazenar
  timestamp/versão do consentimento e revogação. Push ainda exige subscription
  ativa. Subscriptions Push são privadas, revogáveis e vinculadas a tenant,
  usuário e paciente.
- Aplicar e `FORCE ROW LEVEL SECURITY` em todas as tabelas novas; policy de
  tenant via `app.tenant_id`; nunca confiar em tenant recebido do browser.
- O runtime `ExecutorTenant` estabelece o contexto do tenant, não identidade do
  usuário. O endpoint de detalhe do portal resolve o paciente pela sessão e
  compõe esse escopo em toda leitura; incluir regressão para IDs de envio de
  outro paciente no mesmo tenant além do teste cross-tenant da RLS.
- Usar `ExecutorTenant` e uma transação por send/replace/revoke. Inserir a
  auditoria transacional de mudança junto do envio quando possível; leitura usa
  o serviço de auditoria autorizado com metadados mínimos.
- Não gravar a composição da receita na tabela genérica de material, no JSON de
  notificações, em URL, cache, log, analytics ou telemetria.

## Endpoints e telas candidatos

- Backend de biblioteca: adicionar categoria e filtro de categoria a
  `/planos-alimentares/receitas`; preservar DTO mínimo e escopos atuais.
- Backend de envio: rota autenticada sob receitas para listar envios, enviar
  snapshot a um `pacienteId` e retirar um envio. O destinatário não vem do
  conteúdo da receita. Envio usa outbox/idempotência/status individual por
  paciente/receita/canal, revalida preferências, opt-in, janela e contato no
  despacho e não inclui conteúdo nos metadados. Se preferências mudarem antes
  do agendamento, suprimir/cancelar o canal e deixar estado visível à clínica.
- O endpoint de preferências do paciente altera somente seu opt-in específico
  de receita, não o contato geral. Mudanças de opt-in não removem registros
  entregues nem concedem acesso a snapshots retirados.
- O lote é uma única ação para um paciente, com no máximo 10 receitas e
  confirmação. Criar um snapshot e resultado individual por receita; erro num
  item não deve duplicar ou ocultar os outros.
- Push real: subscription do paciente criada com permissão do navegador,
  vinculada a tenant/usuário; service worker apresenta aviso genérico e abre rota
  protegida. Cobrir remoção, subscription expirada, duplicidade e falha do
  provedor. Push nunca inclui nome, categoria ou conteúdo da receita.
- Backend do portal: lista resumida de receitas ativas do paciente autenticado
  e rota de detalhe para abrir um envio específico, que revalida titularidade,
  tenant e status antes de descriptografar e registrar leitura.
- BFFs separados para console e portal, usando os wrappers atuais, sessão
  existente, `no-store`, validação de UUID/DTO, erros sem detalhe interno e
  guardas de CSRF já usadas pelas rotas mutáveis.
- Console: categoria na criação/edição, filtro pesquisável por categoria e
  envio explícito a um paciente no prontuário, com confirmação mostrando
  somente o nome do paciente na tela autenticada. Estado de envio/retirada e
  confirmação da revisão visíveis sem conteúdo clínico em notificações.
- Portal: seção própria de receitas recebidas com versões ativas, detalhe
  explícito de instruções/itens/unidades e data de envio; conteúdo não aparece
  no resumo inicial nem em notificações, timeline agregada ou e-mail.

## Sequência para implementação

1. Implementar o contrato de categorias, snapshots, consentimento, lotes e
   agendamento conforme as decisões acima.
2. Adicionar testes de domínio/DTO e migration: categoria, revisão, snapshot,
   constraints/FKs compostas, índices, FORCE RLS, `down()` seguro e número
   confirmado. Provar ausência de backfill de classificação.
3. Implementar gravação/edição otimista da biblioteca e filtro por categoria;
   testar listagem, classificação de registros legados, conflitos de edição e
   bloqueio de alimento indisponível.
4. Implementar send/replace/revoke transacional, snapshot criptografado,
   escopo de paciente/carteira, estado da versão, auditoria redigida e testes
   negativos por papel, profissional, tenant, estado e IDs trocados.
5. Implementar leitura do portal por usuário vinculado: lista mínima, detalhe
   sob demanda, leitura idempotente, retirada imediata, RLS e ausência de
   payload em log/auditoria/cache.
6. Adicionar BFFs e UI de gestão/seleção do paciente; cobrir sessão, permissão,
   CSRF, erros, estados vazios/carregamento e categoria acessível.
7. Adicionar UI do portal e Playwright desktop/mobile + axe/reflow. Testar que
   a alteração da receita fonte não altera snapshot antigo, que nova revisão
   substitui só o paciente escolhido e que a retirada impede abertura.
8. Verificar as migrations em PostgreSQL real/Testcontainers, testes RLS,
   backend `pnpm test --runInBand`, typecheck/build, `pnpm test:authz`, web lint,
   typecheck/build, Playwright, migration governance, `pnpm security:secrets`,
   `git diff --check` e CI integral.
9. Atualizar matriz de confiabilidade e reconciliação 309/310 em status,
   checklist e roadmap no mesmo PR de implementação. Manter aplicação da
   migration fora de banda; identificar ambiente/banco/branch/role owner,
   ensaiar, executar e verificar por runbook. Nenhum merge prova aplicação,
   envio externo ou aceite de produção.

## Gaps e riscos

| Gap / risco | Impacto | Controle planejado |
|---|---|---|
| Receita atual é editável no mesmo registro | Paciente pode ver conteúdo diferente daquele aprovado | Snapshot cifrado e revisão explícita por envio |
| Escopo de paciente e carteira | Exposição de PHI a outro paciente/profissional | Resolução pelo servidor, filtros tenant/carteira, FKs compostas, testes negativos e RLS |
| Conteúdo alimentar pode conter orientação clínica | Prescrição inadequada ou afirmação não fundamentada | Escolha explícita, revisão humana, renderização descritiva, sem alegação de alergia/indicação |
| Categoria livre pode carregar dado de paciente | Vazamento por índice, busca ou listagem | Categoria fica no escopo da clínica, com limite e proibição de identificadores/dados individuais; busca não alcança instruções |
| Ingrediente saiu do catálogo ativo | Snapshot desatualizado pode ser enviado como revisado | Bloquear envio e pedir correção/revisão |
| Portal carrega dados no resumo agregado | Exposição antes de abertura e leitura mal medida | Metadados mínimos e endpoint `no-store` sob demanda |
| Reenvio/retirada concorrentes | Mais de uma versão ativa ou acesso após revogação | Lock otimista/transacional e índice parcial único |
| Notificação externa | Pode revelar conteúdo nutricional ou clínico | Fora do escopo; aviso interno genérico somente |
| Migration e retenção | RLS ausente, FK cruzada, rollback destrutivo | Migration aditiva, teste PostgreSQL real, RLS forced; retirada lógica; nenhum down destrutivo de histórico |

## Fora de escopo

- Publicação automática de toda a biblioteca ou link público.
- Armazenamento de arquivo/PDF de receita, assinatura digital ou link assinado.
- Geração de receita por IA, cálculo nutricional novo, recomendações clínicas,
  validação de alergias/restrições ou adequação a patologia.
- Alterar plano alimentar já publicado ou inserir a receita em plano sem ação
  clínica explícita.
- Busca em conteúdo/nome cifrado via hash, motor de busca externo ou analytics.

## Estado e riscos independentes da Fase 309

- PR #386 está integrada pelo merge `34d186ec`; todos os gates consultados na
  PR passaram, incluindo Backend NestJS, Web, Demo local smoke e PR Gate. O
  run CI de PR foi `37998012799`; `Provenance do SBOM` ficou `SKIPPED`.
- A prova pós-correção RLS/PostgreSQL/Testcontainers passou (21/21) e a suíte
  backend passou (267 suítes, 2.416 testes). Os docs atuais ainda descrevem
  CI/RLS como falhos e PR #386 como draft; reconciliar isso no PR 310.
- Aplicação/validação operacional da migration 1065 não foi observada; continua
  procedimento fora de banda independente. A implementação 310 não deve
  assumir que 1065 está em staging ou produção.
- A PR #386 não registra review formal via GitHub. Não tratar merge ou CI como
  revisão R4 independente. Registrar a revisão independente requerida para
  mudanças de dados/tenant antes de rollout das migrations 1065/1066.

## Handoff

Planejamento feito com GPT-6.1 Sol médio. Nenhum código ou teste foi executado
neste ciclo. O modelo de implementação recomendado é GPT-6 Luna alto; ao
concluir a troca manual, iniciar pela confirmação da branch, decisões, regras e
diff, e seguir `tasks/todo-fase-310.md`. Avisos externos são apenas genéricos;
nenhum envio real ou migration operacional faz parte deste handoff.
