# Painel Clinico do Profissional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um painel clinico diario, seguro por profissional, com filas priorizadas e acoes rapidas auditaveis.

**Architecture:** O backend recebe um novo modulo de dashboard clinico que agrega agenda, pacientes, tarefas, envios de formularios, solicitacoes publicas e comunicacoes dentro de uma unica transacao tenant-aware. O web consome esse contrato via BFF autenticado e delega mutacoes aos fluxos de dominio existentes, sem duplicar regras de agenda, notificacao ou escopo.

**Tech Stack:** NestJS, TypeORM, PostgreSQL RLS, Next.js App Router, React, TypeScript, Playwright, Jest e Lucide.

## Global Constraints

- `Professional` recebe somente seu proprio escopo; `SuperAdmin` e o unico papel que pode informar `profissionalId` de terceiro.
- `Collaborator`, `Client` e `Patient` nao acessam o resumo clinico nem o seletor de profissional.
- Pacientes arquivados, pausados ou encerrados nao entram nas filas de retorno e tarefa vencida.
- Somente `concluida` reinicia o calculo de retorno; `reagendada`, `falta` e `cancelada` nao contam como atendimento realizado.
- O dashboard nao persiste token publico, conteudo de mensagem ou dados clinicos detalhados fora de seus modulos de origem.
- Toda mutacao disparada pelo painel carrega `origem: dashboard_clinico` na auditoria sem permitir que o frontend escolha usuario, tenant ou profissional.
- Sem dependencias novas, sem `any` em codigo de producao e sem alteracao na integracao Google Calendar fora das chamadas ja existentes de agenda.

---

### Task 1: Ciclo de vida e desfecho de consulta

**Files:**
- Create: `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001002-AdicionarDesfechosConsultaAgenda.ts`
- Modify: `octaclin-backend/src/modulos/agenda/infraestrutura/agenda-consulta.orm.ts`
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/dtos.ts`
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.ts`
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.spec.ts`
- Modify: `octaclin-backend/src/modulos/agenda/apresentacao/controlador-agenda.ts`
- Modify: `octaclin-web/lib/agenda-api.ts`
- Create: `octaclin-web/app/api/agenda/consultas/[consultaId]/desfecho/route.ts`
- Modify: `octaclin-web/components/agenda/painel-agenda.tsx`

**Interfaces:**
- Produces `POST /agenda/consultas/:consultaId/desfecho` with `{ status: 'concluida' | 'falta' | 'cancelada' }`.
- Extends `PATCH /agenda/consultas/:consultaId` to set `status: 'reagendada'` when the date changes successfully.
- Produces `ConsultaAgendaRespostaDto.status` as `'agendada' | 'reagendada' | 'concluida' | 'falta' | 'cancelada'`.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it('permite ao profissional concluir apenas a propria consulta', async () => {
  await expect(servico.registrarDesfecho('tenant-1', 'consulta-1', { status: 'concluida' }, profissionalUm))
    .resolves.toEqual(expect.objectContaining({ status: 'concluida' }));
  await expect(servico.registrarDesfecho('tenant-1', 'consulta-2', { status: 'falta' }, profissionalUm))
    .rejects.toThrow('Consulta nao encontrada.');
});

it('mantem consulta reagendada ativa e nao permite desfecho terminal duas vezes', async () => {
  await servico.remarcarConsulta('tenant-1', 'consulta-1', novaData, profissionalUm);
  expect(consulta.status).toBe('reagendada');
  await servico.registrarDesfecho('tenant-1', 'consulta-1', { status: 'concluida' }, profissionalUm);
  await expect(servico.registrarDesfecho('tenant-1', 'consulta-1', { status: 'falta' }, profissionalUm))
    .rejects.toThrow('Consulta encerrada nao pode receber novo desfecho.');
});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `pnpm --dir octaclin-backend exec jest servico-agenda.spec.ts --runInBand`

Expected: FAIL because status values and `registrarDesfecho` do not exist.

- [ ] **Step 3: Add status constraint and domain implementation**

```ts
export type StatusAgendaConsulta = 'agendada' | 'reagendada' | 'concluida' | 'falta' | 'cancelada';

