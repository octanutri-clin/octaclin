# Fase 310 — checklist de implementação

> Reconciliação em 2026-10-10: Fase 310 integrada pelo PR #388 (`eb7f2aad`),
> confirmado no GitHub neste ciclo. CI da PR `38014957842`, incluindo Demo local
> smoke/Governança/Backend/Web e step Testcontainers, aprovado. Scanners
> pós-merge aprovados; CI principal `38016413569` em andamento na consulta.
> Aplicação operacional da 1066 e envio real não consultados. O conteúdo
> anterior abaixo é histórico, não checklist de pendências atuais.
> Handoff corrente: `tasks/plan.md` (Fase 311).

Plano autoritativo: `docs/history/phases/PLANO_FASE_310.md`.
Handoff entre modelos: `tasks/plan-fase-310.md`.

## Bloqueio do contrato

- [x] Categorias com nomes livres por clínica; definir escopo, limites e
  normalização sem permitir identificadores/dados individuais.
- [x] Categoria serve somente à organização interna; não exibir ao paciente.
- [x] Snapshot imutável; edição da origem não atualiza o envio, nova versão
  exige compartilhamento explícito.
- [x] Paciente configura opt-in/canais e janela; profissional inicia o envio
  e seleciona entre canais que o paciente autorizou.
- [x] Opt-in para receita separado por canal, desligado por padrão; preferências
  gerais atuais não são consentimento para esse fluxo.
- [x] Lote explícito, confirmado, no máximo 10 receitas para um paciente por
  ação; avisos externos genéricos, receita somente no portal; push real nesta
  fase.
- [x] Profissional escolhe envio imediato ou data/hora futura. Revalidar opt-in,
  canal, contato e janela permitida no momento do despacho.

## Implementação

### 1. Domínio, DTO e contrato

- [x] Definir categoria livre por clínica e validações com limite/normalização,
  incluindo legado sem categoria e proibição de identificadores/dados pessoais.
- [x] Definir versão esperada, transições do envio (`ativo`, `substituido`,
  `retirado`) e regra de uma versão ativa por receita/paciente.
- [x] Cobrir normalização de categoria e conflito de edição concorrente nos
  testes existentes; faltam testes específicos de envio e retirada.

**Aceite:** invalid category, missing version, retired share and stale edition
are rejected deterministically; legacy unclassified recipes are never
reclassified automatically.

### 2. Migration e persistência — R4

- [x] Confirmar que `1066` é o próximo número livre no branch base.
- [x] Adicionar categoria/revisão à biblioteca sem classificar registros
  existentes; criar tabela de envio com snapshot criptografado e autoria.
- [x] FKs compostas tenant/resource/actor, índices de leitura, índice parcial
  de versão ativa e estado; RLS habilitada e `FORCE` em todas as tabelas novas.
- [x] Persistir envio agendado e entregas por canal; criar tabela RLS de push
  subscriptions vinculada a tenant/usuário/paciente e revogável; persistir
  preferências específicas por canal, default false, com estado/horário de
  consentimento e revogação.
- [x] `down()` recusa apagar histórico de envios.
- [ ] RLS Testcontainers/duas conexões, role restrita, cross-tenant, FKs e
  concorrência seguem pendentes; spec estática passou antes dos últimos ajustes
  de idempotência.
- [ ] Como RLS atual só conhece `app.tenant_id`, provar também por teste de
  serviço que uma sessão Patient não lê outro paciente do mesmo tenant.

**Aceite:** migração só aditiva; usuário runtime não recebe privilégios DDL;
nenhum nome ou conteúdo legível persistido na nova tabela.

### 3. Biblioteca e gestão no backend

- [x] Categoria obrigatória em novo/edição; filtro por categoria junto
  dos filtros de tipo/origem; não buscar texto do nome cifrado no banco.
- [x] Atualização otimista `versaoEsperada` com lock e incremento de versão.
- [x] Compartilhamento exige a versão explicitamente revisada para cada item;
  trava a origem, rejeita alteração concorrente e valida a versão também na
  repetição idempotente da solicitação.
- [x] Enviar snapshot cifrado a um paciente selecionado, revalidando
  permissão, tenant, vínculo de portal, status ativo e carteira atual.
- [x] Implementar lote com limite, confirmação explícita e estado/idempotência
  por receita/paciente/canal, no máximo 10 receitas por ação para um paciente,
  respeitando opt-in, canal e janela do paciente.
- [x] Permitir despacho imediato ou agendado; cancelar/suprimir canal quando
  consentimento, contato, canal ou janela não forem mais válidos no despacho.
- [x] Reenvio substitui a versão acessível; retirada revoga no mesmo commit e
  mantém registros/auditoria mínimos.
- [x] Bloquear envio quando os itens fazem referência a alimento indisponível;
  manter conteúdo manual sob revisão explícita.
