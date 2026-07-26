# Agendamento Publico por Solicitacao Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que uma pessoa solicite um horario publico e que o profissional aprove a solicitacao para gerar uma consulta normal do OctaClin.

**Architecture:** O modulo Agenda ganha entidades para link publico e solicitacao, um servico publico sem JWT e um fluxo autenticado de decisao. A aprovacao delega a criacao para `ServicoAgenda.criarConsulta`, preservando conflito, Google Calendar e notificacoes existentes.

**Tech Stack:** NestJS 11, TypeORM 1.1, PostgreSQL/Neon, Next.js 15, React 18, Playwright e Jest.

## Global Constraints

- Tenant e profissional autenticado sao derivados do JWT; nenhuma rota autenticada aceita `tenantId` ou `profissionalId` externos como autoridade.
- Tokens publicos sao aleatorios, persistidos somente como SHA-256 e retornados apenas no momento de criacao ou rotacao.
- Nome, email, WhatsApp e observacao de solicitacao permanecem criptografados em repouso.
- Uma solicitacao pendente nao cria paciente, consulta, mensagem ou evento no Google Calendar.
- Aprovacao exige paciente existente do mesmo tenant e revalida disponibilidade antes de criar a consulta.
- O endpoint publico retorna somente nome do profissional, timezone, duracao e horarios livres; nunca contatos, IDs internos ou agenda completa.
- Testes novos devem ser escritos e executados em falha antes do codigo de producao correspondente.

---

## File Structure

- `octaclin-backend/src/modulos/agenda/infraestrutura/agenda-link-publico.orm.ts`: token hash, estado e configuracao por profissional.
- `octaclin-backend/src/modulos/agenda/infraestrutura/agenda-solicitacao.orm.ts`: solicitacao criptografada, horario, estado, expiracao e referencias de decisao.
- `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001000-CriarAgendamentoPublico.ts`: tabelas, constraints e indices tenant/profissional/estado.
- `octaclin-backend/src/modulos/agenda/aplicacao/servico-agendamento-publico.ts`: contratos publicos, horarios livres, criacao e decisao autenticada.
- `octaclin-backend/src/modulos/agenda/apresentacao/controlador-agendamento-publico.ts`: endpoints sem JWT para leitura/envio.
- `octaclin-backend/src/modulos/agenda/apresentacao/controlador-agenda.ts`: endpoints autenticados de link e solicitacoes.
- `octaclin-web/app/agendar/[token]/page.tsx` e `octaclin-web/components/agenda/formulario-agendamento-publico.tsx`: experiencia publica de tarefa unica.
- `octaclin-web/app/api/agendamentos-publicos/[token]/route.ts` e `.../solicitacoes/route.ts`: proxy publico sem cookies de sessao.
- `octaclin-web/app/api/agenda/agendamento-publico/route.ts` e `.../solicitacoes/**/route.ts`: BFF autenticado.
- `octaclin-web/lib/agendamento-publico-api.ts` e `octaclin-web/lib/agenda-api.ts`: contratos tipados.
- `octaclin-web/components/agenda/painel-agenda.tsx`: link, solicitacoes pendentes e decisao.
- `fase-144-agendamento-publico-solicitacao.md`, `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `RESUMO_FASES_CONCLUIDAS.md`, `STATUS_ATUAL_PROJETO.md`: evidencias e encerramento.

## Task 1: Modelo persistente e contratos de dominio

**Files:**
- Create: `octaclin-backend/src/modulos/agenda/infraestrutura/agenda-link-publico.orm.ts`
- Create: `octaclin-backend/src/modulos/agenda/infraestrutura/agenda-solicitacao.orm.ts`
- Create: `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000001000-CriarAgendamentoPublico.ts`
- Modify: `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts`
- Modify: `octaclin-backend/src/modulos/agenda/modulo-agenda.ts`
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/dtos.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/dtos-agendamento-publico.spec.ts`

**Interfaces:**
- Produces `AgendaLinkPublicoOrm` with `tenantId`, `profissionalId`, `tokenHash`, `ativo`, `duracaoMinutos`, `criadoEm`, `atualizadoEm`.
- Produces `AgendaSolicitacaoOrm` with `tenantId`, `profissionalId`, `inicioEm`, `fimEm`, `nomeCriptografado`, `contatoCriptografado`, `observacaoCriptografada`, `status`, `expiraEm`, `decididaEm`, `decididaPorUsuarioId`, `pacienteId` e `consultaId`.
- Produces DTOs `CriarSolicitacaoAgendamentoPublicoDto`, `AprovarSolicitacaoAgendamentoDto` e `RecusarSolicitacaoAgendamentoDto`.

- [ ] **Step 1: Write the failing DTO validation test**