export class RegistrarDesfechoConsultaAgendaDto {
  @IsIn(['concluida', 'falta', 'cancelada'])
  status: 'concluida' | 'falta' | 'cancelada';
}

async registrarDesfecho(tenantId: string, consultaId: string, dados: RegistrarDesfechoConsultaAgendaDto, usuario: UsuarioAutenticado) {
  // Busca por tenant e profissional quando aplicavel, bloqueia estado terminal e persiste o novo status.
}
```

The migration must add a PostgreSQL `check` constraint that accepts only the five statuses, preserve existing `agendada` and `cancelada` rows, and restore the prior constraint in `down`. `reagendada` remains active for conflict checks and Google Calendar synchronization; terminal statuses no longer block a time slot.

- [ ] **Step 4: Expose audited controller and BFF action**

```ts
@Post('consultas/:consultaId/desfecho')
@Permissoes('agenda.consultas.criar')
async registrarDesfecho(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() req: Request, @Param('consultaId', ParseUUIDPipe) id: string, @Body() dados: RegistrarDesfechoConsultaAgendaDto) {
  const consulta = await this.servicoAgenda.registrarDesfecho(usuario.tenantId, id, dados, usuario);
  await this.servicoAuditoria.registrar({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao: 'agenda.consulta.desfecho', recursoTipo: 'agenda_consulta', recursoId: id, ip: req.ip, userAgent: this.obterUserAgent(req), metadados: { status: dados.status, origem: req.header('x-octaclin-origem') ?? 'agenda' } });
  return consulta;
}
```

Add the matching Next BFF route and the `registrarDesfechoConsulta` client function. In `PainelAgenda`, expose icon buttons with tooltips for `Concluir`, `Falta` and `Cancelar`; keep full rescheduling in the existing appointment editor and render `Reagendada` as an active status.

- [ ] **Step 5: Run focused verification and commit**

Run: `pnpm --dir octaclin-backend exec jest servico-agenda.spec.ts --runInBand; pnpm --dir octaclin-backend typecheck; pnpm --dir octaclin-web lint; pnpm --dir octaclin-web typecheck`

Expected: PASS, including professional scope, terminal transition protection and status rendering.

```bash
git add octaclin-backend/src/modulos/agenda octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001002-AdicionarDesfechosConsultaAgenda.ts octaclin-web/lib/agenda-api.ts octaclin-web/app/api/agenda/consultas octaclin-web/components/agenda/painel-agenda.tsx
git commit -m "Adiciona desfechos clinicos na agenda"
```

### Task 2: Leitura clinica de formulario e contratos de fila

**Files:**
- Create: `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001003-AdicionarRevisaoClinicaEnviosQuestionario.ts`
- Modify: `octaclin-backend/src/modulos/questionarios/infraestrutura/envio-questionario.orm.ts`
- Modify: `octaclin-backend/src/modulos/questionarios/aplicacao/dtos.ts`
- Modify: `octaclin-backend/src/modulos/questionarios/aplicacao/servico-questionarios.ts`
- Modify: `octaclin-backend/src/modulos/questionarios/aplicacao/servico-questionarios.spec.ts`
- Modify: `octaclin-backend/src/modulos/questionarios/apresentacao/controlador-questionarios.ts`
- Create: `octaclin-web/app/api/questionarios/envios/[envioId]/revisar/route.ts`
- Modify: `octaclin-web/lib/questionarios-api.ts`

**Interfaces:**
- Produces `POST /questionarios/envios/:envioId/revisar`.
- Adds `revisadoEm?: Date` and `revisadoPorUsuarioId?: string` to `EnvioQuestionarioOrm` and its API response.
- A dashboard queue item is pending review only when `status === 'respondido' && revisadoEm IS NULL`.

- [ ] **Step 1: Write failing review tests**

```ts
it('marca envio respondido como revisado apenas pelo profissional responsavel', async () => {
  const resultado = await servico.marcarEnvioComoRevisado('tenant-1', 'envio-1', profissionalUm);
  expect(resultado).toEqual(expect.objectContaining({ revisadoPorUsuarioId: profissionalUm.usuarioId }));
});

