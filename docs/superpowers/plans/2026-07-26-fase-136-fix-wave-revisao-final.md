# Fase 136 - Onda de correcao da revisao final (2 Critical + 7 Important) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 9 findings (2 Critical, 7 Important) from the final whole-branch review of Fase 136 (Google Calendar sync), logged in `.superpowers/sdd/2026-07-25-fase-136-google-calendar-sync/progress.md` lines 29-32, without regressing any of the 46 currently-green backend Jest suites.

**Architecture:** Each finding is fixed at its root cause, reusing established project patterns: `requisitarBackendAutenticado` for BFF-to-backend auth (already used by every other BFF route except the broken one), `ExecutorTenant.executar` for RLS-scoped queries, TypeORM query operators for time-bounded lookups (the migration already created the composite index this enables), and the `REDIS_PROTECAO_ABUSO`-style DI token pattern (already proven in `octaclin-backend/src/modulos/auth/modulo-auth.ts`) for Redis-backed OAuth nonce storage.

**Tech Stack:** NestJS/TypeORM backend, Next.js App Router BFF, ioredis, BullMQ, Jest.

## Global Constraints

- Every task must keep `pnpm --dir octaclin-backend typecheck` and the full `pnpm --dir octaclin-backend test --runInBand` suite green (currently 46 suites / 224+ tests).
- Follow this codebase's existing module convention: each NestJS module that needs `CriptografiaDadosSensiveis` or a Redis client re-declares it as its own local provider (see `ModuloAgenda`, `ModuloAuth`) rather than importing a shared module for it. Do the same for any new provider added in this plan.
- Multi-tenant tables (`profissionais_google_conexao`, `agenda_bloqueios_externos`) are RLS-protected (`FORCE ROW LEVEL SECURITY`) - all access MUST go through `ExecutorTenant.executar(tenantId, ...)`. `google_canais_watch` intentionally has no RLS (routing-only table, pre-existing decision from Fase 136) - direct `DataSource` access there is correct, not a bug.
- No new npm dependencies. No unrelated refactors - each task touches only the files needed to fix its assigned finding(s).
- Commit after each task (small, validated commits), matching this project's direct-to-`main` convention (no worktree, no feature branch, per prior session decisions).
- Portuguese (pt-BR) identifiers and error messages, matching 100% of the existing codebase.

---

### Task 1: Fix OAuth `conectar` redirect flow (CRITICAL finding #1)

**Root cause:** `octaclin-web/app/api/agenda/google/conectar/route.ts` does a bare `NextResponse.redirect()` straight to the NestJS backend's `GET /agenda/google/conectar`, sent by the browser as a top-level navigation (triggered by `window.location.href` in `conectarGoogleAgenda()`). A top-level browser navigation carries cookies but never the `Authorization` header that `GuardaJwt` requires - every other BFF route avoids this by calling `requisitarBackendAutenticado()` server-side (in the Next.js server process, which holds the session and injects `Authorization: Bearer <token>` itself) before ever showing the browser a URL. This route is the only one that skips that call, so it 401s every time in production.