```ts
it('rejeita dados publicos sem contato valido ou horario ISO', async () => {
  const dados = Object.assign(new CriarSolicitacaoAgendamentoPublicoDto(), {
    nome: '', email: 'invalido', inicioEm: 'amanha'
  });
  const erros = await validate(dados);
  expect(erros.map((erro) => erro.property)).toEqual(expect.arrayContaining(['nome', 'email', 'inicioEm']));
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm --dir octaclin-backend exec jest dtos-agendamento-publico.spec.ts --runInBand`

Expected: FAIL because the DTO and its validation contract do not exist.

- [ ] **Step 3: Implement entities, DTOs, migration and module registration**

```ts
@Entity('agenda_solicitacoes')
export class AgendaSolicitacaoOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') tenantId: string;
  @Column('uuid') profissionalId: string;
  @Column('timestamptz') inicioEm: Date;
  @Column('timestamptz') fimEm: Date;
  @Column({ type: 'varchar', length: 32, default: 'pendente' })
  status: 'pendente' | 'aprovada' | 'recusada' | 'expirada';
}
```

Create a migration with foreign keys to `tenants`, `profissionais`, `pacientes`, `agenda_consultas` and `usuarios`; add indexes on `(tenant_id, profissional_id, status, inicio_em)` and a unique index on `agenda_links_publicos.token_hash`.

- [ ] **Step 4: Run targeted test and migration compilation**

Run: `pnpm --dir octaclin-backend exec jest dtos-agendamento-publico.spec.ts --runInBand; pnpm --dir octaclin-backend typecheck`

Expected: PASS; entities are listed in `opcoes-typeorm.ts`, migration list and `TypeOrmModule.forFeature`.

- [ ] **Step 5: Commit the persistent model**

```bash
git add octaclin-backend/src/modulos/agenda octaclin-backend/src/infraestrutura/banco-dados
git commit -m "Adiciona modelo de solicitacoes de agendamento publico"
```

## Task 2: Consulta publica de disponibilidade e envio protegido

**Files:**
- Create: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agendamento-publico.ts`
- Create: `octaclin-backend/src/modulos/agenda/apresentacao/controlador-agendamento-publico.ts`
- Modify: `octaclin-backend/src/modulos/agenda/modulo-agenda.ts`
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agendamento-publico.spec.ts`

**Interfaces:**
- Consumes the Task 1 entities and `ServicoProtecaoAbuso`.
- Produces `GET /agendamentos-publicos/:token` with `{ profissionalNome, timezone, duracaoMinutos, horariosLivres }`.
- Produces `POST /agendamentos-publicos/:token/solicitacoes` with a neutral response `{ status: 'pendente' }`.

- [ ] **Step 1: Write failing public-flow tests**

```ts
it('mantem solicitacao pendente sem paciente ou consulta', async () => {
  const solicitacao = await servico.criarSolicitacaoPublica('token-valido', {
    nome: 'Ana Silva', email: 'ana@exemplo.com', inicioEm: '2026-08-01T13:00:00.000Z'
  }, '203.0.113.5');
  expect(solicitacao).toMatchObject({ status: 'pendente', pacienteId: undefined, consultaId: undefined });
});

it('nao retorna consultas ou contatos no resumo publico', async () => {
  const resumo = await servico.obterAgendaPublica('token-valido', '203.0.113.5');
  expect(resumo).toEqual(expect.objectContaining({ profissionalNome: 'Dra. Carla', horariosLivres: expect.any(Array) }));
  expect(JSON.stringify(resumo)).not.toContain('pacienteId');
});

it('rejeita envio para horario que deixou de estar livre', async () => {
  await expect(servico.criarSolicitacaoPublica('token-valido', dados, '203.0.113.5')).rejects.toThrow('Horario indisponivel');
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm --dir octaclin-backend exec jest servico-agendamento-publico.spec.ts --runInBand`

Expected: FAIL because public availability and token lookup are absent.

- [ ] **Step 3: Implement the public service and controller**

```ts
@Controller('agendamentos-publicos')
export class ControladorAgendamentoPublico {
  @Get(':token') obter(@Param('token') token: string, @Req() req: Request) {
    return this.servico.obterAgendaPublica(token, req.ip);
  }
  @Post(':token/solicitacoes') criar(@Param('token') token: string, @Body() dados: CriarSolicitacaoAgendamentoPublicoDto, @Req() req: Request) {
    return this.servico.criarSolicitacaoPublica(token, dados, req.ip);
  }
}
```