- [x] Auditoria transacional de envio/edição/retirada e de primeira leitura,
  sem nome, instrução, alimento, resumo ou conteúdo nutricional no metadata.

**Aceite:** tenant/profissional/paciente/versão trocados nunca retornam dados;
envio e retirada são transacionais, idempotentes conforme contrato e auditáveis.

### 4. BFF e leitura no portal

- [x] BFF autenticado para enviar/listar/retirar no prontuário; validar métodos,
  UUIDs, permissão e CSRF com wrappers existentes.
- [x] Implementar registro/remoção autenticado de push subscriptions para
  Patient, exigir permissão de navegador e opt-in específico no portal,
  persistir com RLS e enviar via adaptador real; nada de payload clínico.
- [x] Portal lista metadados mínimos e abre detalhe sob demanda; no backend,
  resolver paciente por usuário autenticado e envio ativo antes de descriptografar.
- [x] Marcar leitura idempotente e aplicar `private, no-store`; não acrescentar
  receita ao resumo/cache offline/push/email.
- [x] Implementar confirmação do lote limitado; idempotência e estado por
  receita/canal/destinatário; respeitar opt-in, canal, janela e destino atual.
- [ ] Testes BFF para sessão ausente, papel, `403/404`, cache, tenant e payload
  mínimo.

**Aceite:** conta sem vínculo Patient não abre receita; IDs enumerados de outros
pacientes (inclusive no mesmo tenant) respondem sem confirmar a existência;
RLS tenant-level não é tratada como autorização de titularidade.

### 5. Interface clínica e portal

- [x] Biblioteca: escolher categoria, filtrar, editar com versão e indicar
  receitas antigas sem classificação.
- [x] Prontuário: ação explícita de enviar lote limitado de receitas revisadas;
  confirmar categoria/versão e destino antes do POST; mostrar versões ativa,
  substituída e retirada sem revelar conteúdo em notificação.
- [x] Portal: lista e detalhe de receitas recebidas; envios retirados saem do acesso
  de abertura; sem inferência nutricional/diagnóstica.
- [x] Estados loading/vazio/erro/sem vínculo e controles acessíveis; validação visual automatizada pendente.
- [ ] Playwright desktop/mobile e axe, com fixtures sintéticas.

**Aceite:** nenhuma ação publica toda biblioteca; conteúdo do snapshot não muda
com edição da fonte e desaparece imediatamente após retirada/substituição.

### Checkpoint de integração

- [ ] Backend focado e integral, `pnpm typecheck`, `pnpm build`.
- [x] Backend e web typecheck/build passaram em Node 24.19.0; repetir sob Node
  22, exigido pelos manifests, antes do merge.
- [ ] PostgreSQL Testcontainers/RLS real, concorrência do mesmo paciente e
  migration governance.
- [ ] Web `pnpm test:authz` e Playwright desktop/mobile.
- [x] Lint direcionado da web terminou sem erros (3 avisos React preexistentes
  em `plano-alimentar-profissional.tsx`); `pnpm security:secrets`,
  `pnpm audit --prod`, verificador de licenças e `git diff --check` passaram.
- [ ] Repetir o build/typecheck sob Node 22; o ambiente deste ciclo usa Node
  24.19.0, acima do intervalo declarado pelos manifests (`>=22 <23`).
- [ ] Testar PWA push: permissão, registro, expiração/revogação, clique com
  sessão encerrada, aviso genérico e abertura autenticada do portal. Testar
  agendamento/fuso, mudança de preferência, lote parcial e limite 10.
- [ ] `git diff --check`; revisão independente R4; atualizar matriz de
  confiabilidade e documentos de estado junto da implementação.
- [x] PR #388 em rascunho contém plano, implementação e reconciliação factual
  da Fase 309; manter draft até os gates obrigatórios passarem.

## Gates externos separados

- [ ] Revisão R4 independente.
- [ ] Confirmar ambiente, banco, branch de migration e role owner antes de
  qualquer DDL.
- [ ] Verificar estado 1065 e planejar aplicação sequencial 1065/1066 fora de
  banda; ensaiar, aplicar e comprovar, se autorizado.
- [ ] Nenhum envio real, deploy ou aceite de produção sem pedido/autorização e
  evidência correspondente.
- [ ] Configurar por ambiente `WEB_PUSH_VAPID_PUBLIC_KEY`,
  `WEB_PUSH_VAPID_PRIVATE_KEY` e `WEB_PUSH_VAPID_SUBJECT`; consentimento push
  fica bloqueado sem os três. WhatsApp exige template aprovado
  `octaclin_aviso_receita_disponivel` com
  `conteudo.avisoReceitaGenerico=true`, `conteudo.avisoReceitaUrlNoBody=true`
  e um placeholder de URL correspondente no body aprovado na Meta.