**Fix:** Make `conectar/route.ts` call the backend server-side via `requisitarBackendAutenticado` (like `status/route.ts` and `desconectar/route.ts` already do) to fetch the Google authorization URL as JSON, then have the BFF issue the browser redirect straight to that Google URL (which needs no auth header - it's a public Google endpoint). Change the backend's `GET conectar` endpoint from an auto-redirecting `@Redirect()` to a plain JSON `{ url }` response, since it is now always called by a server-side authenticated fetch, never by direct browser navigation.

**Files:**
- Modify: `octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts:38-47`
- Modify: `octaclin-web/app/api/agenda/google/conectar/route.ts`

**Interfaces:**
- Consumes: `ServicoConexaoGoogleCalendar.gerarUrlAutorizacao(tenantId, profissionalId, urlCallback): string` (unchanged).
- Produces: `GET /agenda/google/conectar` (backend) now returns `200 { url: string }` instead of a `302` redirect. `GET /api/agenda/google/conectar` (BFF) still ends in a `302` redirect to Google, unchanged from the frontend's point of view (`conectarGoogleAgenda()` in `lib/agenda-api.ts` needs no change).

- [ ] **Step 1: Change the backend `conectar` endpoint to return JSON instead of auto-redirecting**

In `octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts`, replace:

```ts
  @Get('conectar')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('agenda.consultas.ler')
  @Redirect()
  async conectar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    const url = this.servicoConexao.gerarUrlAutorizacao(usuario.tenantId, profissionalId, urlCallback());
    return { url, statusCode: 302 };
  }
```

with:

```ts
  @Get('conectar')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('agenda.consultas.ler')
  async conectar(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<{ url: string }> {
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    const url = this.servicoConexao.gerarUrlAutorizacao(usuario.tenantId, profissionalId, urlCallback());
    return { url };
  }
```

`Redirect` stays imported (the `callback` endpoint below still uses `@Redirect()`) - do not remove the import.

- [ ] **Step 2: Fix the BFF route to call the backend server-side and forward the redirect**

Replace the full contents of `octaclin-web/app/api/agenda/google/conectar/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const resposta = await requisitarBackendAutenticado('/agenda/google/conectar');
    if (!resposta.ok) {
      const detalhe = await resposta.text();
      return NextResponse.json(
        { mensagem: detalhe || 'Falha ao iniciar conexao com a Google Agenda.' },
        { status: resposta.status }
      );
    }
    const corpo = (await resposta.json()) as { url?: string };
    if (!corpo.url) {
      return NextResponse.json({ mensagem: 'Resposta invalida do backend ao gerar URL de autorizacao.' }, { status: 502 });
    }
    return NextResponse.redirect(corpo.url);
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    throw erro;
  }
}
```

This removes the route's prior direct read of `OCTACLIN_BACKEND_URL` (a second source of truth for the backend URL, minor finding from the same review) since `requisitarBackendAutenticado` already resolves that from the authenticated session.

- [ ] **Step 3: Typecheck both projects**

Run: `pnpm --dir octaclin-backend typecheck` and `pnpm --dir octaclin-web typecheck`
Expected: both PASS with no errors.

- [ ] **Step 4: Commit**

```bash
git add octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts octaclin-web/app/api/agenda/google/conectar/route.ts
git commit -m "Corrige fluxo OAuth conectar Google Agenda (401 garantido em producao)"
```

---

### Task 2: Harden inbound sync - 410 recovery, pagination, conditional syncToken persistence, revoked-token detection

Covers CRITICAL finding #2 and IMPORTANT findings #4, #6, #7 - all four live in the same two functions (`ServicoGoogleCalendar.listarEventosAlterados` and `ServicoSincronizacaoGoogleCalendar.reconciliar`), so they are fixed together to avoid two separate diffs touching the same control flow.

**Root causes:**
- **#2 (410 unhandled):** `listarEventosAlterados` throws a generic `InternalServerErrorException` on any non-OK response, losing the HTTP status. Google returns `410 GONE` when a `syncToken` expires (a routine, documented occurrence) - this needs to be caught distinctly so the caller can clear the stale token and do a full resync, instead of the whole sync silently and permanently breaking for that professional.
- **#6 (pagination not followed):** `listarEventosAlterados` reads only the first page (`items` + `nextSyncToken`/`nextPageToken` from one response) and ignores `nextPageToken` entirely. Google only returns `nextSyncToken` on the *final* page of a paginated response - so with more than one page of changes, events past page 1 are silently dropped and the sync token is never captured (since it never appears on page 1), starving future syncs.
- **#7 (failed events still advance syncToken):** `reconciliar` persists `proximoSyncToken` unconditionally, even when some events in the batch failed to apply (caught and logged, not re-thrown). That failed event is never retried, and Google will never resend it once the token has moved past it - a silent, permanent per-event data loss.
- **#4 (revoked token never detected):** When a professional revokes OctaClin's access from their Google account, the OAuth refresh call returns `error: 'invalid_grant'`. `obterAccessToken` throws the same generic `InternalServerErrorException` as any other failure, so nothing ever sets `desconectadoEm` - the UI keeps claiming the professional is connected, and every sync attempt fails forever with no path back to a working state (the professional can never see "disconnected" and reconnect).

**Files:**
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.ts`
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.spec.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.spec.ts`

**Interfaces:**
- Consumes: `ServicoConexaoGoogleCalendar.desconectar(tenantId, profissionalId): Promise<void>` (already exists, unchanged).
- Produces: two new exported error classes from `servico-google-calendar.ts` - `SyncTokenExpiradoError` and `TokenRevogadoError` (both plain `Error` subclasses, no fields) - that `servico-sincronizacao-google-calendar.ts` and any future caller can catch with `instanceof`. `listarEventosAlterados`'s return type is unchanged (`{ eventos: EventoGoogleAlterado[]; proximoSyncToken?: string }`) but now aggregates every page.

- [ ] **Step 1: Add the two error classes and detect revoked tokens in `obterAccessToken`**

In `octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.ts`, add near the top (after the existing interfaces, before the `textoEnv` helper):

```ts
export class SyncTokenExpiradoError extends Error {
  constructor() {
    super('Sync token do Google Calendar expirou (410); e necessario resincronizar do zero.');
    this.name = 'SyncTokenExpiradoError';
  }
}

export class TokenRevogadoError extends Error {
  constructor() {
    super('Refresh token do Google Calendar foi revogado pelo usuario.');
    this.name = 'TokenRevogadoError';
  }
}
```

Then in the private `obterAccessToken` method, replace:

```ts
    if (!resposta.ok || !corpo.access_token) {
      const detalhe = corpo.error_description ?? corpo.error ?? `HTTP ${resposta.status}`;
      throw new InternalServerErrorException(`Falha ao renovar token Google Calendar: ${detalhe}`);
    }
```

with:

```ts
    if (!resposta.ok || !corpo.access_token) {
      if (corpo.error === 'invalid_grant') throw new TokenRevogadoError();
      const detalhe = corpo.error_description ?? corpo.error ?? `HTTP ${resposta.status}`;
      throw new InternalServerErrorException(`Falha ao renovar token Google Calendar: ${detalhe}`);
    }
```

- [ ] **Step 2: Rewrite `listarEventosAlterados` to paginate and detect 410**

Replace the entire method body:

```ts
  async listarEventosAlterados(
    credenciais: CredenciaisGoogleCalendar,
    syncToken?: string
  ): Promise<{ eventos: EventoGoogleAlterado[]; proximoSyncToken?: string }> {
    const accessToken = await this.obterAccessToken(credenciais.clientId, credenciais.clientSecret, credenciais.refreshToken);
    const eventos: EventoGoogleAlterado[] = [];
    let proximoSyncToken: string | undefined;
    let pageToken: string | undefined;

    do {
      const parametros = new URLSearchParams({ showDeleted: 'true', singleEvents: 'true' });
      if (syncToken) parametros.set('syncToken', syncToken);
      if (pageToken) parametros.set('pageToken', pageToken);

      const resposta = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(credenciais.calendarId)}/events?${parametros.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const corpo = (await resposta.json()) as RespostaListaEventosGoogle;

      if (!resposta.ok) {
        if (resposta.status === 410) throw new SyncTokenExpiradoError();
        throw new InternalServerErrorException(`Falha ao listar eventos alterados: ${corpo.error?.message ?? `HTTP ${resposta.status}`}`);
      }

      for (const evento of corpo.items ?? []) {
        eventos.push({
          id: evento.id,
          status: evento.status,
          octaclinConsultaId: evento.extendedProperties?.private?.octaclinConsultaId,
          inicioEm: evento.start?.dateTime ? new Date(evento.start.dateTime) : undefined,
          fimEm: evento.end?.dateTime ? new Date(evento.end.dateTime) : undefined
        });
      }

      proximoSyncToken = corpo.nextSyncToken ?? proximoSyncToken;
      pageToken = corpo.nextPageToken;
    } while (pageToken);

    return { eventos, proximoSyncToken };
  }
```

- [ ] **Step 3: Update `servico-google-calendar.spec.ts` for pagination and 410**

Add these two tests inside the existing `describe('ServicoGoogleCalendar', ...)` block, after the `'listarEventosAlterados retorna eventos e o proximo syncToken'` test:

```ts
  it('listarEventosAlterados percorre todas as paginas via nextPageToken e so usa o nextSyncToken da ultima pagina', async () => {
    let chamada = 0;
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-4' }), { status: 200 });
      }
      chamada += 1;
      if (chamada === 1) {
        expect(String(url)).not.toContain('pageToken');
        return new Response(
          JSON.stringify({ items: [{ id: 'evento-pagina-1', status: 'confirmed' }], nextPageToken: 'pagina-2' }),
          { status: 200 }
        );
      }
      expect(String(url)).toContain('pageToken=pagina-2');
      return new Response(
        JSON.stringify({ items: [{ id: 'evento-pagina-2', status: 'confirmed' }], nextSyncToken: 'sync-final' }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.listarEventosAlterados({ clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'cal-1' });

    expect(resultado.eventos.map((evento) => evento.id)).toEqual(['evento-pagina-1', 'evento-pagina-2']);
    expect(resultado.proximoSyncToken).toBe('sync-final');
  });

  it('listarEventosAlterados lanca SyncTokenExpiradoError quando o Google responde 410', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-5' }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: 'Sync token is no longer valid' } }), { status: 410 });
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    await expect(
      servico.listarEventosAlterados({ clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'cal-1' }, 'token-antigo')
    ).rejects.toThrow(SyncTokenExpiradoError);
  });

  it('obterAccessToken (via criarEvento) lanca TokenRevogadoError quando o Google responde invalid_grant', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token-revogado';

    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }), { status: 400 })
    ) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.criarEvento({
      resumo: 'Consulta',
      descricao: 'desc',
      inicioEm: new Date('2026-08-01T10:00:00Z'),
      fimEm: new Date('2026-08-01T10:50:00Z'),
      timezone: 'America/Sao_Paulo',
      consultaId: 'consulta-1'
    });

    expect(resultado).toEqual({ sincronizado: false, motivo: 'falha_google_calendar', erro: expect.stringContaining('revogado') });
  });
```

Add the two new imports at the top of the file:

```ts
import { ServicoGoogleCalendar, SyncTokenExpiradoError } from './servico-google-calendar';
```

- [ ] **Step 4: Run the updated spec**

Run: `pnpm --dir octaclin-backend test --runInBand servico-google-calendar.spec.ts`
Expected: all tests PASS, including the 3 new ones.

- [ ] **Step 5: Rewrite `reconciliar` for revoked-token detection, 410 resync, and conditional token persistence**

In `octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.ts`, add to the imports:

```ts
import { EventoGoogleAlterado, ServicoGoogleCalendar, SyncTokenExpiradoError, TokenRevogadoError } from './servico-google-calendar';
```

(remove the bare `ServicoGoogleCalendar` import line it replaces).

Replace the `reconciliar` method body:

```ts
  async reconciliar(tenantId: string, profissionalId: string): Promise<void> {
    const credenciais = await this.servicoConexao.obterConexaoAtiva(tenantId, profissionalId);
    if (!credenciais) return;

    const syncToken = await this.obterSyncTokenArmazenado(tenantId, profissionalId);

    let resultado: { eventos: EventoGoogleAlterado[]; proximoSyncToken?: string };
    try {
      resultado = await this.googleCalendar.listarEventosAlterados(credenciais, syncToken);
    } catch (erro) {
      if (erro instanceof TokenRevogadoError) {
        this.logger.warn(`Refresh token revogado para profissional ${profissionalId}; desconectando integracao Google Agenda.`);
        await this.servicoConexao.desconectar(tenantId, profissionalId);
        return;
      }
      if (!(erro instanceof SyncTokenExpiradoError)) throw erro;
      this.logger.warn(`Sync token expirado para profissional ${profissionalId}; refazendo sincronizacao completa.`);
      await this.armazenarSyncToken(tenantId, profissionalId, undefined);
      resultado = await this.googleCalendar.listarEventosAlterados(credenciais, undefined);
    }

    const { eventos, proximoSyncToken } = resultado;
    let houveFalha = false;

    for (const evento of eventos) {
      try {
        await this.aplicarEvento(tenantId, profissionalId, evento);
      } catch (erro) {
        houveFalha = true;
        this.logger.warn(
          `Falha ao aplicar evento Google ${evento.id} durante reconciliacao: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
        );
      }
    }

    if (proximoSyncToken && !houveFalha) {
      await this.armazenarSyncToken(tenantId, profissionalId, proximoSyncToken);
    }
  }

  private async obterSyncTokenArmazenado(tenantId: string, profissionalId: string): Promise<string | undefined> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conexao = await gerenciador
        .getRepository(ProfissionalGoogleConexaoOrm)
        .findOne({ where: { tenantId, profissionalId } });
      return conexao?.ultimoSyncToken;
    });
  }

  private async armazenarSyncToken(tenantId: string, profissionalId: string, syncToken: string | undefined): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const conexao = await repositorio.findOne({ where: { tenantId, profissionalId } });
      if (!conexao) return;
      conexao.ultimoSyncToken = syncToken;
      await repositorio.save(conexao);
    });
  }