Hash the raw token with `createHash('sha256')`; use `ServicoProtecaoAbuso.consumirTentativa` before token lookup and submission; calculate open slots in a 30-day window by excluding `AgendaConsultaOrm` records with `status: 'agendada'` and `AgendaBloqueioExternoOrm` overlaps; encrypt all submitted sensitive values before save.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --dir octaclin-backend exec jest servico-agendamento-publico.spec.ts --runInBand`

Expected: PASS for inactive/unknown token, rate limit, empty availability, conflict revalidation and no sensitive public response.

- [ ] **Step 5: Commit the public API**

```bash
git add octaclin-backend/src/modulos/agenda
git commit -m "Adiciona API publica de solicitacoes de agenda"
```

## Task 3: Gestao autenticada, decisao e delegacao para agenda existente

**Files:**
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agendamento-publico.ts`
- Modify: `octaclin-backend/src/modulos/agenda/apresentacao/controlador-agenda.ts`
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agendamento-publico.spec.ts`
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.spec.ts`

**Interfaces:**
- Produces `GET /agenda/agendamento-publico`, `POST /agenda/agendamento-publico/rotacionar`, `GET /agenda/solicitacoes`, `POST /agenda/solicitacoes/:solicitacaoId/aprovar`, and `POST /agenda/solicitacoes/:solicitacaoId/recusar`.
- `aprovarSolicitacao(tenantId, solicitacaoId, { pacienteId }, usuario)` calls `ServicoAgenda.criarConsulta(tenantId, entrada, usuario)` only after a pending-state and conflict check.

- [ ] **Step 1: Write failing authorization and decision tests**

```ts
it('impede profissional de aprovar solicitacao de outro profissional', async () => {
  await expect(servico.aprovarSolicitacao('tenant-1', 'sol-1', { pacienteId: 'pac-1' }, profissionalDois))
    .rejects.toThrow('Solicitacao nao encontrada');
});

it('aprova somente uma vez e delega a criacao para a agenda', async () => {
  await servico.aprovarSolicitacao('tenant-1', 'sol-1', { pacienteId: 'pac-1' }, profissionalUm);
  expect(servicoAgenda.criarConsulta).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ pacienteId: 'pac-1' }), profissionalUm);
});
```

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `pnpm --dir octaclin-backend exec jest servico-agendamento-publico.spec.ts servico-agenda.spec.ts --runInBand`

Expected: FAIL because internal decision endpoints and state transition do not exist.

- [ ] **Step 3: Implement decision methods and guarded controller routes**

```ts
@Post('solicitacoes/:solicitacaoId/aprovar')
@Permissoes('agenda.consultas.criar')
aprovar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('solicitacaoId', ParseUUIDPipe) id: string, @Body() dados: AprovarSolicitacaoAgendamentoDto) {
  return this.servicoAgendamentoPublico.aprovarSolicitacao(usuario.tenantId, id, dados, usuario);
}
```

Resolve the authenticated professional with `resolverProfissionalIdDoUsuario`; for a `Professional`, filter every query by that ID. Mark state and `consultaId` in the same tenant transaction after successful agenda creation. Register audit actions `agenda.solicitacao.aprovar`, `agenda.solicitacao.recusar` and `agenda.link_publico.rotacionar` without contact values in metadata.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --dir octaclin-backend exec jest servico-agendamento-publico.spec.ts servico-agenda.spec.ts --runInBand; pnpm --dir octaclin-backend typecheck`

Expected: PASS for tenant isolation, professional scope, expired/decided state, no duplicate approval and delegated integration flow.

- [ ] **Step 5: Commit authenticated management**

```bash
git add octaclin-backend/src/modulos/agenda
git commit -m "Adiciona aprovacao de solicitacoes de agenda"
```

## Task 4: BFF e interfaces publica e interna

**Files:**
- Create: `octaclin-web/app/agendar/[token]/page.tsx`
- Create: `octaclin-web/components/agenda/formulario-agendamento-publico.tsx`
- Create: `octaclin-web/lib/agendamento-publico-api.ts`
- Create: `octaclin-web/app/api/agendamentos-publicos/[token]/route.ts`
- Create: `octaclin-web/app/api/agendamentos-publicos/[token]/solicitacoes/route.ts`
- Create: `octaclin-web/app/api/agenda/agendamento-publico/route.ts`
- Create: `octaclin-web/app/api/agenda/agendamento-publico/rotacionar/route.ts`
- Create: `octaclin-web/app/api/agenda/solicitacoes/route.ts`
- Create: `octaclin-web/app/api/agenda/solicitacoes/[solicitacaoId]/aprovar/route.ts`
- Create: `octaclin-web/app/api/agenda/solicitacoes/[solicitacaoId]/recusar/route.ts`
- Modify: `octaclin-web/lib/agenda-api.ts`
- Modify: `octaclin-web/components/agenda/painel-agenda.tsx`
- Test: `octaclin-web/tests/visual/agendamento-publico.spec.mjs`

**Interfaces:**
- Public client calls `GET/POST /api/agendamentos-publicos/:token` without browser auth.
- Internal client calls the BFF endpoints and receives `SolicitacaoAgendaPublicaApi` with decrypted fields only after session authorization.

- [ ] **Step 1: Write the failing visual tests**

```js
test('envia solicitacao sem mostrar dados de outros pacientes', async ({ page }) => {
  await page.goto('/agendar/token-publico');
  await page.getByRole('button', { name: '10:00' }).click();
  await page.getByLabel('Nome completo').fill('Ana Silva');
  await page.getByLabel('Email').fill('ana@exemplo.com');
  await page.getByRole('button', { name: 'Enviar solicitacao' }).click();
  await expect(page.getByText('Solicitacao enviada para analise.')).toBeVisible();
  await expect(page.getByText('pacienteId')).toHaveCount(0);
});
```

- [ ] **Step 2: Run the visual test to verify it fails**

Run: `pnpm --dir octaclin-web exec playwright test tests/visual/agendamento-publico.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list`

Expected: FAIL because `/agendar/[token]` and BFF routes do not exist.

- [ ] **Step 3: Implement public page, proxy routes and internal agenda controls**

```tsx
<form onSubmit={enviarSolicitacao} className="grid gap-4">
  <input aria-label="Nome completo" required maxLength={180} />
  <input aria-label="Email" type="email" required maxLength={180} />
  <button type="submit">Enviar solicitacao</button>