it('nao permite revisar envio de paciente fora do escopo profissional', async () => {
  await expect(servico.marcarEnvioComoRevisado('tenant-1', 'envio-de-outro-profissional', profissionalUm))
    .rejects.toThrow('Envio nao encontrado.');
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --dir octaclin-backend exec jest servico-questionarios.spec.ts --runInBand`

Expected: FAIL because review columns and service method do not exist.

- [ ] **Step 3: Implement migration, service and audited endpoint**

```ts
async marcarEnvioComoRevisado(tenantId: string, envioId: string, usuario: UsuarioAutenticado) {
  return this.executorTenant.executar(tenantId, async (gerenciador) => {
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const envio = await gerenciador.getRepository(EnvioQuestionarioOrm).findOne({ where: { id: envioId, tenantId, status: 'respondido' } });
    // Verifica paciente.responsavel quando profissionalId existe, grava revisadoEm e revisadoPorUsuarioId.
  });
}
```

The migration adds nullable review columns plus a `(tenant_id, status, revisado_em)` index. The controller registers `questionarios.envio.revisar` and preserves the origin header supplied only by the dashboard BFF.

- [ ] **Step 4: Add web client contract**

```ts
export async function revisarEnvioQuestionario(envioId: string): Promise<EnvioQuestionarioApi> {
  const resposta = await fetch(`/api/questionarios/envios/${encodeURIComponent(envioId)}/revisar`, { method: 'POST' });
  if (!resposta.ok) throw new ErroApiQuestionario(resposta.status, await resposta.text());
  return resposta.json() as Promise<EnvioQuestionarioApi>;
}
```

- [ ] **Step 5: Run focused verification and commit**

Run: `pnpm --dir octaclin-backend exec jest servico-questionarios.spec.ts --runInBand; pnpm --dir octaclin-backend typecheck; pnpm --dir octaclin-web typecheck`

Expected: PASS for reviewed state, idempotency and professional scope.

```bash
git add octaclin-backend/src/modulos/questionarios octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001003-AdicionarRevisaoClinicaEnviosQuestionario.ts octaclin-web/app/api/questionarios/envios octaclin-web/lib/questionarios-api.ts
git commit -m "Adiciona revisao clinica de formularios"
```

### Task 3: Resumo clinico agregado e isolamento de acesso

**Files:**
- Create: `octaclin-backend/src/modulos/dashboard/modulo-dashboard.ts`
- Create: `octaclin-backend/src/modulos/dashboard/aplicacao/dtos-dashboard-clinico.ts`
- Create: `octaclin-backend/src/modulos/dashboard/aplicacao/servico-dashboard-clinico.ts`
- Create: `octaclin-backend/src/modulos/dashboard/aplicacao/servico-dashboard-clinico.spec.ts`
- Create: `octaclin-backend/src/modulos/dashboard/apresentacao/controlador-dashboard-clinico.ts`
- Create: `octaclin-backend/src/modulos/dashboard/infraestrutura/dashboard-alerta-oculto.orm.ts`
- Create: `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001004-CriarAlertasOcultosDashboardClinico.ts`
- Modify: `octaclin-backend/src/modulo-aplicacao.ts`

**Interfaces:**
- Produces `GET /dashboard/clinico?periodo=hoje|sete_dias|trinta_dias&profissionalId=<uuid>`.
- Produces `POST /dashboard/clinico/alertas/:alertaId/ocultar`.
- Response `ResumoDashboardClinicoDto` contains `contexto`, `indicadores`, `atendimentos`, `semRetorno`, `tarefasVencidas`, `formulariosPendentes`, `solicitacoesPendentes`, `comunicacoes`, `alertas` and `selecaoObrigatoria`.

- [ ] **Step 1: Write failing aggregate and authorization tests**

```ts
it('forca Professional ao proprio profissional mesmo quando informa outro id', async () => {
  const resumo = await servico.obterResumo('tenant-1', { periodo: 'hoje', profissionalId: 'profissional-2' }, profissionalUm);
  expect(resumo.contexto.profissionalId).toBe('profissional-1');
  expect(resumo.semRetorno.every((item) => item.profissionalId === 'profissional-1')).toBe(true);
});

it('permite SuperAdmin selecionar profissional e registra o contexto consultado', async () => {
  const resumo = await servico.obterResumo('tenant-1', { periodo: 'sete_dias', profissionalId: 'profissional-2' }, superAdmin);
  expect(resumo.contexto.profissionalId).toBe('profissional-2');
});

it('prioriza risco alto sem retorno antes de tarefa vencida e exclui paciente pausado', async () => {
  const resumo = await servico.obterResumo('tenant-1', { periodo: 'hoje' }, profissionalUm);
  expect(resumo.alertas[0]).toEqual(expect.objectContaining({ tipo: 'sem_retorno_risco_alto' }));
  expect(resumo.semRetorno.find((item) => item.pacienteId === 'paciente-pausado')).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --dir octaclin-backend exec jest servico-dashboard-clinico.spec.ts --runInBand`

Expected: FAIL because the module and aggregate contract do not exist.

- [ ] **Step 3: Implement tenant-aware aggregate**

```ts
async obterResumo(tenantId: string, filtros: FiltrosDashboardClinicoDto, usuario: UsuarioAutenticado): Promise<ResumoDashboardClinicoDto> {
  return this.executorTenant.executar(tenantId, async (gerenciador) => {
    const profissionalId = await this.resolverContextoProfissional(gerenciador, tenantId, filtros.profissionalId, usuario);
    const [consultas, pacientes, tarefas, envios, solicitacoes, mensagens] = await Promise.all([
      this.buscarConsultas(gerenciador, tenantId, profissionalId, filtros.periodo),
      this.buscarPacientesAtivos(gerenciador, tenantId, profissionalId),
      this.buscarTarefasVencidas(gerenciador, tenantId, profissionalId),
      this.buscarEnviosAguardandoRevisao(gerenciador, tenantId, profissionalId),
      this.buscarSolicitacoesPendentes(gerenciador, tenantId, profissionalId),
      this.buscarComunicacoesEmAlerta(gerenciador, tenantId, profissionalId)
    ]);
    return this.montarResumo({ consultas, pacientes, tarefas, envios, solicitacoes, mensagens, periodo: filtros.periodo, profissionalId });
  });
}
```

Implement `DashboardAlertaOcultoOrm` as `(tenantId, usuarioId, alertaId, ocultoAteEm)` with RLS and unique index. The service ignores an alert only while `ocultoAteEm > now`; high-priority risk alerts are never hidden. `ControladorDashboardClinico` uses `@Papeis('SuperAdmin', 'Professional')`, `@Permissoes('dashboard.ler')`, validates period, writes `dashboard.clinico.consultar_contexto_terceiro` only for SuperAdmin with an explicit professional, and never trusts a role or professional supplied in request body.

- [ ] **Step 4: Add controller tests and module registration**

```ts
@Get('clinico')
async obter(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() req: Request, @Query() filtros: FiltrosDashboardClinicoDto) {
  const resumo = await this.servico.obterResumo(usuario.tenantId, filtros, usuario);
  if (usuario.papel === 'SuperAdmin' && filtros.profissionalId) await this.auditoria.registrar(/* contexto sem PII */);
  return resumo;
}
```

Register `ModuloDashboard` in `ModuloAplicacao`, including all read-only entities needed by the aggregate and `UserActionLogOrm` for auditing.

- [ ] **Step 5: Run focused verification and commit**

Run: `pnpm --dir octaclin-backend exec jest servico-dashboard-clinico.spec.ts servico-agenda.spec.ts servico-questionarios.spec.ts --runInBand; pnpm --dir octaclin-backend typecheck`

Expected: PASS for tenant boundary, Professional override prevention, SuperAdmin selection audit, 30/60/90+ bucketing, alert priority and dismissal expiration.

```bash
git add octaclin-backend/src/modulos/dashboard octaclin-backend/src/modulo-aplicacao.ts octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001004-CriarAlertasOcultosDashboardClinico.ts
git commit -m "Adiciona resumo clinico por profissional"
```

### Task 4: BFF e painel clinico acionavel

**Files:**
- Create: `octaclin-web/app/api/dashboard/clinico/route.ts`
- Create: `octaclin-web/app/api/dashboard/clinico/alertas/[alertaId]/ocultar/route.ts`
- Create: `octaclin-web/app/api/agenda/consultas/[consultaId]/desfecho/route.ts`
- Modify: `octaclin-web/lib/dashboard-api.ts`
- Modify: `octaclin-web/lib/agenda-api.ts`
- Modify: `octaclin-web/lib/questionarios-api.ts`
- Modify: `octaclin-web/components/dashboard/painel-dashboard.tsx`
- Modify: `octaclin-web/app/dashboard/page.tsx`
- Modify: `octaclin-web/lib/server/autorizacao-rotas.ts`
- Test: `octaclin-web/tests/visual/console-regression.spec.mjs`
- Test: `octaclin-web/scripts/test-autorizacao-rotas.mjs`

**Interfaces:**
- Consumes `ResumoDashboardClinicoDto` via `GET /api/dashboard/clinico`.
- BFF accepts only `periodo` and, for `SuperAdmin`, `profissionalId`; it sends `x-octaclin-origem: dashboard_clinico` only when invoking an action.
- Produces `PainelDashboardClinico` with responsive daily queues and quick-action controls.

- [ ] **Step 1: Write failing BFF, role and visual tests**

```js
test('Professional nao consegue escolher painel de outro profissional', async ({ page }) => {
  await page.goto('/dashboard?profissionalId=profissional-2');
  await expect(page.getByText('Painel clinico de Dra. Carla')).toBeVisible();
  await expect(page.getByLabel('Profissional em contexto')).toHaveCount(0);
});

test('SuperAdmin seleciona profissional e conclui tarefa sem overflow', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByLabel('Profissional em contexto').selectOption('profissional-2');
  await page.getByRole('button', { name: 'Concluir tarefa' }).click();
  await expect(page.getByText('Tarefa concluida.')).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).resolves.toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --dir octaclin-web test:authz; pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "painel clinico" --project=desktop-chromium --project=mobile-chromium --reporter=list`

Expected: FAIL because no clinical BFF or selector/action controls exist.

- [ ] **Step 3: Implement authenticated BFF and typed client**

```ts
export async function GET(request: NextRequest) {
  const sessao = await exigirPermissaoBff('dashboard.ler');
  const periodo = validarPeriodo(request.nextUrl.searchParams.get('periodo'));
  const profissionalIdSolicitado = request.nextUrl.searchParams.get('profissionalId');
  const profissionalId = sessao.papel === 'SuperAdmin' ? profissionalIdSolicitado : undefined;
  const resposta = await requisitarBackendAutenticado(`/dashboard/clinico?periodo=${periodo}${profissionalId ? `&profissionalId=${encodeURIComponent(profissionalId)}` : ''}`);
  return encaminharJson(resposta);
}
```

Return `403` before backend access for roles other than `Professional` and `SuperAdmin`. The action routes must use the existing task, questionnaire, agenda and solicitation endpoints, with an explicit dashboard origin header. Do not expose backend URLs, bearer tokens or raw message payloads to the component.

- [ ] **Step 4: Implement focused clinical UX**

Use compact bands, not nested cards: top filters and context; stable KPI tiles; priority queue; two-column operational queues on desktop; one-column on mobile. Use `Select` for SuperAdmin context, segmented period controls, Lucide icon buttons with tooltips for quick actions and `Botao` text commands only for clear operations. Render a persistent context warning for SuperAdmin, empty states per queue, retry state and a confirmation dialog before destructive actions.

The queue must display the 30/60/90+ return labels, risk level, task due date, form response date, request slot and communication status. `Criar retorno` navigates to `/agenda` with patient/professional query parameters; the agenda panel reads those parameters once and pre-fills the form without scheduling automatically.

- [ ] **Step 5: Run focused verification and commit**

Run: `pnpm --dir octaclin-web test:authz; pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "painel clinico" --project=desktop-chromium --project=mobile-chromium --reporter=list; pnpm --dir octaclin-web lint; pnpm --dir octaclin-web typecheck; pnpm --dir octaclin-web build`

Expected: PASS for role restrictions, SuperAdmin context, quick task/form/appointment actions and responsive layout.

```bash
git add octaclin-web/app/api/dashboard octaclin-web/app/api/agenda/consultas octaclin-web/lib/dashboard-api.ts octaclin-web/lib/agenda-api.ts octaclin-web/lib/questionarios-api.ts octaclin-web/components/dashboard/painel-dashboard.tsx octaclin-web/app/dashboard/page.tsx octaclin-web/lib/server/autorizacao-rotas.ts octaclin-web/tests/visual/console-regression.spec.mjs octaclin-web/scripts/test-autorizacao-rotas.mjs
git commit -m "Aprimora painel clinico do profissional"
```

### Task 5: Regressao, documentacao e publicacao da fase

**Files:**
- Create: `fase-145-painel-clinico-profissional.md`
- Modify: `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- Modify: `RESUMO_FASES_CONCLUIDAS.md`
- Modify: `STATUS_ATUAL_PROJETO.md`
- Modify: `octaclin-web/tests/visual/jornadas-criticas.spec.mjs`

**Interfaces:**
- Consumes the clinical aggregate and quick actions from Tasks 1-4.
- Produces the acceptance record and an end-to-end professional/SuperAdmin clinical panel journey.

- [ ] **Step 1: Add failing critical journey**

```js
test('SuperAdmin acompanha outro profissional sem conceder o mesmo escopo a Collaborator', async ({ page }) => {
  await prepararSessaoSuperAdmin(page);
  await page.goto('/dashboard');
  await page.getByLabel('Profissional em contexto').selectOption('profissional-2');
  await expect(page.getByText('90+ dias sem retorno')).toBeVisible();
  await prepararSessaoCollaborator(page);
  await page.goto('/dashboard?profissionalId=profissional-2');
  await expect(page.getByText('Acesso restrito ao painel clinico')).toBeVisible();
});
```

- [ ] **Step 2: Run journey to verify failure**

Run: `pnpm --dir octaclin-web test:e2e:criticas`

Expected: FAIL until the new API, BFF and context policy are complete.

- [ ] **Step 3: Document acceptance and operational limits**

Document the 30-day completed-consultation rule, 30/60/90+ buckets, outcome semantics, SuperAdmin audit, no raw communication preview, task/form mutations, and the fact that Google Calendar still follows the existing agenda flow.

- [ ] **Step 4: Run final verification**

Run: `pnpm --dir octaclin-backend test --runInBand; pnpm --dir octaclin-backend typecheck; pnpm --dir octaclin-web lint; pnpm --dir octaclin-web typecheck; pnpm --dir octaclin-web build; pnpm --dir octaclin-web test:e2e:criticas; pnpm security:secrets; powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`

Expected: all commands return exit code 0 and no secret scanner finding.

- [ ] **Step 5: Commit and publish**

```bash
git add fase-145-painel-clinico-profissional.md CHECKLIST_FASES_FUTURAS_PRODUCAO.md RESUMO_FASES_CONCLUIDAS.md STATUS_ATUAL_PROJETO.md octaclin-web/tests/visual/jornadas-criticas.spec.mjs
git commit -m "Conclui fase 145 de painel clinico"
git push origin HEAD:main
```