```

This replaces the old inline `syncToken` lookup block and the old inline "persist if truthy" block at the end of the method - remove both, they are now the two private helpers above.

- [ ] **Step 6: Add tests for revoked-token detection, 410 resync, and conditional persistence to `servico-sincronizacao-google-calendar.spec.ts`**

Add these three tests at the end of the `describe('ServicoSincronizacaoGoogleCalendar', ...)` block (before the closing `});`). They call `reconciliar` directly instead of `processarNotificacao`, since the canal lookup is not relevant here:

```ts
  it('desconecta a integracao quando o Google retorna token revogado (TokenRevogadoError)', async () => {
    const deps = construirDependencias();
    deps.googleCalendar.listarEventosAlterados = jest.fn(async () => {
      throw new TokenRevogadoError();
    });
    const servicoConexaoComDesconectar = { ...deps.servicoConexao, desconectar: jest.fn(async () => undefined) };

    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      servicoConexaoComDesconectar as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await expect(servico.reconciliar('tenant-1', 'prof-1')).resolves.not.toThrow();
    expect(servicoConexaoComDesconectar.desconectar).toHaveBeenCalledWith('tenant-1', 'prof-1');
  });

  it('refaz a sincronizacao do zero quando o sync token expirou (SyncTokenExpiradoError)', async () => {
    const deps = construirDependencias();
    let chamada = 0;
    deps.googleCalendar.listarEventosAlterados = jest.fn(async (_credenciais: unknown, syncToken?: string) => {
      chamada += 1;
      if (chamada === 1) {
        expect(syncToken).toBeUndefined();
        throw new SyncTokenExpiradoError();
      }
      expect(syncToken).toBeUndefined();
      return { eventos: [], proximoSyncToken: 'sync-recem-gerado' };
    });

    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await expect(servico.reconciliar('tenant-1', 'prof-1')).resolves.not.toThrow();
    expect(deps.googleCalendar.listarEventosAlterados).toHaveBeenCalledTimes(2);
  });

  it('nao avanca o syncToken armazenado quando algum evento do lote falhou ao ser aplicado', async () => {
    const deps = construirDependencias();
    deps.servicoAgenda.remarcarConsultaComoSistema = jest.fn(async () => {
      throw new Error('falha simulada ao aplicar evento');
    });

    const chamadasSave: unknown[] = [];
    deps.executorTenant.executar = jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
      callback({
        getRepository: () => ({
          findOne: jest.fn(async () => ({ tenantId: 'tenant-1', profissionalId: 'prof-1', ultimoSyncToken: 'sync-antigo' })),
          create: jest.fn((dados: any) => dados),
          save: jest.fn(async (dados: any) => {
            chamadasSave.push(dados);
            return dados;
          }),
          delete: jest.fn(async () => undefined)
        })
      })
    );

    const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await servico.reconciliar('tenant-1', 'prof-1');

    expect(chamadasSave.some((dados: any) => dados.ultimoSyncToken === 'novo-sync-token')).toBe(false);

    loggerWarnSpy.mockRestore();
  });