</form>
```

The public page must show one selected slot, formatted date/time, required name/email, optional WhatsApp/observation, loading/error/success states and no navigation to authenticated areas. The internal panel must expose current link, rotate action, a pending-request list, patient selector and explicit approve/refuse buttons. Use existing `Botao`, `Campo`, `Cartao` and Lucide icons; preserve fixed control dimensions and responsive layout without horizontal overflow.

- [ ] **Step 4: Run visual, authorization and build checks**

Run: `pnpm --dir octaclin-web typecheck; pnpm --dir octaclin-web test:authz; pnpm --dir octaclin-web exec playwright test tests/visual/agendamento-publico.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list; pnpm --dir octaclin-web build`

Expected: PASS in both viewports, public proxy works without cookies, and internal BFF returns 401 without session.

- [ ] **Step 5: Commit web experience**

```bash
git add octaclin-web/app octaclin-web/components octaclin-web/lib octaclin-web/tests/visual
git commit -m "Adiciona interface de agendamento publico"
```

## Task 5: Fechamento, regressao e documentacao de fase

**Files:**
- Create: `fase-144-agendamento-publico-solicitacao.md`
- Modify: `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- Modify: `RESUMO_FASES_CONCLUIDAS.md`
- Modify: `STATUS_ATUAL_PROJETO.md`
- Modify: `octaclin-web/tests/visual/jornadas-criticas.spec.mjs`

**Interfaces:**
- Consumes all routes and interfaces from Tasks 1-4.
- Produces evidence that Fase 144 is complete and records pending product decisions outside its scope.

- [ ] **Step 1: Add a failing critical journey assertion**

```js
await expect(page.getByText('Solicitacao enviada para analise.')).toBeVisible();
await expect(agendaInterna.getByRole('button', { name: 'Aprovar solicitacao' })).toBeVisible();
```

- [ ] **Step 2: Run regression before final documentation**

Run: `pnpm --dir octaclin-web test:e2e:criticas`

Expected: FAIL until the public-to-internal approval journey is covered by the implemented flow.

- [ ] **Step 3: Document acceptance criteria and operational limits**

Record that a public request does not reserve the slot, patient selection is mandatory at approval, and confirmation notifications occur only after standard agenda creation. Mark Fase 144 complete only after all commands below pass.

- [ ] **Step 4: Run final verification**

Run: `pnpm --dir octaclin-backend test --runInBand; pnpm --dir octaclin-backend typecheck; pnpm --dir octaclin-web lint; pnpm --dir octaclin-web typecheck; pnpm --dir octaclin-web build; pnpm --dir octaclin-web test:e2e:criticas; pnpm security:secrets; powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`

Expected: all commands return exit code 0; no secret scanner findings; documents report the final test counts.

- [ ] **Step 5: Commit and publish the phase record**

```bash
git add fase-144-agendamento-publico-solicitacao.md CHECKLIST_FASES_FUTURAS_PRODUCAO.md RESUMO_FASES_CONCLUIDAS.md STATUS_ATUAL_PROJETO.md octaclin-web/tests/visual/jornadas-criticas.spec.mjs
git commit -m "Conclui fase de agendamento publico por solicitacao"
git push origin HEAD:main
```