```

Add to the file's imports:

```ts
import { SyncTokenExpiradoError, TokenRevogadoError } from './servico-google-calendar';
```

- [ ] **Step 7: Run both updated specs and the full backend suite**

Run: `pnpm --dir octaclin-backend test --runInBand servico-google-calendar.spec.ts servico-sincronizacao-google-calendar.spec.ts`
Expected: all PASS.

Run: `pnpm --dir octaclin-backend typecheck && pnpm --dir octaclin-backend test --runInBand`
Expected: typecheck clean, full suite green.

- [ ] **Step 8: Commit**

```bash
git add octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.spec.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.spec.ts
git commit -m "Trata 410/paginacao/token revogado na sincronizacao inbound da Google Agenda"
```

---

### Task 3: Wire per-professional Google credentials into `ServicoOperacoes.executarSincronizacaoGoogle` (IMPORTANT finding #3)

**Root cause:** `ServicoAgenda`'s outbound calls (`criarEvento`/`atualizarEvento`/`cancelarEvento`) were already fixed in the original Task 10 security wave to resolve `credenciais` via `ServicoConexaoGoogleCalendar.obterConexaoAtiva(tenantId, consulta.profissionalId)` before calling `ServicoGoogleCalendar`. `ServicoOperacoes.executarSincronizacaoGoogle` (used by the operational "reprocessar Google Calendar" flow) is a second, independent caller of the same three methods that was never given the same fix - it still calls them with no `credenciais`, which means `ServicoGoogleCalendar` falls back to the old shared env-var calendar. Reprocessing from the ops panel can therefore create a duplicate event on the wrong (shared) calendar and permanently detach the consulta from the professional's real calendar.

**Fix:** Inject `ServicoConexaoGoogleCalendar` into `ServicoOperacoes` and resolve `credenciais` the same way `ServicoAgenda` does, before calling any of the three methods.

**Files:**
- Modify: `octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.ts`
- Modify: `octaclin-backend/src/modulos/operacoes/modulo-operacoes.ts`
- Test: `octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts`

**Interfaces:**
- Consumes: `ServicoConexaoGoogleCalendar.obterConexaoAtiva(tenantId, profissionalId): Promise<CredenciaisGoogleCalendar | undefined>` (already exists, unchanged).

- [ ] **Step 1: Inject `ServicoConexaoGoogleCalendar` into `ServicoOperacoes`**

In `octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.ts`, add the import:

```ts
import { ServicoConexaoGoogleCalendar } from '../agenda/aplicacao/servico-conexao-google-calendar';
```

Update the constructor:

```ts
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly processadorNotificacoes: ProcessadorNotificacoes,
    private readonly googleCalendar: ServicoGoogleCalendar,
    private readonly servicoConexaoGoogle: ServicoConexaoGoogleCalendar,
    private readonly servicoSaude: ServicoSaude
  ) {}
```

- [ ] **Step 2: Resolve credenciais in `executarSincronizacaoGoogle`**

Locate the call site that invokes `this.executarSincronizacaoGoogle(consulta)` (inside `reprocessarGoogleCalendar`) and change the method to accept `tenantId` so it can resolve credentials. Replace:

```ts
      const google = await this.executarSincronizacaoGoogle(consulta);
```

with:

```ts
      const google = await this.executarSincronizacaoGoogle(tenantId, consulta);
```

Then replace the `executarSincronizacaoGoogle` method itself:

```ts
  private async executarSincronizacaoGoogle(tenantId: string, consulta: AgendaConsultaOrm): Promise<ResultadoGoogleCalendar> {
    const credenciais = consulta.profissionalId
      ? await this.servicoConexaoGoogle.obterConexaoAtiva(tenantId, consulta.profissionalId)
      : undefined;
    const entrada = {
      resumo: consulta.titulo,
      descricao: this.montarDescricaoGoogleOperacional(consulta),
      inicioEm: consulta.inicioEm,
      fimEm: consulta.fimEm,
      timezone: consulta.timezone,
      local: consulta.local,
      consultaId: consulta.id,
      credenciais
    };
    if (consulta.status === 'cancelada' && consulta.googleCalendarId && consulta.googleEventId) {
      return this.googleCalendar.cancelarEvento({ calendarId: consulta.googleCalendarId, eventId: consulta.googleEventId, credenciais });
    }
    if (consulta.googleCalendarId && consulta.googleEventId) {
      return this.googleCalendar.atualizarEvento({
        ...entrada,
        calendarId: consulta.googleCalendarId,
        eventId: consulta.googleEventId
      });
    }
    return this.googleCalendar.criarEvento(entrada);
  }
```

- [ ] **Step 3: Register `ServicoConexaoGoogleCalendar` in `ModuloOperacoes`**

In `octaclin-backend/src/modulos/operacoes/modulo-operacoes.ts`, add the imports:

```ts
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoConexaoGoogleCalendar } from '../agenda/aplicacao/servico-conexao-google-calendar';
```

Update the `providers` array:

```ts
  providers: [ServicoOperacoes, ServicoGoogleCalendar, ServicoConexaoGoogleCalendar, CriptografiaDadosSensiveis],
```

(matches the same module-local-provider convention used by `ModuloAgenda`, `ModuloAuth`, etc.)

- [ ] **Step 4: Update `servico-operacoes.spec.ts` for the new constructor dependency**

Read `octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts` first to find every place `new ServicoOperacoes(...)` is constructed and how `reprocessarGoogleCalendar`/`reprocessarFalhaComunicacao` are already tested. Add a `servicoConexaoGoogle` fake with `obterConexaoAtiva: jest.fn(async () => undefined)` to the shared dependency-builder helper (mirroring how `googleCalendar` is already faked there), and pass it as the 4th constructor argument (before `servicoSaude`) at every call site.

Then extend the existing `reprocessarGoogleCalendar` test (do not add a new placeholder test): set `deps.servicoConexaoGoogle.obterConexaoAtiva = jest.fn(async () => ({ clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'calendario-profissional' }))` before calling `reprocessarGoogleCalendar`, then add two assertions after the existing ones in that test: `expect(deps.servicoConexaoGoogle.obterConexaoAtiva).toHaveBeenCalledWith(tenantId, <profissionalId da fixture da consulta usada no teste>)` and an assertion that the `credenciais` returned by the fake were passed through to whichever of `deps.googleCalendar.criarEvento`/`atualizarEvento`/`cancelarEvento` that test's fixture triggers (match the exact fixture/consulta variable names already used in that test - read the file first).

- [ ] **Step 5: Run the spec and typecheck**

Run: `pnpm --dir octaclin-backend test --runInBand servico-operacoes.spec.ts`
Expected: PASS.

Run: `pnpm --dir octaclin-backend typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.ts octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts octaclin-backend/src/modulos/operacoes/modulo-operacoes.ts
git commit -m "Resolve credenciais Google por profissional no reprocessamento operacional"
```

---

### Task 4: Bound the external-block conflict query by time overlap (IMPORTANT finding #5)

**Root cause:** `ServicoAgenda.validarConflitoHorario` loads up to 500 `AgendaBloqueioExternoOrm` rows per professional with no time filter (`find({ where: { tenantId, profissionalId }, take: 500 })`), then filters for overlap in memory. This imports the professional's entire external-block history on every consulta creation/remarcacao (contradicting the Fase 136 design's explicit out-of-scope exclusion of historical import), and once a professional accumulates more than 500 blocks, the newest ones can be silently excluded from the `take: 500` page, causing false negatives (conflicts not detected).

**Fix:** Push the overlap condition into the SQL query itself using TypeORM's `LessThan`/`MoreThan` operators - the same composite index already created by the Fase 136 migration (`idx_agenda_bloqueios_externos_tenant_profissional (tenant_id, profissional_id, inicio_em, fim_em)`) covers exactly this query, so the fix is both smaller and strictly more correct than a bounded time window.

**Files:**
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.spec.ts`

**Interfaces:** None - purely internal to `validarConflitoHorario`, no signature changes.

- [ ] **Step 1: Push the overlap filter into the query**

In `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.ts`, add `LessThan` and `MoreThan` to the existing `typeorm` import line (find the line importing `EntityManager`/`IsNull`/etc. from `'typeorm'` and add these two named imports to it).

Replace:

```ts
    const bloqueiosExternos = await gerenciador.getRepository(AgendaBloqueioExternoOrm).find({
      where: { tenantId, profissionalId },
      take: 500
    });
    const conflitoExterno = bloqueiosExternos.some(
      (bloqueio) => bloqueio.inicioEm < janela.fimEm && bloqueio.fimEm > janela.inicioEm
    );
    if (conflitoExterno) throw new BadRequestException('Ja existe consulta agendada neste horario para o profissional.');
```

with:

```ts
    const conflitoExterno = await gerenciador.getRepository(AgendaBloqueioExternoOrm).exists({
      where: {
        tenantId,
        profissionalId,
        inicioEm: LessThan(janela.fimEm),
        fimEm: MoreThan(janela.inicioEm)
      }
    });
    if (conflitoExterno) throw new BadRequestException('Ja existe consulta agendada neste horario para o profissional.');
```

`Repository.exists()` runs a `COUNT`-backed existence check in the database instead of loading rows - no in-memory filtering or `take` limit needed since the `where` clause now expresses the overlap directly.

- [ ] **Step 2: Add a regression test proving overlap detection no longer depends on a row cap**

Read `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.spec.ts` first to find how `AgendaBloqueioExternoOrm`'s repository is currently faked in the tests that exercise `validarConflitoHorario` (search the file for `AgendaBloqueioExternoOrm`) and match its existing fake-repository style exactly. Add a test near the other conflict-detection tests:

```ts
  it('detecta conflito com bloqueio externo consultando por sobreposicao de horario (nao mais em memoria com take:500)', async () => {
    // Reaproveitar o helper de gerenciador falso ja existente neste arquivo para os testes de
    // validarConflitoHorario. Fazer o repositorio de AgendaBloqueioExternoOrm expor `exists`
    // (nao mais `find`) e, dentro do fake, retornar true quando o `where` recebido contiver
    // tenantId/profissionalId corretos e os FindOperators LessThan(janela.fimEm)/MoreThan(janela.inicioEm)
    // (verificar via `where.inicioEm._value`/`where.fimEm._value`, que e como o TypeORM expoe o
    // valor interno de LessThan/MoreThan em runtime) consistentes com uma janela de teste que
    // deveria conflitar com um bloqueio cadastrado as 2026-09-01T10:00-10:30Z.
    // Acionar o metodo publico deste servico que chama validarConflitoHorario (criarConsulta ou
    // remarcarConsulta, o que ja estiver coberto pelos testes vizinhos) e esperar BadRequestException.
  });
```

Because this fake must match whatever repository-mocking helper already exists in that spec file (not read line-by-line while writing this plan), the implementer must open the file, locate or add the `AgendaBloqueioExternoOrm` fake, make it respond to `.exists(...)` instead of `.find(...)`, and replace the comment-only placeholder above with real, runnable assertions before moving on: (a) a request whose window overlaps the fixture throws `BadRequestException`, and (b) the `where` clause passed to `.exists()` includes `tenantId`, `profissionalId`, and TypeORM `LessThan`/`MoreThan` operators (not a bare `take: 500`, which must no longer appear anywhere in this file for `AgendaBloqueioExternoOrm`).

- [ ] **Step 3: Run the spec and typecheck**

Run: `pnpm --dir octaclin-backend test --runInBand servico-agenda.spec.ts`
Expected: PASS, including the new test.

Run: `pnpm --dir octaclin-backend typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.spec.ts
git commit -m "Limita consulta de bloqueios externos por sobreposicao de horario (remove import de historico completo)"
```

---

### Task 5: Webhook anti-forgery token, dedupe, and BullMQ retention limits (IMPORTANT finding #8)

**Root cause:** `POST /agenda/google/notificacoes` accepts any POST carrying an `x-goog-channel-id` header and enqueues a sync job for that channel - Google's `channels.watch` API supports an anti-forgery `token` field specifically to let the receiver verify the notification actually came from Google for a channel it created, but `criarCanalWatch` never sets one, so the webhook currently trusts an unauthenticated header. There is also no dedupe (a redelivered notification re-enqueues a redundant reconciliation) and no BullMQ job retention limits (completed/failed jobs accumulate in Redis forever).

**Fix:** Generate a random per-channel token when creating a watch channel, store it in `google_canais_watch`, require the matching `x-goog-channel-token` header (via constant-time comparison) before enqueueing, use Google's `x-goog-message-number` header as the BullMQ `jobId` for natural dedupe, and cap job retention.

**Files:**
- Create: `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000000900-AdicionaTokenCanalWatchGoogleAgenda.ts`
- Modify: `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts`
- Modify: `octaclin-backend/src/modulos/agenda/infraestrutura/google-canal-watch.orm.ts`
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.ts`
- Modify: `octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts`
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.spec.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.spec.ts`

**Interfaces:**
- Consumes: none new.
- Produces: `ServicoGoogleCalendar.criarCanalWatch(credenciais, canalId, urlWebhook, token: string): Promise<{ recursoId: string; expiraEm: Date }>` - signature gains a required 4th parameter `token`. Every existing caller must be updated in this same task.

- [ ] **Step 1: Migration - add the `token` column**

Create `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000000900-AdicionaTokenCanalWatchGoogleAgenda.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionaTokenCanalWatchGoogleAgenda1720000000900 implements MigrationInterface {
  name = 'AdicionaTokenCanalWatchGoogleAgenda1720000000900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table google_canais_watch add column if not exists token varchar(120);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table google_canais_watch drop column if exists token;`);
  }
}
```

Register it in `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts`: add the import

```ts
import { AdicionaTokenCanalWatchGoogleAgenda1720000000900 } from './migracoes/1720000000900-AdicionaTokenCanalWatchGoogleAgenda';
```

and append it to the `migrations` array, right after `CriarSincronizacaoGoogleAgenda1720000000800`.

- [ ] **Step 2: Add the `token` column to the entity**

In `octaclin-backend/src/modulos/agenda/infraestrutura/google-canal-watch.orm.ts`, add after `expiraEm`:

```ts
  @Column({ name: 'token', type: 'varchar', length: 120, nullable: true })
  token?: string;
```

- [ ] **Step 3: Add `token` to `criarCanalWatch`**

In `octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.ts`, replace the `criarCanalWatch` signature and body:

```ts
  async criarCanalWatch(
    credenciais: CredenciaisGoogleCalendar,
    canalId: string,
    urlWebhook: string,
    token: string
  ): Promise<{ recursoId: string; expiraEm: Date }> {
    const accessToken = await this.obterAccessToken(credenciais.clientId, credenciais.clientSecret, credenciais.refreshToken);
    const resposta = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(credenciais.calendarId)}/events/watch`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: canalId, type: 'web_hook', address: urlWebhook, token })
      }
    );
    const corpo = (await resposta.json()) as { resourceId?: string; expiration?: string; error?: { message?: string } };
    if (!resposta.ok || !corpo.resourceId) {
      throw new InternalServerErrorException(`Falha ao criar canal de watch: ${corpo.error?.message ?? `HTTP ${resposta.status}`}`);
    }
    return { recursoId: corpo.resourceId, expiraEm: new Date(Number(corpo.expiration ?? Date.now())) };
  }
```

(Body change: `token` added to the request `id`/`type`/`address` object. Signature change: new required `token: string` parameter.)

- [ ] **Step 4: Update `servico-google-calendar.spec.ts`'s `criarCanalWatch` call sites**

Search the spec file for `criarCanalWatch(` and add a 4th string argument (e.g. `'token-teste'`) to every call. If an existing test asserts on the fetch request body, add `token: 'token-teste'` to the expected JSON.

- [ ] **Step 5: Verify token in the webhook handler and add dedupe + retention limits**

In `octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts`, update the `crypto` import at the top:

```ts
import { randomBytes, randomUUID, timingSafeEqual } from 'crypto';
```

Replace the `receberNotificacao` method:

```ts
  @Post('notificacoes')
  @HttpCode(200)
  async receberNotificacao(
    @Headers('x-goog-channel-id') canalWatchId?: string,
    @Headers('x-goog-channel-token') tokenRecebido?: string,
    @Headers('x-goog-message-number') numeroMensagem?: string
  ): Promise<void> {
    if (!canalWatchId) return;

    const canal = await this.fonteDados.getRepository(GoogleCanalWatchOrm).findOne({ where: { canalWatchId } });
    if (!canal || !canal.token || !tokenRecebido) return;

    const bufferRecebido = Buffer.from(tokenRecebido);
    const bufferEsperado = Buffer.from(canal.token);
    const tokenValido = bufferRecebido.length === bufferEsperado.length && timingSafeEqual(bufferRecebido, bufferEsperado);
    if (!tokenValido) return;

    await this.filaSincronizacao.add(
      'notificacao',
      { canalWatchId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        jobId: numeroMensagem ? `${canalWatchId}:${numeroMensagem}` : undefined,
        removeOnComplete: 500,
        removeOnFail: 500
      }
    );
  }
```

Update `criarCanalParaProfissional` to generate and persist the token:

```ts
  private async criarCanalParaProfissional(tenantId: string, profissionalId: string): Promise<void> {
    const credenciais = await this.servicoConexao.obterConexaoAtiva(tenantId, profissionalId);
    if (!credenciais) return;

    const canalId = randomUUID();
    const token = randomBytes(24).toString('hex');
    const { recursoId, expiraEm } = await this.googleCalendar.criarCanalWatch(credenciais, canalId, urlWebhook(), token);

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const conexao = await repositorio.findOne({ where: { tenantId, profissionalId } });
      if (!conexao) return;
      conexao.canalWatchId = canalId;
      conexao.canalRecursoId = recursoId;
      conexao.canalExpiraEm = expiraEm;
      await repositorio.save(conexao);
    });

    await this.fonteDados.getRepository(GoogleCanalWatchOrm).save(
      this.fonteDados.getRepository(GoogleCanalWatchOrm).create({ canalWatchId: canalId, tenantId, profissionalId, expiraEm, token })
    );
  }
```

- [ ] **Step 6: Update the renewal cron's `criarCanalWatch` call site**

In `octaclin-backend/src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.ts`, update the `crypto` import:

```ts
import { randomBytes, randomUUID } from 'crypto';
```

Replace, inside `renovarCanal`:

```ts
    const novoCanalId = randomUUID();
    const { recursoId, expiraEm } = await this.googleCalendar.criarCanalWatch(credenciais, novoCanalId, urlWebhook());
```

with:

```ts
    const novoCanalId = randomUUID();
    const token = randomBytes(24).toString('hex');
    const { recursoId, expiraEm } = await this.googleCalendar.criarCanalWatch(credenciais, novoCanalId, urlWebhook(), token);
```

and, a few lines below, the `GoogleCanalWatchOrm` creation:

```ts
    await this.fonteDados.getRepository(GoogleCanalWatchOrm).save(
      this.fonteDados.getRepository(GoogleCanalWatchOrm).create({
        canalWatchId: novoCanalId,
        tenantId: conexao.tenantId,
        profissionalId: conexao.profissionalId,
        expiraEm,
        token
      })
    );
```

- [ ] **Step 7: Update `processador-renovacao-google-calendar.spec.ts`'s `criarCanalWatch` mock if it asserts on call arguments**

The existing mock `googleCalendar.criarCanalWatch: jest.fn(async () => ({ recursoId: 'recurso-novo', expiraEm: ... }))` does not need its arity checked (it's a loose `jest.fn` mock and the call site now passes 4 args instead of 3, which the mock accepts either way). If the test asserts on `criarCanalWatch`'s call arguments (search for `criarCanalWatch).toHaveBeenCalledWith`), add a 4th `expect.any(String)` argument to that assertion.

- [ ] **Step 8: Typecheck and run affected specs**

Run: `pnpm --dir octaclin-backend typecheck`
Expected: PASS.

Run: `pnpm --dir octaclin-backend test --runInBand servico-google-calendar.spec.ts processador-renovacao-google-calendar.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000000900-AdicionaTokenCanalWatchGoogleAgenda.ts octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts octaclin-backend/src/modulos/agenda/infraestrutura/google-canal-watch.orm.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.spec.ts octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts octaclin-backend/src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.ts
git commit -m "Adiciona token anti-forjadura, dedupe e limites de retencao ao webhook da Google Agenda"
```

---

### Task 6: OAuth `state` expiry and single-use nonce (IMPORTANT finding #9)

**Root cause:** `assinarState` already generates a random `nonce` and embeds it in the signed `state` payload, but `validarEDecodificarState` never checks it against anything - it is dead weight that looks like replay protection but provides none. The state also carries no expiry timestamp, so a captured, still-validly-signed `state` value can be replayed at any point in the future to link an attacker-chosen Google account to a victim's OctaClin professional profile (confirmed independently by both the final whole-branch review and an automated security-review hook as OAuth CSRF/Account-Linking, HIGH severity).

**Fix:** Add an `exp` timestamp to the signed payload (checked on every `validarEDecodificarState` call) and consume the `nonce` exactly once via a Redis `SET ... NX` (set-if-not-exists), reusing the `REDIS_PROTECAO_ABUSO`-style DI token pattern already proven in `ModuloAuth`.

**Files:**
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.ts`
- Modify: `octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts`
- Modify: `octaclin-backend/src/modulos/agenda/modulo-agenda.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.spec.ts`

**Interfaces:**
- Produces: `ServicoConexaoGoogleCalendar.validarEDecodificarState` becomes `async` (returns `Promise<{ tenantId: string; profissionalId: string }>` instead of the synchronous version). Every caller must `await` it.
- Produces: new exported DI token `REDIS_OAUTH_STATE_GOOGLE` and interface `ClienteRedisOAuthState` from `servico-conexao-google-calendar.ts`, mirroring `REDIS_PROTECAO_ABUSO`/`ClienteRedisProtecaoAbuso` in `octaclin-backend/src/modulos/auth/aplicacao/servico-protecao-abuso.ts`.

- [ ] **Step 1: Add the Redis DI token, interface, and expiry/nonce logic**

In `octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.ts`, add near the top (after the `chaveAssinaturaState` function):

```ts
export const REDIS_OAUTH_STATE_GOOGLE = 'REDIS_OAUTH_STATE_GOOGLE';

export interface ClienteRedisOAuthState {
  set(chave: string, valor: string, modo: 'PX', duracaoMs: number, condicao: 'NX'): Promise<'OK' | null>;
}

const DURACAO_MAXIMA_STATE_MS = 10 * 60 * 1000;
```

Add `Inject` to the `@nestjs/common` import:

```ts
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
```

Update the constructor:

```ts
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    @Inject(REDIS_OAUTH_STATE_GOOGLE) private readonly redis: ClienteRedisOAuthState
  ) {}
```

Replace `assinarState`:

```ts
  private assinarState(tenantId: string, profissionalId: string): string {
    const nonce = randomBytes(16).toString('hex');
    const exp = Date.now() + DURACAO_MAXIMA_STATE_MS;
    const payloadBase64 = Buffer.from(JSON.stringify({ tenantId, profissionalId, nonce, exp })).toString('base64url');
    const assinatura = createHmac('sha256', chaveAssinaturaState()).update(payloadBase64).digest('base64url');
    return Buffer.from(`${payloadBase64}.${assinatura}`).toString('base64url');
  }
```

Replace `validarEDecodificarState`:

```ts
  async validarEDecodificarState(state: string): Promise<{ tenantId: string; profissionalId: string }> {
    const partes = Buffer.from(state, 'base64url').toString('utf8').split('.');
    if (partes.length !== 2) throw new BadRequestException('State OAuth invalido.');

    const [payloadBase64, assinatura] = partes;
    const assinaturaEsperada = createHmac('sha256', chaveAssinaturaState()).update(payloadBase64).digest('base64url');
    const bufferAssinatura = Buffer.from(assinatura, 'base64url');
    const bufferEsperada = Buffer.from(assinaturaEsperada, 'base64url');
    if (bufferAssinatura.length !== bufferEsperada.length || !timingSafeEqual(bufferAssinatura, bufferEsperada)) {
      throw new BadRequestException('State OAuth invalido.');
    }

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as {
      tenantId: string;
      profissionalId: string;
      nonce: string;
      exp: number;
    };

    if (!payload.exp || payload.exp < Date.now()) {
      throw new BadRequestException('State OAuth expirado.');
    }

    const consumido = await this.redis.set(`google-oauth-state:${payload.nonce}`, '1', 'PX', DURACAO_MAXIMA_STATE_MS, 'NX');
    if (consumido !== 'OK') {
      throw new BadRequestException('State OAuth ja utilizado.');
    }

    return { tenantId: payload.tenantId, profissionalId: payload.profissionalId };
  }
```

- [ ] **Step 2: Update the controller's `callback` to await the now-async method**

In `octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts`, replace:

```ts
    const { tenantId, profissionalId } = this.servicoConexao.validarEDecodificarState(state);
```

with:

```ts
    const { tenantId, profissionalId } = await this.servicoConexao.validarEDecodificarState(state);
```

- [ ] **Step 3: Register the Redis provider in `ModuloAgenda`**

In `octaclin-backend/src/modulos/agenda/modulo-agenda.ts`, add the imports:

```ts
import Redis from 'ioredis';
import { REDIS_OAUTH_STATE_GOOGLE } from './aplicacao/servico-conexao-google-calendar';
```

Add to the `providers` array (alongside the existing entries):

```ts
    { provide: REDIS_OAUTH_STATE_GOOGLE, useFactory: () => new Redis(criarConexaoRedis()) },
```

(`criarConexaoRedis` is already imported at the top of this file.)

- [ ] **Step 4: Update `servico-conexao-google-calendar.spec.ts` for the new constructor param and async method**

Add a fake Redis client helper near the top of the file, after `criarGerenciadorFalso`:

```ts
  function criarRedisFalso() {
    const chavesConsumidas = new Set<string>();
    return {
      set: jest.fn(async (chave: string) => {
        if (chavesConsumidas.has(chave)) return null;
        chavesConsumidas.add(chave);
        return 'OK' as const;
      })
    };
  }
```

Update `construirServico`:

```ts
  function construirServico() {
    const gerenciadorFalso = criarGerenciadorFalso();
    const executorTenant = { executar: jest.fn((_tenantId: string, callback: (gerenciador: any) => any) => callback(gerenciadorFalso)) } as unknown as ExecutorTenant;
    const fonteDados = { transaction: jest.fn() } as unknown as DataSource;
    const redis = criarRedisFalso();
    const servico = new ServicoConexaoGoogleCalendar(executorTenant, criptografia, redis as any);
    return { servico, gerenciadorFalso, executorTenant, redis };
  }
```

Update the three existing `validarEDecodificarState` tests to `async`/`await`:

Replace:

```ts
  it('gera uma URL de autorizacao com state assinado contendo tenantId e profissionalId', () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const url = servico.gerarUrlAutorizacao('tenant-1', 'profissional-1', 'https://backend/agenda/google/callback');

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=client-id');
    const parametros = new URL(url).searchParams;
    const decodificado = servico.validarEDecodificarState(parametros.get('state') ?? '');
    expect(decodificado).toEqual({ tenantId: 'tenant-1', profissionalId: 'profissional-1' });
  });
```

with:

```ts
  it('gera uma URL de autorizacao com state assinado contendo tenantId e profissionalId', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const url = servico.gerarUrlAutorizacao('tenant-1', 'profissional-1', 'https://backend/agenda/google/callback');

    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=client-id');
    const parametros = new URL(url).searchParams;
    const decodificado = await servico.validarEDecodificarState(parametros.get('state') ?? '');
    expect(decodificado).toEqual({ tenantId: 'tenant-1', profissionalId: 'profissional-1' });
  });
```

Replace:

```ts
  it('rejeita um state adulterado', () => {
    const { servico } = construirServico();
    expect(() => servico.validarEDecodificarState('valor-invalido')).toThrow();
  });
```

with:

```ts
  it('rejeita um state adulterado', async () => {
    const { servico } = construirServico();
    await expect(servico.validarEDecodificarState('valor-invalido')).rejects.toThrow();
  });
```

In the third test (`'rejeita um state bem formado mas com assinatura adulterada'`), change its signature to `async ()` and its final assertion from:

```ts
    expect(() => servico.validarEDecodificarState(stateAdulterado)).toThrow('State OAuth invalido.');
```

to:

```ts
    await expect(servico.validarEDecodificarState(stateAdulterado)).rejects.toThrow('State OAuth invalido.');
```

Then add two new tests, right after that one:

```ts
  it('rejeita um state expirado', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const payloadBase64 = Buffer.from(
      JSON.stringify({ tenantId: 'tenant-1', profissionalId: 'profissional-1', nonce: 'nonce-expirado', exp: Date.now() - 1000 })
    ).toString('base64url');
    const chaveAssinatura = process.env.CRIPTOGRAFIA_CHAVE_AES_256 ?? 'octaclin-chave-local-desenvolvimento';
    const { createHmac } = await import('crypto');
    const assinatura = createHmac('sha256', chaveAssinatura).update(payloadBase64).digest('base64url');
    const stateExpirado = Buffer.from(`${payloadBase64}.${assinatura}`).toString('base64url');

    await expect(servico.validarEDecodificarState(stateExpirado)).rejects.toThrow('State OAuth expirado.');
  });

  it('rejeita um state reutilizado (replay) mesmo dentro do prazo de validade', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    const { servico } = construirServico();

    const url = servico.gerarUrlAutorizacao('tenant-1', 'profissional-1', 'https://backend/agenda/google/callback');
    const state = new URL(url).searchParams.get('state') ?? '';

    await expect(servico.validarEDecodificarState(state)).resolves.toEqual({ tenantId: 'tenant-1', profissionalId: 'profissional-1' });
    await expect(servico.validarEDecodificarState(state)).rejects.toThrow('State OAuth ja utilizado.');
  });
```

- [ ] **Step 5: Run the spec, typecheck, and full backend suite**

Run: `pnpm --dir octaclin-backend test --runInBand servico-conexao-google-calendar.spec.ts`
Expected: all PASS, including the 2 new tests.

Run: `pnpm --dir octaclin-backend typecheck && pnpm --dir octaclin-backend test --runInBand`
Expected: typecheck clean, full suite green.

- [ ] **Step 6: Commit**

```bash
git add octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.spec.ts octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts octaclin-backend/src/modulos/agenda/modulo-agenda.ts
git commit -m "Adiciona expiracao e uso unico (nonce via Redis) ao state OAuth da Google Agenda"
```

---

## Final validation (run once after Task 6, before closing the fase)

```powershell
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
npm run security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

After these are green, update `fase-136-sincronizacao-google-agenda-profissional.md`'s "Achados da revisao de seguranca" section to record this second fix wave (link back to this plan file and the SDD ledger), then commit and push per the `fechar-fase` skill.
