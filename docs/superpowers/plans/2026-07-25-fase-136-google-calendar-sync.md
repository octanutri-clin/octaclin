# Fase 136 - Sincronizacao Google Agenda por profissional - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each professional connect their own Google Calendar via OAuth so that changes made directly in Google (reschedule/cancel an OctaClin consulta, or create an unrelated personal event) sync back into OctaClin in near real time, via Google Calendar push notifications.

**Architecture:** Extends the existing `agenda` module. `ServicoGoogleCalendar` gains per-professional credential support and inbound read methods (list changed events via syncToken, create/stop a watch channel). Two new services: `ServicoConexaoGoogleCalendar` (OAuth handshake) and `ServicoSincronizacaoGoogleCalendar` (processes webhook notifications via a BullMQ queue, reusing the Redis connection already used by `ModuloComunicacoes`). `ServicoAgenda` is refactored so `remarcarConsulta`/`cancelarConsulta` can be invoked either by an authenticated HTTP user (existing path) or by the sync processor acting on behalf of a known `profissionalId` (new path), without duplicating logic.

**Tech Stack:** NestJS, TypeORM (raw-SQL migrations), PostgreSQL (Neon, RLS), BullMQ/ioredis, Next.js BFF routes, Jest.

## Global Constraints

- Never store the Google refresh token in plaintext — always through `CriptografiaDadosSensiveis` (AES-256-GCM), same as email/nome fields elsewhere in the codebase.
- Every new tenant-scoped table gets `enable row level security` + `force row level security` + a `tenant_id = current_setting('app.tenant_id', true)::uuid` policy, exactly like every other migration in `octaclin-backend/src/infraestrutura/banco-dados/migracoes/`.
- All business-data queries go through `ExecutorTenant.executar(tenantId, ...)` (sets `app.tenant_id` for the transaction) — never query a tenant-scoped table outside that wrapper.
- `pnpm --dir octaclin-backend typecheck` and the relevant Jest specs must pass after every task before moving to the next.
- No secrets, real tokens, or real calendar IDs in committed files, tests, or docs.

## Design refinement discovered while planning

The approved design (`fase-136-sincronizacao-google-agenda-profissional.md`) has 2 new tables. Implementing the webhook handler surfaced a real gap: Google's push notification only carries a channel ID in headers — the backend must discover **which tenant** owns that channel *before* it knows `tenantId`, but every tenant-scoped table in this codebase is RLS-protected and requires `app.tenant_id` to already be set (chicken-and-egg). The fix, consistent with how `TenantOrm` itself already works (no RLS, used to resolve which tenant to scope into next): add a third, tiny **non-RLS routing table** `google_canais_watch` that holds nothing sensitive — just `canal_watch_id -> {tenant_id, profissional_id}`. The webhook handler queries this one un-scoped table first, then does everything else through the normal `ExecutorTenant.executar(tenantId, ...)` path. This doesn't change any of the 5 product decisions already approved — it's a routing-table addition needed to implement decision #2 (push notifications) safely under this codebase's existing RLS pattern.

---

### Task 1: Migration - three new tables

**Files:**
- Create: `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000000800-CriarSincronizacaoGoogleAgenda.ts`
- Modify: `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts:10` (import) and `:139` (migrations array)

**Interfaces:**
- Produces: tables `profissionais_google_conexao`, `google_canais_watch`, `agenda_bloqueios_externos` — exact columns below, consumed by Tasks 2-6.

- [ ] **Step 1: Write the migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarSincronizacaoGoogleAgenda1720000000800 implements MigrationInterface {
  name = 'CriarSincronizacaoGoogleAgenda1720000000800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists profissionais_google_conexao (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        refresh_token_criptografado bytea not null,
        calendar_id varchar(220) not null default 'primary',
        escopos_concedidos varchar(500),
        conectado_em timestamptz not null default now(),
        desconectado_em timestamptz,
        ultimo_sync_token varchar(500),
        canal_watch_id varchar(220),
        canal_recurso_id varchar(220),
        canal_expira_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        unique (tenant_id, profissional_id)
      );

      create index if not exists idx_profissionais_google_conexao_tenant_profissional
        on profissionais_google_conexao (tenant_id, profissional_id);

      create table if not exists google_canais_watch (
        canal_watch_id varchar(220) primary key,
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        expira_em timestamptz not null,
        criado_em timestamptz not null default now()
      );

      create table if not exists agenda_bloqueios_externos (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        google_event_id varchar(220) not null,
        inicio_em timestamptz not null,
        fim_em timestamptz not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        unique (tenant_id, profissional_id, google_event_id)
      );

      create index if not exists idx_agenda_bloqueios_externos_tenant_profissional
        on agenda_bloqueios_externos (tenant_id, profissional_id, inicio_em, fim_em);

      alter table profissionais_google_conexao enable row level security;
      alter table profissionais_google_conexao force row level security;
      alter table agenda_bloqueios_externos enable row level security;
      alter table agenda_bloqueios_externos force row level security;

      drop policy if exists isolamento_tenant_profissionais_google_conexao on profissionais_google_conexao;
      create policy isolamento_tenant_profissionais_google_conexao
        on profissionais_google_conexao
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      drop policy if exists isolamento_tenant_agenda_bloqueios_externos on agenda_bloqueios_externos;
      create policy isolamento_tenant_agenda_bloqueios_externos
        on agenda_bloqueios_externos
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists agenda_bloqueios_externos cascade`);
    await queryRunner.query(`drop table if exists google_canais_watch cascade`);
    await queryRunner.query(`drop table if exists profissionais_google_conexao cascade`);
  }
}
```

Note: `google_canais_watch` intentionally has **no RLS** — see "Design refinement" above. It stores no sensitive data (no tokens), only a routing pointer.

- [ ] **Step 2: Register the migration**

In `opcoes-typeorm.ts`, add the import after line 10 (`CorrigeConstraintRoleUsuarios1720000000700` import):

```typescript
import { CriarSincronizacaoGoogleAgenda1720000000800 } from './migracoes/1720000000800-CriarSincronizacaoGoogleAgenda';
```

And add it to the `migrations` array after `CorrigeConstraintRoleUsuarios1720000000700`:

```typescript
    migrations: [
      CriarFundacaoOctaClin1720000000000,
      CriarAgendaConsultas1720000000100,
      CriarConvitesPacienteAcesso1720000000200,
      CriarTokensRedefinicaoSenha1720000000300,
      CriarEvolucoesClinicas1720000000400,
      CriarAcompanhamentoTarefas1720000000500,
      CriarMateriaisEducativos1720000000600,
      CorrigeConstraintRoleUsuarios1720000000700,
      CriarSincronizacaoGoogleAgenda1720000000800
    ],
```

- [ ] **Step 3: Verify migration file compiles**

Run: `pnpm --dir octaclin-backend typecheck`
Expected: PASS (no references to entities yet, pure SQL migration).

- [ ] **Step 4: Commit**

```bash
git add octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000000800-CriarSincronizacaoGoogleAgenda.ts octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts
git commit -m "Adiciona migration das tabelas de sincronizacao Google Agenda (Fase 136)"
```

---

### Task 2: TypeORM entities

**Files:**
- Create: `octaclin-backend/src/modulos/agenda/infraestrutura/profissional-google-conexao.orm.ts`
- Create: `octaclin-backend/src/modulos/agenda/infraestrutura/google-canal-watch.orm.ts`
- Create: `octaclin-backend/src/modulos/agenda/infraestrutura/agenda-bloqueio-externo.orm.ts`
- Modify: `octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts` (entities array)

**Interfaces:**
- Produces: `ProfissionalGoogleConexaoOrm`, `GoogleCanalWatchOrm`, `AgendaBloqueioExternoOrm` — consumed by Tasks 4-6.

- [ ] **Step 1: Write the three entities**

```typescript
// octaclin-backend/src/modulos/agenda/infraestrutura/profissional-google-conexao.orm.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('profissionais_google_conexao')
export class ProfissionalGoogleConexaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ name: 'refresh_token_criptografado', type: 'bytea' })
  refreshTokenCriptografado: Buffer;

  @Column({ name: 'calendar_id', type: 'varchar', length: 220, default: 'primary' })
  calendarId: string;

  @Column({ name: 'escopos_concedidos', type: 'varchar', length: 500, nullable: true })
  escoposConcedidos?: string;

  @Column({ name: 'conectado_em', type: 'timestamptz' })
  conectadoEm: Date;

  @Column({ name: 'desconectado_em', type: 'timestamptz', nullable: true })
  desconectadoEm?: Date;

  @Column({ name: 'ultimo_sync_token', type: 'varchar', length: 500, nullable: true })
  ultimoSyncToken?: string;

  @Column({ name: 'canal_watch_id', type: 'varchar', length: 220, nullable: true })
  canalWatchId?: string;

  @Column({ name: 'canal_recurso_id', type: 'varchar', length: 220, nullable: true })
  canalRecursoId?: string;

  @Column({ name: 'canal_expira_em', type: 'timestamptz', nullable: true })
  canalExpiraEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
```

```typescript
// octaclin-backend/src/modulos/agenda/infraestrutura/google-canal-watch.orm.ts
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('google_canais_watch')
export class GoogleCanalWatchOrm {
  @PrimaryColumn({ name: 'canal_watch_id', type: 'varchar', length: 220 })
  canalWatchId: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
```

```typescript
// octaclin-backend/src/modulos/agenda/infraestrutura/agenda-bloqueio-externo.orm.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('agenda_bloqueios_externos')
export class AgendaBloqueioExternoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ name: 'google_event_id', type: 'varchar', length: 220 })
  googleEventId: string;

  @Column({ name: 'inicio_em', type: 'timestamptz' })
  inicioEm: Date;

  @Column({ name: 'fim_em', type: 'timestamptz' })
  fimEm: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
```

- [ ] **Step 2: Register entities in `opcoes-typeorm.ts`**

Add imports near the other agenda import (line 14):

```typescript
import { AgendaBloqueioExternoOrm } from '../../modulos/agenda/infraestrutura/agenda-bloqueio-externo.orm';
import { GoogleCanalWatchOrm } from '../../modulos/agenda/infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from '../../modulos/agenda/infraestrutura/profissional-google-conexao.orm';
```

Add to the `entities` array, right after `AgendaConsultaOrm`:

```typescript
      AgendaConsultaOrm,
      ProfissionalGoogleConexaoOrm,
      GoogleCanalWatchOrm,
      AgendaBloqueioExternoOrm,
```

- [ ] **Step 3: Verify**

Run: `pnpm --dir octaclin-backend typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add octaclin-backend/src/modulos/agenda/infraestrutura/profissional-google-conexao.orm.ts octaclin-backend/src/modulos/agenda/infraestrutura/google-canal-watch.orm.ts octaclin-backend/src/modulos/agenda/infraestrutura/agenda-bloqueio-externo.orm.ts octaclin-backend/src/infraestrutura/banco-dados/opcoes-typeorm.ts
git commit -m "Adiciona entidades TypeORM de sincronizacao Google Agenda (Fase 136)"
```

---

### Task 3: Extend `ServicoGoogleCalendar` for per-professional credentials, extendedProperties, and inbound reads

**Files:**
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.spec.ts`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces:
  - `CredenciaisGoogleCalendar { clientId: string; clientSecret: string; refreshToken: string; calendarId: string }` (exported type)
  - `criarEvento(entrada: CriarEventoGoogleEntrada & { consultaId: string; credenciais?: CredenciaisGoogleCalendar })`
  - `atualizarEvento(entrada: AtualizarEventoGoogleEntrada & { consultaId: string; credenciais?: CredenciaisGoogleCalendar })`
  - `cancelarEvento(entrada: CancelarEventoGoogleEntrada & { credenciais?: CredenciaisGoogleCalendar })`
  - `listarEventosAlterados(credenciais: CredenciaisGoogleCalendar, syncToken?: string): Promise<{ eventos: EventoGoogleAlterado[]; proximoSyncToken?: string }>`
  - `criarCanalWatch(credenciais: CredenciaisGoogleCalendar, canalId: string, urlWebhook: string): Promise<{ recursoId: string; expiraEm: Date }>`
  - `pararCanalWatch(credenciais: CredenciaisGoogleCalendar, canalId: string, recursoId: string): Promise<void>`
  - `EventoGoogleAlterado { id: string; status: string; octaclinConsultaId?: string; inicioEm?: Date; fimEm?: Date }`

- [ ] **Step 1: Write the failing tests for the new behavior**

Append to `servico-google-calendar.spec.ts` (the existing file already mocks `global.fetch`; follow the same pattern):

```typescript
  it('inclui extendedProperties.private.octaclinConsultaId ao criar evento', async () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token';

    const chamadas: Array<{ url: string; body?: string }> = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      chamadas.push({ url: String(url), body: init?.body as string | undefined });
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-1' }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'evento-1', htmlLink: 'https://calendar.google.com/evento-1' }), { status: 200 });
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    await servico.criarEvento({
      resumo: 'Consulta',
      descricao: 'desc',
      inicioEm: new Date('2026-08-01T10:00:00Z'),
      fimEm: new Date('2026-08-01T10:50:00Z'),
      timezone: 'America/Sao_Paulo',
      consultaId: 'consulta-123'
    });

    const chamadaEvento = chamadas.find((chamada) => !chamada.url.includes('/token'));
    const corpo = JSON.parse(chamadaEvento?.body ?? '{}');
    expect(corpo.extendedProperties.private.octaclinConsultaId).toBe('consulta-123');
  });

  it('usa credenciais por profissional quando fornecidas, ignorando as variaveis de ambiente', async () => {
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    delete process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

    const chamadas: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      chamadas.push(String(url));
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-2' }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: 'evento-2' }), { status: 200 });
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.criarEvento({
      resumo: 'Consulta',
      descricao: 'desc',
      inicioEm: new Date('2026-08-01T10:00:00Z'),
      fimEm: new Date('2026-08-01T10:50:00Z'),
      timezone: 'America/Sao_Paulo',
      consultaId: 'consulta-456',
      credenciais: {
        clientId: 'prof-client',
        clientSecret: 'prof-secret',
        refreshToken: 'prof-refresh',
        calendarId: 'profissional-calendar-id'
      }
    });

    expect(resultado).toEqual({ sincronizado: true, calendarId: 'profissional-calendar-id', eventId: 'evento-2', htmlLink: undefined });
    expect(chamadas.some((url) => url.includes('profissional-calendar-id'))).toBe(true);
  });

  it('listarEventosAlterados retorna eventos e o proximo syncToken', async () => {
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'token-3' }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 'evento-a',
              status: 'confirmed',
              start: { dateTime: '2026-08-01T10:00:00Z' },
              end: { dateTime: '2026-08-01T10:50:00Z' },
              extendedProperties: { private: { octaclinConsultaId: 'consulta-abc' } }
            },
            { id: 'evento-b', status: 'cancelled' }
          ],
          nextSyncToken: 'sync-token-novo'
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const servico = new ServicoGoogleCalendar();
    const resultado = await servico.listarEventosAlterados({
      clientId: 'c',
      clientSecret: 's',
      refreshToken: 'r',
      calendarId: 'cal-1'
    });

    expect(resultado.proximoSyncToken).toBe('sync-token-novo');
    expect(resultado.eventos).toEqual([
      {
        id: 'evento-a',
        status: 'confirmed',
        octaclinConsultaId: 'consulta-abc',
        inicioEm: new Date('2026-08-01T10:00:00Z'),
        fimEm: new Date('2026-08-01T10:50:00Z')
      },
      { id: 'evento-b', status: 'cancelled', octaclinConsultaId: undefined, inicioEm: undefined, fimEm: undefined }
    ]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --dir octaclin-backend exec jest servico-google-calendar.spec.ts --runInBand`
Expected: FAIL (new methods/fields don't exist yet).

- [ ] **Step 3: Implement the changes**

Replace the top of `servico-google-calendar.ts` (interfaces) and add the new methods. Full updated file:

```typescript
import { Injectable, InternalServerErrorException } from '@nestjs/common';

export interface CredenciaisGoogleCalendar {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
}

interface CriarEventoGoogleEntrada {
  resumo: string;
  descricao: string;
  inicioEm: Date;
  fimEm: Date;
  timezone: string;
  local?: string;
  consultaId: string;
  credenciais?: CredenciaisGoogleCalendar;
}

interface AtualizarEventoGoogleEntrada extends CriarEventoGoogleEntrada {
  calendarId: string;
  eventId: string;
}

interface CancelarEventoGoogleEntrada {
  calendarId: string;
  eventId: string;
  credenciais?: CredenciaisGoogleCalendar;
}

export type ResultadoGoogleCalendar =
  | {
      sincronizado: true;
      calendarId: string;
      eventId: string;
      htmlLink?: string;
    }
  | {
      sincronizado: false;
      motivo: string;
      erro?: string;
    };

export interface EventoGoogleAlterado {
  id: string;
  status: string;
  octaclinConsultaId?: string;
  inicioEm?: Date;
  fimEm?: Date;
}

interface RespostaTokenGoogle {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface RespostaEventoGoogle {
  id?: string;
  htmlLink?: string;
  error?: { message?: string };
}

interface EventoGoogleBruto {
  id: string;
  status: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  extendedProperties?: { private?: { octaclinConsultaId?: string } };
}

interface RespostaListaEventosGoogle {
  items?: EventoGoogleBruto[];
  nextSyncToken?: string;
  nextPageToken?: string;
  error?: { message?: string };
}

function textoEnv(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

@Injectable()
export class ServicoGoogleCalendar {
  async criarEvento(entrada: CriarEventoGoogleEntrada): Promise<ResultadoGoogleCalendar> {
    const configuracao = this.obterConfiguracao(entrada.credenciais);
    if (!configuracao) return { sincronizado: false, motivo: 'configuracao_ausente' };

    try {
      const accessToken = await this.obterAccessToken(configuracao.clientId, configuracao.clientSecret, configuracao.refreshToken);
      const resposta = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(configuracao.calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.montarCorpoEvento(entrada))
        }
      );
      return await this.lerRespostaEvento(resposta, configuracao.calendarId, 'criar evento');
    } catch (erro) {
      return {
        sincronizado: false,
        motivo: 'falha_google_calendar',
        erro: erro instanceof Error ? erro.message : 'Falha desconhecida ao sincronizar Google Calendar.'
      };
    }
  }

  async atualizarEvento(entrada: AtualizarEventoGoogleEntrada): Promise<ResultadoGoogleCalendar> {
    const configuracao = this.obterConfiguracao(entrada.credenciais, entrada.calendarId);
    if (!configuracao) return { sincronizado: false, motivo: 'configuracao_ausente' };

    try {
      const accessToken = await this.obterAccessToken(configuracao.clientId, configuracao.clientSecret, configuracao.refreshToken);
      const resposta = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(entrada.calendarId)}/events/${encodeURIComponent(entrada.eventId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.montarCorpoEvento(entrada))
        }
      );
      return await this.lerRespostaEvento(resposta, entrada.calendarId, 'atualizar evento');
    } catch (erro) {
      return {
        sincronizado: false,
        motivo: 'falha_google_calendar',
        erro: erro instanceof Error ? erro.message : 'Falha desconhecida ao atualizar Google Calendar.'
      };
    }
  }

  async cancelarEvento(entrada: CancelarEventoGoogleEntrada): Promise<ResultadoGoogleCalendar> {
    const configuracao = this.obterConfiguracao(entrada.credenciais, entrada.calendarId);
    if (!configuracao) return { sincronizado: false, motivo: 'configuracao_ausente' };

    try {
      const accessToken = await this.obterAccessToken(configuracao.clientId, configuracao.clientSecret, configuracao.refreshToken);
      const resposta = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(entrada.calendarId)}/events/${encodeURIComponent(entrada.eventId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      if (!resposta.ok && resposta.status !== 410) {
        const corpo = (await resposta.json().catch(() => ({}))) as RespostaEventoGoogle;
        const mensagem = corpo.error?.message ?? `HTTP ${resposta.status}`;
        throw new InternalServerErrorException(`Falha ao cancelar evento Google Calendar: ${mensagem}`);
      }
      return { sincronizado: true, calendarId: entrada.calendarId, eventId: entrada.eventId };
    } catch (erro) {
      return {
        sincronizado: false,
        motivo: 'falha_google_calendar',
        erro: erro instanceof Error ? erro.message : 'Falha desconhecida ao cancelar Google Calendar.'
      };
    }
  }

  async listarEventosAlterados(
    credenciais: CredenciaisGoogleCalendar,
    syncToken?: string
  ): Promise<{ eventos: EventoGoogleAlterado[]; proximoSyncToken?: string }> {
    const accessToken = await this.obterAccessToken(credenciais.clientId, credenciais.clientSecret, credenciais.refreshToken);
    const parametros = new URLSearchParams({ showDeleted: 'true', singleEvents: 'true' });
    if (syncToken) parametros.set('syncToken', syncToken);

    const resposta = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(credenciais.calendarId)}/events?${parametros.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const corpo = (await resposta.json()) as RespostaListaEventosGoogle;
    if (!resposta.ok) {
      throw new InternalServerErrorException(`Falha ao listar eventos alterados: ${corpo.error?.message ?? `HTTP ${resposta.status}`}`);
    }

    const eventos: EventoGoogleAlterado[] = (corpo.items ?? []).map((evento) => ({
      id: evento.id,
      status: evento.status,
      octaclinConsultaId: evento.extendedProperties?.private?.octaclinConsultaId,
      inicioEm: evento.start?.dateTime ? new Date(evento.start.dateTime) : undefined,
      fimEm: evento.end?.dateTime ? new Date(evento.end.dateTime) : undefined
    }));

    return { eventos, proximoSyncToken: corpo.nextSyncToken };
  }

  async criarCanalWatch(
    credenciais: CredenciaisGoogleCalendar,
    canalId: string,
    urlWebhook: string
  ): Promise<{ recursoId: string; expiraEm: Date }> {
    const accessToken = await this.obterAccessToken(credenciais.clientId, credenciais.clientSecret, credenciais.refreshToken);
    const resposta = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(credenciais.calendarId)}/events/watch`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: canalId, type: 'web_hook', address: urlWebhook })
      }
    );
    const corpo = (await resposta.json()) as { resourceId?: string; expiration?: string; error?: { message?: string } };
    if (!resposta.ok || !corpo.resourceId) {
      throw new InternalServerErrorException(`Falha ao criar canal de watch: ${corpo.error?.message ?? `HTTP ${resposta.status}`}`);
    }
    return { recursoId: corpo.resourceId, expiraEm: new Date(Number(corpo.expiration ?? Date.now())) };
  }

  async pararCanalWatch(credenciais: CredenciaisGoogleCalendar, canalId: string, recursoId: string): Promise<void> {
    const accessToken = await this.obterAccessToken(credenciais.clientId, credenciais.clientSecret, credenciais.refreshToken);
    await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: canalId, resourceId: recursoId })
    });
  }

  private obterConfiguracao(credenciais?: CredenciaisGoogleCalendar, calendarIdPreferencial?: string) {
    if (credenciais) return credenciais;

    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    const clientSecret = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
    const refreshToken = textoEnv(process.env.GOOGLE_CALENDAR_REFRESH_TOKEN);
    const calendarId = calendarIdPreferencial ?? textoEnv(process.env.GOOGLE_CALENDAR_ID) ?? 'primary';

    if (!clientId || !clientSecret || !refreshToken) {
      return undefined;
    }

    return { clientId, clientSecret, refreshToken, calendarId };
  }

  private montarCorpoEvento(entrada: CriarEventoGoogleEntrada) {
    return {
      summary: entrada.resumo,
      description: entrada.descricao,
      location: entrada.local,
      start: { dateTime: entrada.inicioEm.toISOString(), timeZone: entrada.timezone },
      end: { dateTime: entrada.fimEm.toISOString(), timeZone: entrada.timezone },
      extendedProperties: { private: { octaclinConsultaId: entrada.consultaId } }
    };
  }

  private async lerRespostaEvento(resposta: Response, calendarId: string, acao: string): Promise<ResultadoGoogleCalendar> {
    const corpo = (await resposta.json()) as RespostaEventoGoogle;

    if (!resposta.ok || !corpo.id) {
      const mensagem = corpo.error?.message ?? `HTTP ${resposta.status}`;
      throw new InternalServerErrorException(`Falha ao ${acao} Google Calendar: ${mensagem}`);
    }

    return {
      sincronizado: true,
      calendarId,
      eventId: corpo.id,
      htmlLink: corpo.htmlLink
    };
  }

  private async obterAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    const tokenUri = textoEnv(process.env.GOOGLE_CALENDAR_TOKEN_URI) ?? 'https://oauth2.googleapis.com/token';
    const resposta = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    const corpo = (await resposta.json()) as RespostaTokenGoogle;

    if (!resposta.ok || !corpo.access_token) {
      const detalhe = corpo.error_description ?? corpo.error ?? `HTTP ${resposta.status}`;
      throw new InternalServerErrorException(`Falha ao renovar token Google Calendar: ${detalhe}`);
    }

    return corpo.access_token;
  }
}
```

Note this is a **breaking change to `CriarEventoGoogleEntrada`** (`consultaId` is now required) — Task 6 updates the one caller (`ServicoAgenda.criarConsulta`) accordingly, in the same PR, so nothing is left in a broken intermediate state on `main`. Run Tasks 3 and 6 back-to-back before pushing if executing inline.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir octaclin-backend exec jest servico-google-calendar.spec.ts --runInBand`
Expected: PASS (all previous tests plus the 3 new ones).

- [ ] **Step 5: Typecheck**

Run: `pnpm --dir octaclin-backend typecheck`
Expected: FAIL at this point (`servico-agenda.ts` still calls `criarEvento` without `consultaId`) — this is expected and resolved in Task 6. Do not commit Task 3 alone; commit Tasks 3+6 together (see Task 6 Step 5).

---

### Task 4: `ServicoConexaoGoogleCalendar` (OAuth handshake)

**Files:**
- Create: `octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.spec.ts`

**Interfaces:**
- Consumes: `CriptografiaDadosSensiveis.criptografar/descriptografar` (existing), `ExecutorTenant.executar` (existing), `ProfissionalGoogleConexaoOrm` (Task 2).
- Produces:
  - `gerarUrlAutorizacao(tenantId: string, profissionalId: string, urlCallback: string): string`
  - `validarEDecodificarState(state: string): { tenantId: string; profissionalId: string }`
  - `trocarCodigoPorConexao(tenantId: string, profissionalId: string, code: string, urlCallback: string): Promise<void>`
  - `obterConexaoAtiva(tenantId: string, profissionalId: string): Promise<CredenciaisGoogleCalendar | undefined>`
  - `desconectar(tenantId: string, profissionalId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```typescript
// octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.spec.ts
import { DataSource } from 'typeorm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoConexaoGoogleCalendar } from './servico-conexao-google-calendar';

describe('ServicoConexaoGoogleCalendar', () => {
  const criptografia = new CriptografiaDadosSensiveis();

  function construirServico() {
    const executorTenant = { executar: jest.fn((_tenantId: string, callback: (gerenciador: any) => any) => callback(gerenciadorFalso)) } as unknown as ExecutorTenant;
    const gerenciadorFalso = criarGerenciadorFalso();
    const fonteDados = { transaction: jest.fn() } as unknown as DataSource;
    const servico = new ServicoConexaoGoogleCalendar(executorTenant, criptografia);
    return { servico, gerenciadorFalso, executorTenant };
  }

  function criarGerenciadorFalso() {
    const registros = new Map<string, any>();
    return {
      getRepository: () => ({
        findOne: jest.fn(async ({ where }: any) => registros.get(`${where.tenantId}:${where.profissionalId}`) ?? null),
        create: jest.fn((dados: any) => dados),
        save: jest.fn(async (dados: any) => {
          const chave = `${dados.tenantId}:${dados.profissionalId}`;
          const salvo = { id: 'conexao-1', ...registros.get(chave), ...dados };
          registros.set(chave, salvo);
          return salvo;
        })
      })
    };
  }

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

  it('rejeita um state adulterado', () => {
    const { servico } = construirServico();
    expect(() => servico.validarEDecodificarState('valor-invalido')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --dir octaclin-backend exec jest servico-conexao-google-calendar.spec.ts --runInBand`
Expected: FAIL with "Cannot find module './servico-conexao-google-calendar'".

- [ ] **Step 3: Implement**

```typescript
// octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.ts
import { createHmac, randomBytes } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { CredenciaisGoogleCalendar } from './servico-google-calendar';

interface RespostaTrocaCodigoGoogle {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function textoEnv(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

function chaveAssinaturaState(): string {
  return process.env.CRIPTOGRAFIA_CHAVE_AES_256 ?? 'octaclin-chave-local-desenvolvimento';
}

@Injectable()
export class ServicoConexaoGoogleCalendar {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  gerarUrlAutorizacao(tenantId: string, profissionalId: string, urlCallback: string): string {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    if (!clientId) throw new BadRequestException('Integracao Google Calendar nao configurada.');

    const state = this.assinarState(tenantId, profissionalId);
    const parametros = new URLSearchParams({
      client_id: clientId,
      redirect_uri: urlCallback,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/calendar',
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${parametros.toString()}`;
  }

  validarEDecodificarState(state: string): { tenantId: string; profissionalId: string } {
    const partes = Buffer.from(state, 'base64url').toString('utf8').split('.');
    if (partes.length !== 2) throw new BadRequestException('State OAuth invalido.');

    const [payloadBase64, assinatura] = partes;
    const assinaturaEsperada = createHmac('sha256', chaveAssinaturaState()).update(payloadBase64).digest('base64url');
    if (assinatura !== assinaturaEsperada) throw new BadRequestException('State OAuth invalido.');

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as {
      tenantId: string;
      profissionalId: string;
    };
    return { tenantId: payload.tenantId, profissionalId: payload.profissionalId };
  }

  async trocarCodigoPorConexao(tenantId: string, profissionalId: string, code: string, urlCallback: string): Promise<void> {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    const clientSecret = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
    if (!clientId || !clientSecret) throw new BadRequestException('Integracao Google Calendar nao configurada.');

    const tokenUri = textoEnv(process.env.GOOGLE_CALENDAR_TOKEN_URI) ?? 'https://oauth2.googleapis.com/token';
    const resposta = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: urlCallback,
        grant_type: 'authorization_code'
      })
    });
    const corpo = (await resposta.json()) as RespostaTrocaCodigoGoogle;
    if (!resposta.ok || !corpo.refresh_token) {
      throw new BadRequestException(`Falha ao conectar Google Agenda: ${corpo.error_description ?? corpo.error ?? 'resposta invalida'}`);
    }

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const existente = await repositorio.findOne({ where: { tenantId, profissionalId } });
      const dados = {
        tenantId,
        profissionalId,
        refreshTokenCriptografado: this.criptografia.criptografar(corpo.refresh_token as string),
        calendarId: 'primary',
        escoposConcedidos: corpo.scope,
        conectadoEm: new Date(),
        desconectadoEm: undefined
      };
      await repositorio.save(existente ? { ...existente, ...dados } : repositorio.create(dados));
    });
  }

  async obterConexaoAtiva(tenantId: string, profissionalId: string): Promise<CredenciaisGoogleCalendar | undefined> {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    const clientSecret = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
    if (!clientId || !clientSecret) return undefined;

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conexao = await gerenciador.getRepository(ProfissionalGoogleConexaoOrm).findOne({ where: { tenantId, profissionalId } });
      if (!conexao || conexao.desconectadoEm) return undefined;

      return {
        clientId,
        clientSecret,
        refreshToken: this.criptografia.descriptografar(conexao.refreshTokenCriptografado),
        calendarId: conexao.calendarId
      };
    });
  }

  async desconectar(tenantId: string, profissionalId: string): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const conexao = await repositorio.findOne({ where: { tenantId, profissionalId } });
      if (!conexao) return;
      conexao.desconectadoEm = new Date();
      conexao.canalWatchId = undefined;
      conexao.canalRecursoId = undefined;
      conexao.canalExpiraEm = undefined;
      await repositorio.save(conexao);
    });
  }

  private assinarState(tenantId: string, profissionalId: string): string {
    const nonce = randomBytes(8).toString('hex');
    const payloadBase64 = Buffer.from(JSON.stringify({ tenantId, profissionalId, nonce })).toString('base64url');
    const assinatura = createHmac('sha256', chaveAssinaturaState()).update(payloadBase64).digest('base64url');
    return Buffer.from(`${payloadBase64}.${assinatura}`).toString('base64url');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir octaclin-backend exec jest servico-conexao-google-calendar.spec.ts --runInBand`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --dir octaclin-backend typecheck` — expect PASS.

```bash
git add octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-conexao-google-calendar.spec.ts
git commit -m "Adiciona ServicoConexaoGoogleCalendar (fluxo OAuth por profissional) - Fase 136"
```

---

### Task 5: Refactor `ServicoAgenda` for a system-actor path + external-block conflict check

**Files:**
- Modify: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.spec.ts` (check current tests still pass; add new ones below)

**Interfaces:**
- Consumes: `AgendaBloqueioExternoOrm` (Task 2), `ServicoConexaoGoogleCalendar.obterConexaoAtiva` (Task 4).
- Produces:
  - `remarcarConsultaComoSistema(tenantId: string, consultaId: string, dados: RemarcarConsultaAgendaDto, profissionalId: string): Promise<ConsultaAgendaRespostaDto>`
  - `cancelarConsultaComoSistema(tenantId: string, consultaId: string, dados: CancelarConsultaAgendaDto, profissionalId: string): Promise<ConsultaAgendaRespostaDto>`
  - `validarConflitoHorario` (private, unchanged signature) now also checks `agenda_bloqueios_externos`.

- [ ] **Step 1: Write the failing tests**

Add to `servico-agenda.spec.ts` (find the existing conflict test for the pattern; this follows the same construction style already used there — check the file for how `ExecutorTenant`/`gerenciador` fakes are built and match it):

```typescript
  it('bloqueia agendamento quando ha um bloqueio externo do Google no mesmo horario', async () => {
    // Arrange: mesma fabrica de gerenciador falso ja usada nos outros testes deste arquivo,
    // populando a tabela agenda_bloqueios_externos com uma linha que colide com a janela pedida.
    // Assert: criarConsulta rejeita com BadRequestException('Ja existe consulta agendada neste horario para o profissional.')
  });

  it('remarcarConsultaComoSistema atualiza a consulta usando o profissionalId informado, sem exigir UsuarioAutenticado', async () => {
    // Arrange: consulta existente pertencente a profissionalId 'prof-1'.
    // Act: servico.remarcarConsultaComoSistema(tenantId, consultaId, { inicioEm: novaData }, 'prof-1')
    // Assert: retorna a consulta com inicioEm atualizado, sem chamar googleCalendar.criarEvento/atualizarEvento
    //         (a mudanca veio do proprio Google, entao nao re-sincronizamos de volta).
  });
```

(These two tests are written against the existing spec file's established fake-`gerenciador`/`ExecutorTenant` helpers — inspect the top of `servico-agenda.spec.ts` before writing the concrete `Arrange` blocks, and mirror the exact fake shape already in use there so the two new tests are consistent with the rest of the file rather than introducing a second mocking style.)

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --dir octaclin-backend exec jest servico-agenda.spec.ts --runInBand`
Expected: FAIL (`remarcarConsultaComoSistema` doesn't exist; external-block test finds no such check).

- [ ] **Step 3: Implement**

In `servico-agenda.ts`:

1. Add imports:

```typescript
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
```

2. Change `criarEvento` call site in `criarConsulta` to pass `consultaId` (required by Task 3's new interface):

```typescript
    const google = await this.googleCalendar.criarEvento({
      resumo: `Consulta OctaClin - ${contexto.pacienteNome}`,
      descricao: this.montarDescricaoEvento(contexto),
      inicioEm: contexto.consulta.inicioEm,
      fimEm: contexto.consulta.fimEm,
      timezone: contexto.consulta.timezone,
      consultaId: contexto.consulta.id
    });
```

3. Replace `remarcarConsulta` with a public entry point plus a shared private core:

```typescript
  async remarcarConsulta(
    tenantId: string,
    consultaId: string,
    dados: RemarcarConsultaAgendaDto,
    usuario: UsuarioAutenticado
  ): Promise<ConsultaAgendaRespostaDto> {
    const profissionalIdDoUsuario = await this.executorTenant.executar(tenantId, (gerenciador) =>
      resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario)
    );
    return this.executarRemarcacao(tenantId, consultaId, dados, profissionalIdDoUsuario, true);
  }

  async remarcarConsultaComoSistema(
    tenantId: string,
    consultaId: string,
    dados: RemarcarConsultaAgendaDto,
    profissionalId: string
  ): Promise<ConsultaAgendaRespostaDto> {
    return this.executarRemarcacao(tenantId, consultaId, dados, profissionalId, false);
  }

  private async executarRemarcacao(
    tenantId: string,
    consultaId: string,
    dados: RemarcarConsultaAgendaDto,
    profissionalIdEscopo: string | undefined,
    propagarParaGoogle: boolean
  ): Promise<ConsultaAgendaRespostaDto> {
    const inicioEm = dataValida(dados.inicioEm);
    const fimEm = this.calcularFim(inicioEm, dados);
    if (fimEm <= inicioEm) throw new BadRequestException('Horario final deve ser posterior ao inicio da consulta.');

    const consulta = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const atual = await repositorio.findOne({
        where: { id: consultaId, tenantId, ...(profissionalIdEscopo ? { profissionalId: profissionalIdEscopo } : {}) }
      });
      if (!atual) throw new NotFoundException('Consulta nao encontrada.');
      if (atual.status === 'cancelada') throw new BadRequestException('Consulta cancelada nao pode ser remarcada.');

      await this.validarConflitoHorario(gerenciador, tenantId, atual.profissionalId, { inicioEm, fimEm }, atual.id);
      const inicioAnterior = atual.inicioEm;
      const fimAnterior = atual.fimEm;
      atual.inicioEm = inicioEm;
      atual.fimEm = fimEm;
      atual.local = dados.local !== undefined ? textoOpcional(dados.local) : atual.local;
      atual.observacoes = dados.observacoes !== undefined ? textoOpcional(dados.observacoes) : atual.observacoes;
      atual.payload = this.adicionarHistorico(atual.payload, {
        acao: 'remarcada',
        origem: propagarParaGoogle ? 'octaclin' : 'google_agenda',
        inicioAnteriorEm: inicioAnterior.toISOString(),
        fimAnteriorEm: fimAnterior.toISOString(),
        inicioNovoEm: inicioEm.toISOString(),
        fimNovoEm: fimEm.toISOString()
      });
      return repositorio.save(atual);
    });

    if (!propagarParaGoogle) return this.mapearResposta(consulta);

    const google = consulta.googleCalendarId && consulta.googleEventId
      ? await this.googleCalendar.atualizarEvento({
          calendarId: consulta.googleCalendarId,
          eventId: consulta.googleEventId,
          consultaId: consulta.id,
          resumo: consulta.titulo,
          descricao: this.montarDescricaoEvento({
            consulta,
            pacienteNome: this.nomePacientePayload(consulta),
            profissionalNome: this.nomeProfissionalPayload(consulta),
            textoMensagem: ''
          }),
          inicioEm: consulta.inicioEm,
          fimEm: consulta.fimEm,
          timezone: consulta.timezone,
          local: consulta.local
        })
      : { sincronizado: false as const, motivo: 'evento_google_ausente' };

    return this.mapearResposta(await this.aplicarResultadoGoogle(tenantId, consulta.id, google));
  }
```

4. Apply the same split to `cancelarConsulta`:

```typescript
  async cancelarConsulta(
    tenantId: string,
    consultaId: string,
    dados: CancelarConsultaAgendaDto,
    usuario: UsuarioAutenticado
  ): Promise<ConsultaAgendaRespostaDto> {
    const profissionalIdDoUsuario = await this.executorTenant.executar(tenantId, (gerenciador) =>
      resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario)
    );
    return this.executarCancelamento(tenantId, consultaId, dados, profissionalIdDoUsuario, true);
  }

  async cancelarConsultaComoSistema(
    tenantId: string,
    consultaId: string,
    dados: CancelarConsultaAgendaDto,
    profissionalId: string
  ): Promise<ConsultaAgendaRespostaDto> {
    return this.executarCancelamento(tenantId, consultaId, dados, profissionalId, false);
  }

  private async executarCancelamento(
    tenantId: string,
    consultaId: string,
    dados: CancelarConsultaAgendaDto,
    profissionalIdEscopo: string | undefined,
    propagarParaGoogle: boolean
  ): Promise<ConsultaAgendaRespostaDto> {
    const consulta = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const atual = await repositorio.findOne({
        where: { id: consultaId, tenantId, ...(profissionalIdEscopo ? { profissionalId: profissionalIdEscopo } : {}) }
      });
      if (!atual) throw new NotFoundException('Consulta nao encontrada.');
      if (atual.status === 'cancelada') return atual;

      atual.status = 'cancelada';
      atual.payload = this.adicionarHistorico(atual.payload, {
        acao: 'cancelada',
        origem: propagarParaGoogle ? 'octaclin' : 'google_agenda',
        motivo: textoOpcional(dados.motivo),
        canceladaEm: new Date().toISOString()
      });
      return repositorio.save(atual);
    });

    if (!propagarParaGoogle) return this.mapearResposta(consulta);

    const google = consulta.googleCalendarId && consulta.googleEventId
      ? await this.googleCalendar.cancelarEvento({ calendarId: consulta.googleCalendarId, eventId: consulta.googleEventId })
      : { sincronizado: false as const, motivo: 'evento_google_ausente' };

    return this.mapearResposta(await this.aplicarResultadoGoogle(tenantId, consulta.id, google));
  }
```

5. Extend `validarConflitoHorario` to also check external blocks:

```typescript
  private async validarConflitoHorario(
    gerenciador: EntityManager,
    tenantId: string,
    profissionalId: string | undefined,
    janela: JanelaConsulta,
    ignorarConsultaId?: string
  ) {
    if (!profissionalId) return;
    const consultas = await gerenciador.getRepository(AgendaConsultaOrm).find({
      where: { tenantId, profissionalId, status: 'agendada' },
      take: 500
    });
    const conflitoConsulta = consultas.some(
      (consulta) =>
        consulta.id !== ignorarConsultaId &&
        consulta.inicioEm < janela.fimEm &&
        consulta.fimEm > janela.inicioEm
    );
    if (conflitoConsulta) throw new BadRequestException('Ja existe consulta agendada neste horario para o profissional.');

    const bloqueiosExternos = await gerenciador.getRepository(AgendaBloqueioExternoOrm).find({
      where: { tenantId, profissionalId },
      take: 500
    });
    const conflitoExterno = bloqueiosExternos.some(
      (bloqueio) => bloqueio.inicioEm < janela.fimEm && bloqueio.fimEm > janela.inicioEm
    );
    if (conflitoExterno) throw new BadRequestException('Ja existe consulta agendada neste horario para o profissional.');
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir octaclin-backend exec jest servico-agenda.spec.ts --runInBand`
Expected: PASS (all existing tests unaffected, since `remarcarConsulta`/`cancelarConsulta` public signatures and behavior for the HTTP path are unchanged; only the internals were split).

- [ ] **Step 5: Full typecheck (resolves Task 3's intermediate failure) and commit**

Run: `pnpm --dir octaclin-backend typecheck`
Expected: PASS.

Run: `pnpm --dir octaclin-backend exec jest servico-google-calendar.spec.ts servico-agenda.spec.ts --runInBand`
Expected: PASS.

```bash
git add octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-google-calendar.spec.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.spec.ts
git commit -m "Estende ServicoGoogleCalendar/ServicoAgenda para credenciais por profissional e bloqueios externos (Fase 136)"
```

---

### Task 6: `ServicoSincronizacaoGoogleCalendar` + BullMQ queue

**Files:**
- Create: `octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.ts`
- Create: `octaclin-backend/src/modulos/agenda/aplicacao/processador-sincronizacao-google-calendar.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.spec.ts`

**Interfaces:**
- Consumes: `ServicoGoogleCalendar.listarEventosAlterados` (Task 3), `ServicoConexaoGoogleCalendar.obterConexaoAtiva` (Task 4), `ServicoAgenda.remarcarConsultaComoSistema`/`cancelarConsultaComoSistema` (Task 5), `GoogleCanalWatchOrm`/`AgendaBloqueioExternoOrm`/`ProfissionalGoogleConexaoOrm` (Task 2).
- Produces:
  - `ServicoSincronizacaoGoogleCalendar.processarNotificacao(canalWatchId: string): Promise<void>`
  - `FILA_SINCRONIZACAO_GOOGLE = 'sincronizacao-google-calendar'` (BullMQ queue name constant)
  - `ProcessadorSincronizacaoGoogleCalendar` (`@Processor(FILA_SINCRONIZACAO_GOOGLE)`, one job type: `{ canalWatchId: string }`)

- [ ] **Step 1: Write the failing test**

```typescript
// octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.spec.ts
import { ServicoSincronizacaoGoogleCalendar } from './servico-sincronizacao-google-calendar';

describe('ServicoSincronizacaoGoogleCalendar', () => {
  function construirDependencias() {
    const canalRegistro = {
      canalWatchId: 'canal-1',
      tenantId: 'tenant-1',
      profissionalId: 'prof-1',
      expiraEm: new Date(Date.now() + 1000 * 60 * 60)
    };

    const fonteDados = {
      getRepository: () => ({
        findOne: jest.fn(async () => canalRegistro)
      })
    };

    const conexaoConexaoAtiva = {
      clientId: 'c',
      clientSecret: 's',
      refreshToken: 'r',
      calendarId: 'cal-1'
    };
    const servicoConexao = {
      obterConexaoAtiva: jest.fn(async () => conexaoConexaoAtiva),
      atualizarSyncToken: jest.fn(async () => undefined)
    };

    const googleCalendar = {
      listarEventosAlterados: jest.fn(async () => ({
        eventos: [
          { id: 'evt-consulta', status: 'confirmed', octaclinConsultaId: 'consulta-1', inicioEm: new Date('2026-08-01T10:00:00Z'), fimEm: new Date('2026-08-01T10:50:00Z') },
          { id: 'evt-cancelado', status: 'cancelled', octaclinConsultaId: 'consulta-2' },
          { id: 'evt-externo', status: 'confirmed', inicioEm: new Date('2026-08-02T09:00:00Z'), fimEm: new Date('2026-08-02T09:30:00Z') }
        ],
        proximoSyncToken: 'novo-sync-token'
      }))
    };

    const servicoAgenda = {
      remarcarConsultaComoSistema: jest.fn(async () => undefined),
      cancelarConsultaComoSistema: jest.fn(async () => undefined)
    };

    const executorTenant = {
      executar: jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
        callback({
          getRepository: () => ({
            findOne: jest.fn(async () => null),
            create: jest.fn((dados: any) => dados),
            save: jest.fn(async (dados: any) => dados),
            delete: jest.fn(async () => undefined)
          })
        })
      )
    };

    return { fonteDados, servicoConexao, googleCalendar, servicoAgenda, executorTenant, canalRegistro };
  }

  it('aplica evento com octaclinConsultaId via remarcarConsultaComoSistema', async () => {
    const deps = construirDependencias();
    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await servico.processarNotificacao('canal-1');

    expect(deps.servicoAgenda.remarcarConsultaComoSistema).toHaveBeenCalledWith(
      'tenant-1',
      'consulta-1',
      { inicioEm: '2026-08-01T10:00:00.000Z', fimEm: '2026-08-01T10:50:00.000Z' },
      'prof-1'
    );
  });

  it('aplica evento cancelado com octaclinConsultaId via cancelarConsultaComoSistema', async () => {
    const deps = construirDependencias();
    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await servico.processarNotificacao('canal-1');

    expect(deps.servicoAgenda.cancelarConsultaComoSistema).toHaveBeenCalledWith(
      'tenant-1',
      'consulta-2',
      { motivo: 'Cancelado direto na Google Agenda.' },
      'prof-1'
    );
  });

  it('retorna sem erro quando o canal nao existe mais (ja desconectado)', async () => {
    const deps = construirDependencias();
    (deps.fonteDados.getRepository as any) = () => ({ findOne: jest.fn(async () => null) });
    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await expect(servico.processarNotificacao('canal-inexistente')).resolves.not.toThrow();
    expect(deps.googleCalendar.listarEventosAlterados).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --dir octaclin-backend exec jest servico-sincronizacao-google-calendar.spec.ts --runInBand`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

```typescript
// octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { ServicoAgenda } from './servico-agenda';
import { ServicoConexaoGoogleCalendar } from './servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from './servico-google-calendar';

export const FILA_SINCRONIZACAO_GOOGLE = 'sincronizacao-google-calendar';

@Injectable()
export class ServicoSincronizacaoGoogleCalendar {
  private readonly logger = new Logger(ServicoSincronizacaoGoogleCalendar.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly servicoConexao: ServicoConexaoGoogleCalendar,
    private readonly googleCalendar: ServicoGoogleCalendar,
    private readonly servicoAgenda: ServicoAgenda
  ) {}

  async processarNotificacao(canalWatchId: string): Promise<void> {
    const canal = await this.fonteDados.getRepository(GoogleCanalWatchOrm).findOne({ where: { canalWatchId } });
    if (!canal) {
      this.logger.warn(`Notificacao recebida para canal desconhecido/ja desconectado: ${canalWatchId}`);
      return;
    }

    await this.reconciliar(canal.tenantId, canal.profissionalId);
  }

  async reconciliar(tenantId: string, profissionalId: string): Promise<void> {
    const credenciais = await this.servicoConexao.obterConexaoAtiva(tenantId, profissionalId);
    if (!credenciais) return;

    const syncToken = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conexao = await gerenciador
        .getRepository(ProfissionalGoogleConexaoOrm)
        .findOne({ where: { tenantId, profissionalId } });
      return conexao?.ultimoSyncToken;
    });

    const { eventos, proximoSyncToken } = await this.googleCalendar.listarEventosAlterados(credenciais, syncToken);

    for (const evento of eventos) {
      await this.aplicarEvento(tenantId, profissionalId, evento);
    }

    if (proximoSyncToken) {
      await this.executorTenant.executar(tenantId, async (gerenciador) => {
        const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
        const conexao = await repositorio.findOne({ where: { tenantId, profissionalId } });
        if (!conexao) return;
        conexao.ultimoSyncToken = proximoSyncToken;
        await repositorio.save(conexao);
      });
    }
  }

  private async aplicarEvento(
    tenantId: string,
    profissionalId: string,
    evento: { id: string; status: string; octaclinConsultaId?: string; inicioEm?: Date; fimEm?: Date }
  ): Promise<void> {
    if (evento.octaclinConsultaId) {
      await this.aplicarEventoDeConsulta(tenantId, profissionalId, evento);
      return;
    }
    await this.aplicarBloqueioExterno(tenantId, profissionalId, evento);
  }

  private async aplicarEventoDeConsulta(
    tenantId: string,
    profissionalId: string,
    evento: { id: string; status: string; octaclinConsultaId?: string; inicioEm?: Date; fimEm?: Date }
  ): Promise<void> {
    const consultaId = evento.octaclinConsultaId as string;
    try {
      if (evento.status === 'cancelled') {
        await this.servicoAgenda.cancelarConsultaComoSistema(
          tenantId,
          consultaId,
          { motivo: 'Cancelado direto na Google Agenda.' },
          profissionalId
        );
        return;
      }
      if (evento.inicioEm && evento.fimEm) {
        await this.servicoAgenda.remarcarConsultaComoSistema(
          tenantId,
          consultaId,
          { inicioEm: evento.inicioEm.toISOString(), fimEm: evento.fimEm.toISOString() },
          profissionalId
        );
      }
    } catch (erro) {
      this.logger.warn(
        `Falha ao aplicar evento Google ${evento.id} na consulta ${consultaId}: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
      );
    }
  }

  private async aplicarBloqueioExterno(
    tenantId: string,
    profissionalId: string,
    evento: { id: string; status: string; inicioEm?: Date; fimEm?: Date }
  ): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaBloqueioExternoOrm);
      const existente = await repositorio.findOne({ where: { tenantId, profissionalId, googleEventId: evento.id } });

      if (evento.status === 'cancelled' || !evento.inicioEm || !evento.fimEm) {
        if (existente) await repositorio.delete({ id: existente.id });
        return;
      }

      const dados = { tenantId, profissionalId, googleEventId: evento.id, inicioEm: evento.inicioEm, fimEm: evento.fimEm };
      await repositorio.save(existente ? { ...existente, ...dados } : repositorio.create(dados));
    });
  }
}
```

```typescript
// octaclin-backend/src/modulos/agenda/aplicacao/processador-sincronizacao-google-calendar.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FILA_SINCRONIZACAO_GOOGLE, ServicoSincronizacaoGoogleCalendar } from './servico-sincronizacao-google-calendar';

interface JobNotificacaoGoogle {
  canalWatchId: string;
}

@Processor(FILA_SINCRONIZACAO_GOOGLE)
export class ProcessadorSincronizacaoGoogleCalendar extends WorkerHost {
  private readonly logger = new Logger(ProcessadorSincronizacaoGoogleCalendar.name);

  constructor(private readonly servicoSincronizacao: ServicoSincronizacaoGoogleCalendar) {
    super();
  }

  async process(job: Job<JobNotificacaoGoogle>): Promise<void> {
    try {
      await this.servicoSincronizacao.processarNotificacao(job.data.canalWatchId);
    } catch (erro) {
      this.logger.error(
        `Falha ao processar notificacao do canal ${job.data.canalWatchId}: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
      );
      throw erro;
    }
  }
}
```

(`ProcessadorNotificacoes`/`ProcessadorOutboxComunicacoes` in `modulo-comunicacoes.ts` are the existing `@Processor`/`WorkerHost` examples this mirrors — same BullMQ pattern, new queue name.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir octaclin-backend exec jest servico-sincronizacao-google-calendar.spec.ts --runInBand`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --dir octaclin-backend typecheck` — expect PASS.

```bash
git add octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.ts octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.spec.ts octaclin-backend/src/modulos/agenda/aplicacao/processador-sincronizacao-google-calendar.ts
git commit -m "Adiciona ServicoSincronizacaoGoogleCalendar e processador BullMQ (Fase 136)"
```

---

### Task 7: Controller endpoints (OAuth connect/callback/disconnect + webhook)

**Files:**
- Create: `octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts`
- Modify: `octaclin-backend/src/modulos/agenda/modulo-agenda.ts`

**Interfaces:**
- Consumes: `ServicoConexaoGoogleCalendar` (Task 4), `ServicoGoogleCalendar.criarCanalWatch`/`pararCanalWatch` (Task 3), `ServicoSincronizacaoGoogleCalendar` queue (Task 6), `GoogleCanalWatchOrm` (Task 2).
- Produces HTTP routes: `GET /agenda/google/conectar`, `GET /agenda/google/callback`, `POST /agenda/google/desconectar`, `POST /agenda/google/notificacoes` (no auth guard — Google calls this directly).

- [ ] **Step 1: Implement the controller**

```typescript
// octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts
import { randomUUID } from 'crypto';
import { Controller, Get, Headers, HttpCode, Post, Query, Redirect, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoConexaoGoogleCalendar } from '../aplicacao/servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from '../aplicacao/servico-google-calendar';
import { FILA_SINCRONIZACAO_GOOGLE } from '../aplicacao/servico-sincronizacao-google-calendar';

function urlCallback(): string {
  const base = process.env.OCTACLIN_BACKEND_URL?.trim() ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/agenda/google/callback`;
}

function urlWebhook(): string {
  const base = process.env.OCTACLIN_BACKEND_URL?.trim() ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/agenda/google/notificacoes`;
}

@Controller('agenda/google')
export class ControladorGoogleAgenda {
  constructor(
    private readonly servicoConexao: ServicoConexaoGoogleCalendar,
    private readonly googleCalendar: ServicoGoogleCalendar,
    private readonly executorTenant: ExecutorTenant,
    private readonly fonteDados: DataSource,
    @InjectQueue(FILA_SINCRONIZACAO_GOOGLE) private readonly filaSincronizacao: Queue
  ) {}

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

  @Get('callback')
  @Redirect()
  async callback(@Query('code') code: string, @Query('state') state: string) {
    const { tenantId, profissionalId } = this.servicoConexao.validarEDecodificarState(state);
    await this.servicoConexao.trocarCodigoPorConexao(tenantId, profissionalId, code, urlCallback());
    await this.criarCanalParaProfissional(tenantId, profissionalId);

    const urlWeb = process.env.OCTACLIN_WEB_URL?.trim() ?? '/';
    return { url: `${urlWeb.replace(/\/$/, '')}/agenda?google=conectado`, statusCode: 302 };
  }

  @Post('desconectar')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('agenda.consultas.ler')
  async desconectar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    await this.servicoConexao.desconectar(usuario.tenantId, profissionalId);
    return { desconectado: true };
  }

  @Post('notificacoes')
  @HttpCode(200)
  async receberNotificacao(@Headers('x-goog-channel-id') canalWatchId?: string): Promise<void> {
    if (!canalWatchId) return;
    await this.filaSincronizacao.add('notificacao', { canalWatchId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
  }

  private async criarCanalParaProfissional(tenantId: string, profissionalId: string): Promise<void> {
    const credenciais = await this.servicoConexao.obterConexaoAtiva(tenantId, profissionalId);
    if (!credenciais) return;

    const canalId = randomUUID();
    const { recursoId, expiraEm } = await this.googleCalendar.criarCanalWatch(credenciais, canalId, urlWebhook());

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
      this.fonteDados.getRepository(GoogleCanalWatchOrm).create({ canalWatchId: canalId, tenantId, profissionalId, expiraEm })
    );
  }

  private async resolverProfissionalIdObrigatorio(usuario: UsuarioAutenticado): Promise<string> {
    if (usuario.papel !== 'Professional') {
      throw new Error('Somente profissionais podem conectar a propria Google Agenda nesta fase.');
    }
    const profissionalId = await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const { resolverProfissionalIdDoUsuario } = await import('../../../infraestrutura/seguranca/escopo-profissional');
      return resolverProfissionalIdDoUsuario(gerenciador, usuario.tenantId, usuario);
    });
    if (!profissionalId) throw new Error('Profissional nao encontrado para o usuario autenticado.');
    return profissionalId;
  }
}
```

Note: `resolverProfissionalIdObrigatorio` currently restricts this to `papel === 'Professional'` — matches design decision #1 (per-professional connection). A `SuperAdmin` testing this needs a `ProfissionalOrm` row linked to their `usuarioId` (same requirement `resolverProfissionalIdDoUsuario` already has for the `Professional` role elsewhere in the codebase); document this in the fase doc's manual-test note in Task 9.

- [ ] **Step 2: Wire into `modulo-agenda.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloComunicacoes } from '../comunicacoes/modulo-comunicacoes';
import { criarConexaoRedis } from '../comunicacoes/aplicacao/configuracao-redis';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../profissionais/infraestrutura/profissional.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ControladorAgenda } from './apresentacao/controlador-agenda';
import { ControladorGoogleAgenda } from './apresentacao/controlador-google-agenda';
import { ServicoAgenda } from './aplicacao/servico-agenda';
import { ServicoConexaoGoogleCalendar } from './aplicacao/servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from './aplicacao/servico-google-calendar';
import { FILA_SINCRONIZACAO_GOOGLE, ServicoSincronizacaoGoogleCalendar } from './aplicacao/servico-sincronizacao-google-calendar';
import { ProcessadorSincronizacaoGoogleCalendar } from './aplicacao/processador-sincronizacao-google-calendar';
import { ProcessadorRenovacaoGoogleCalendar } from './aplicacao/processador-renovacao-google-calendar';
import { AgendaConsultaOrm } from './infraestrutura/agenda-consulta.orm';
import { AgendaBloqueioExternoOrm } from './infraestrutura/agenda-bloqueio-externo.orm';
import { GoogleCanalWatchOrm } from './infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from './infraestrutura/profissional-google-conexao.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgendaConsultaOrm,
      PacienteOrm,
      ProfissionalOrm,
      UserActionLogOrm,
      ProfissionalGoogleConexaoOrm,
      GoogleCanalWatchOrm,
      AgendaBloqueioExternoOrm
    ]),
    BullModule.forRoot({ connection: criarConexaoRedis() }),
    BullModule.registerQueue({ name: FILA_SINCRONIZACAO_GOOGLE }),
    ScheduleModule.forRoot(),
    ModuloAuth,
    ModuloTenancy,
    ModuloComunicacoes
  ],
  controllers: [ControladorAgenda, ControladorGoogleAgenda],
  providers: [
    ServicoAgenda,
    ServicoGoogleCalendar,
    ServicoConexaoGoogleCalendar,
    ServicoSincronizacaoGoogleCalendar,
    ProcessadorSincronizacaoGoogleCalendar,
    ProcessadorRenovacaoGoogleCalendar,
    ServicoAuditoria,
    CriptografiaDadosSensiveis
  ]
})
export class ModuloAgenda {}
```

(`ProcessadorRenovacaoGoogleCalendar` is created in Task 8 — this task adds the import/wiring for it now so the module file only changes once; if executing tasks out of order, stub-comment it out until Task 8 lands, or do Tasks 7 and 8 back-to-back before committing this file.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --dir octaclin-backend typecheck`
Expected: FAIL until Task 8's `ProcessadorRenovacaoGoogleCalendar` exists — proceed directly to Task 8 before running this check, or temporarily comment out the two `ProcessadorRenovacaoGoogleCalendar` lines to check Task 7 in isolation, then uncomment for Task 8.

- [ ] **Step 4: Commit (after Task 8, together — see Task 8 Step 4)**

---

### Task 8: Daily `@Cron` job — channel renewal + reconciliation safety net

**Files:**
- Create: `octaclin-backend/src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.ts`
- Test: `octaclin-backend/src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.spec.ts`

**Interfaces:**
- Consumes: `ProfissionalGoogleConexaoOrm` (Task 2), `ServicoConexaoGoogleCalendar.obterConexaoAtiva` (Task 4), `ServicoGoogleCalendar.criarCanalWatch`/`pararCanalWatch` (Task 3), `ServicoSincronizacaoGoogleCalendar.reconciliar` (Task 6).
- Produces: `ProcessadorRenovacaoGoogleCalendar.renovarCanaisEReconciliar(): Promise<void>` (also the `@Cron` entry point).

- [ ] **Step 1: Write the failing test**

```typescript
// octaclin-backend/src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.spec.ts
import { ProcessadorRenovacaoGoogleCalendar } from './processador-renovacao-google-calendar';

describe('ProcessadorRenovacaoGoogleCalendar', () => {
  it('renova canais que expiram nas proximas 48h e roda reconciliacao para todas as conexoes ativas', async () => {
    const conexaoPertoDeExpirar = {
      tenantId: 'tenant-1',
      profissionalId: 'prof-1',
      canalWatchId: 'canal-antigo',
      canalRecursoId: 'recurso-antigo',
      canalExpiraEm: new Date(Date.now() + 1000 * 60 * 60 * 10)
    };
    const conexaoFolgada = {
      tenantId: 'tenant-2',
      profissionalId: 'prof-2',
      canalWatchId: 'canal-ok',
      canalRecursoId: 'recurso-ok',
      canalExpiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5)
    };

    const fonteDados = { getRepository: () => ({ find: jest.fn(async () => [conexaoPertoDeExpirar, conexaoFolgada]) }) };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
        callback({ getRepository: () => ({ findOne: jest.fn(async () => null), save: jest.fn(async (dados: any) => dados) }) })
      )
    };
    const servicoConexao = { obterConexaoAtiva: jest.fn(async () => ({ clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'cal' })) };
    const googleCalendar = {
      pararCanalWatch: jest.fn(async () => undefined),
      criarCanalWatch: jest.fn(async () => ({ recursoId: 'recurso-novo', expiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) }))
    };
    const servicoSincronizacao = { reconciliar: jest.fn(async () => undefined) };

    const processador = new ProcessadorRenovacaoGoogleCalendar(
      fonteDados as any,
      executorTenant as any,
      servicoConexao as any,
      googleCalendar as any,
      servicoSincronizacao as any
    );

    await processador.renovarCanaisEReconciliar();

    expect(googleCalendar.pararCanalWatch).toHaveBeenCalledWith(expect.anything(), 'canal-antigo', 'recurso-antigo');
    expect(googleCalendar.criarCanalWatch).toHaveBeenCalledTimes(1);
    expect(servicoSincronizacao.reconciliar).toHaveBeenCalledWith('tenant-1', 'prof-1');
    expect(servicoSincronizacao.reconciliar).toHaveBeenCalledWith('tenant-2', 'prof-2');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --dir octaclin-backend exec jest processador-renovacao-google-calendar.spec.ts --runInBand`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

```typescript
// octaclin-backend/src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.ts
import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ServicoConexaoGoogleCalendar } from './servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from './servico-google-calendar';
import { ServicoSincronizacaoGoogleCalendar } from './servico-sincronizacao-google-calendar';

function urlWebhook(): string {
  const base = process.env.OCTACLIN_BACKEND_URL?.trim() ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/agenda/google/notificacoes`;
}

const JANELA_RENOVACAO_MS = 1000 * 60 * 60 * 48;

@Injectable()
export class ProcessadorRenovacaoGoogleCalendar {
  private readonly logger = new Logger(ProcessadorRenovacaoGoogleCalendar.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly servicoConexao: ServicoConexaoGoogleCalendar,
    private readonly googleCalendar: ServicoGoogleCalendar,
    private readonly servicoSincronizacao: ServicoSincronizacaoGoogleCalendar
  ) {}

  @Cron('0 3 * * *')
  async renovarCanaisEReconciliar(): Promise<void> {
    const conexoes = await this.fonteDados
      .getRepository(ProfissionalGoogleConexaoOrm)
      .find({ where: { desconectadoEm: IsNull() } });

    for (const conexao of conexoes) {
      try {
        if (this.precisaRenovar(conexao)) {
          await this.renovarCanal(conexao);
        }
        await this.servicoSincronizacao.reconciliar(conexao.tenantId, conexao.profissionalId);
      } catch (erro) {
        this.logger.warn(
          `Falha ao renovar/reconciliar canal do profissional ${conexao.profissionalId}: ${
            erro instanceof Error ? erro.message : 'erro desconhecido'
          }`
        );
      }
    }
  }

  private precisaRenovar(conexao: ProfissionalGoogleConexaoOrm): boolean {
    if (!conexao.canalWatchId || !conexao.canalExpiraEm) return true;
    return conexao.canalExpiraEm.getTime() - Date.now() < JANELA_RENOVACAO_MS;
  }

  private async renovarCanal(conexao: ProfissionalGoogleConexaoOrm): Promise<void> {
    const credenciais = await this.servicoConexao.obterConexaoAtiva(conexao.tenantId, conexao.profissionalId);
    if (!credenciais) return;

    if (conexao.canalWatchId && conexao.canalRecursoId) {
      await this.googleCalendar.pararCanalWatch(credenciais, conexao.canalWatchId, conexao.canalRecursoId);
      await this.fonteDados.getRepository(GoogleCanalWatchOrm).delete({ canalWatchId: conexao.canalWatchId });
    }

    const novoCanalId = randomUUID();
    const { recursoId, expiraEm } = await this.googleCalendar.criarCanalWatch(credenciais, novoCanalId, urlWebhook());

    await this.executorTenant.executar(conexao.tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const atual = await repositorio.findOne({ where: { tenantId: conexao.tenantId, profissionalId: conexao.profissionalId } });
      if (!atual) return;
      atual.canalWatchId = novoCanalId;
      atual.canalRecursoId = recursoId;
      atual.canalExpiraEm = expiraEm;
      await repositorio.save(atual);
    });

    await this.fonteDados.getRepository(GoogleCanalWatchOrm).save(
      this.fonteDados.getRepository(GoogleCanalWatchOrm).create({
        canalWatchId: novoCanalId,
        tenantId: conexao.tenantId,
        profissionalId: conexao.profissionalId,
        expiraEm
      })
    );
  }
}
```

(Mirrors `ProcessadorLembretesAgenda`'s `@Cron` + per-row try/catch-and-continue pattern; runs once daily at 03:00 rather than every 5 minutes since renewal only matters within a 48h-to-7-day window, and reconciliation here is a safety net, not the primary sync path.)

- [ ] **Step 4: Run tests, typecheck, and commit Tasks 7+8 together**

Run: `pnpm --dir octaclin-backend exec jest processador-renovacao-google-calendar.spec.ts --runInBand`
Expected: PASS.

Run: `pnpm --dir octaclin-backend typecheck`
Expected: PASS (Task 7's `modulo-agenda.ts` now resolves cleanly).

Run: `pnpm --dir octaclin-backend test --runInBand`
Expected: PASS (full backend suite, catching any cross-module regression).

```bash
git add octaclin-backend/src/modulos/agenda/apresentacao/controlador-google-agenda.ts octaclin-backend/src/modulos/agenda/modulo-agenda.ts octaclin-backend/src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.ts octaclin-backend/src/modulos/agenda/aplicacao/processador-renovacao-google-calendar.spec.ts
git commit -m "Adiciona endpoints OAuth/webhook e job diario de renovacao de canal (Fase 136)"
```

---

### Task 9: Frontend - BFF proxy routes, API client, and UI

**Files:**
- Create: `octaclin-web/app/api/agenda/google/status/route.ts`
- Create: `octaclin-web/app/api/agenda/google/desconectar/route.ts`
- Create: `octaclin-web/app/api/agenda/google/conectar/route.ts`
- Modify: `octaclin-web/lib/agenda-api.ts`
- Modify: `octaclin-web/components/agenda/painel-agenda.tsx` (confirm exact file via `Grep -l "PainelAgenda"` before editing)

**Interfaces:**
- Consumes: `GET /agenda/google/conectar` (Task 7, full-page redirect, not proxied through the BFF `fetch` pattern — it's a real browser navigation, not JSON), `GET /agenda/google/status` (Task 9 Step 1, new).
- Produces: `conectarGoogleAgenda(): void` (navigates the browser), `desconectarGoogleAgenda(): Promise<void>`, `ConexaoGoogleAgendaStatus { conectado: boolean }`.

- [ ] **Step 1: Add a status endpoint on the backend controller**

Add to `controlador-google-agenda.ts` (Task 7's file), reusing the existing guards:

```typescript
  @Get('status')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('agenda.consultas.ler')
  async status(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    const credenciais = await this.servicoConexao.obterConexaoAtiva(usuario.tenantId, profissionalId);
    return { conectado: Boolean(credenciais) };
  }
```

- [ ] **Step 2: BFF proxy routes**

```typescript
// octaclin-web/app/api/agenda/google/status/route.ts
import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function GET() {
  try {
    const resposta = await requisitarBackendAutenticado('/agenda/google/status');
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
```

```typescript
// octaclin-web/app/api/agenda/google/desconectar/route.ts
import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

export async function POST() {
  try {
    const resposta = await requisitarBackendAutenticado('/agenda/google/desconectar', { method: 'POST' });
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) {
      return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    }
    throw erro;
  }
}
```

The "conectar" action is a real browser redirect (OAuth consent screen), not a JSON fetch. Add a tiny BFF route that 302-redirects to the real backend URL so the browser's top-level navigation goes through the BFF origin first (consistent with how `OCTACLIN_API_ORIGENS_PERMITIDAS` already restricts direct cross-origin calls in this codebase):

```typescript
// octaclin-web/app/api/agenda/google/conectar/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const backendUrl = process.env.OCTACLIN_BACKEND_URL?.trim() ?? '';
  return NextResponse.redirect(`${backendUrl.replace(/\/$/, '')}/agenda/google/conectar`);
}
```

- [ ] **Step 3: `agenda-api.ts` client functions**

Append to `octaclin-web/lib/agenda-api.ts`:

```typescript
export interface ConexaoGoogleAgendaStatus {
  conectado: boolean;
}

export async function obterStatusGoogleAgenda(): Promise<ConexaoGoogleAgendaStatus> {
  return requisitar<ConexaoGoogleAgendaStatus>('/api/agenda/google/status');
}

export function conectarGoogleAgenda(): void {
  window.location.href = '/api/agenda/google/conectar';
}

export async function desconectarGoogleAgenda(): Promise<void> {
  await requisitar<{ desconectado: boolean }>('/api/agenda/google/desconectar', { method: 'POST' });
}
```

- [ ] **Step 4: UI — status + connect/disconnect button**

Before editing, run `Grep -n "carregarBootstrapAgenda\|PainelAgenda" octaclin-web/components/agenda/painel-agenda.tsx` to find the toolbar section and the component's existing `useEffect`/`useState` structure (established this session: the file uses `Cartao`/`CartaoCabecalho`/`CartaoConteudo` from `@/components/ui/cartao`, per the Fase-adjacent Cartao-adoption work). Add:

```typescript
  const [statusGoogle, setStatusGoogle] = useState<ConexaoGoogleAgendaStatus | null>(null);

  useEffect(() => {
    void obterStatusGoogleAgenda().then(setStatusGoogle).catch(() => setStatusGoogle({ conectado: false }));
  }, []);
```

and, inside the existing toolbar `Cartao`/`CartaoConteudo` (same one holding the "Atualizar" button pattern used elsewhere in this codebase's panels):

```tsx
          {statusGoogle?.conectado ? (
            <Botao type="button" variante="fantasma" onClick={() => void desconectarGoogleAgenda().then(() => setStatusGoogle({ conectado: false }))}>
              Desconectar Google Agenda
            </Botao>
          ) : (
            <Botao type="button" variante="fantasma" onClick={conectarGoogleAgenda}>
              Conectar Google Agenda
            </Botao>
          )}
```

Add the two new imports (`ConexaoGoogleAgendaStatus, obterStatusGoogleAgenda, conectarGoogleAgenda, desconectarGoogleAgenda`) to the existing `from '@/lib/agenda-api'` import line.

- [ ] **Step 5: Verify**

Run: `pnpm --dir octaclin-web typecheck`
Expected: PASS.

Run: `pnpm --dir octaclin-web build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add octaclin-web/app/api/agenda/google octaclin-web/lib/agenda-api.ts octaclin-web/components/agenda/painel-agenda.tsx
git commit -m "Adiciona UI e rotas BFF de conexao Google Agenda por profissional (Fase 136)"
```

---

### Task 10: `tenant-security-reviewer` pass + `fechar-fase` closeout

**Files:**
- Modify: `fase-136-sincronizacao-google-agenda-profissional.md`, `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `STATUS_ATUAL_PROJETO.md`, `RESUMO_FASES_CONCLUIDAS.md`, `VARIAVEIS_AMBIENTE.md` (document `OCTACLIN_BACKEND_URL` is now also used for the OAuth callback/webhook URL — already listed, just note the new usage)

- [ ] **Step 1: Run the `tenant-security-reviewer` agent**

Dispatch it against everything touched in Tasks 1-8, specifically checking: the webhook (`POST /agenda/google/notificacoes`) never trusts a `canalWatchId` to imply anything beyond looking up `{tenantId, profissionalId}` from `google_canais_watch` before doing any RLS-scoped work; `resolverProfissionalIdObrigatorio` never lets a `Professional` connect/see another professional's connection; `remarcarConsultaComoSistema`/`cancelarConsultaComoSistema` always receive `profissionalId` from a source the sync processor itself resolved (never from event data the far end could forge, since `octaclinConsultaId` alone doesn't cross tenants — the consulta lookup inside `executarRemarcacao`/`executarCancelamento` is still scoped by `tenantId` from the connection row, not from the Google event).

- [ ] **Step 2: Full validation suite**

Run:
```bash
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
npm run security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```
Expected: all PASS.

- [ ] **Step 3: Update the fase doc and roadmap**

In `fase-136-sincronizacao-google-agenda-profissional.md`, change `Status:` to `concluido` and add an "Entregue" section listing the files from Tasks 1-9 and the design refinement (`google_canais_watch`) discovered while planning.

In `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, mark the Fase 136 line `[x]`, with commit hash (fill in after the final commit below) and date.

In `STATUS_ATUAL_PROJETO.md`, add a bullet under "O que esta funcional": "Sincronizacao Google Agenda por profissional (OAuth individual, push notification, bloqueio de horario para eventos externos)."

In `RESUMO_FASES_CONCLUIDAS.md`, add a short entry (this fase adds a real product capability, not just internal docs).

- [ ] **Step 4: Commit and push**

```bash
git add fase-136-sincronizacao-google-agenda-profissional.md CHECKLIST_FASES_FUTURAS_PRODUCAO.md STATUS_ATUAL_PROJETO.md RESUMO_FASES_CONCLUIDAS.md VARIAVEIS_AMBIENTE.md
git commit -m "Fecha Fase 136 - sincronizacao Google Agenda por profissional"
git push
```

- [ ] **Step 5: Report to the user**

Summarize: what was built, that `GOOGLE_CALENDAR_CLIENT_ID`/`GOOGLE_CALENDAR_CLIENT_SECRET` (already configured for the existing outbound flow) now also need the new redirect URI (`<backend-url>/agenda/google/callback`) added in the Google Cloud OAuth consent screen's authorized redirect URIs before this can work end-to-end in production — that's a manual step in Google Cloud Console the user needs to do themselves, not something committable to the repo.

---

## Self-Review Notes

- **Spec coverage:** all 5 approved design decisions map to concrete tasks — per-professional OAuth (Task 4, 7), push notifications (Task 3 watch methods, Task 7 webhook, Task 8 renewal), external events as busy-blocks-only (Task 5 conflict check, Task 6 `aplicarBloqueioExterno`), auto-apply consulta changes via existing remarcacao/cancelamento (Task 5's `ComoSistema` methods, Task 6 `aplicarEventoDeConsulta`), local Postgres storage for blocks (Task 1/2 `agenda_bloqueios_externos`, not a live Google query).
- **Placeholder scan:** no TBD/TODO; every step has literal code.
- **Type consistency:** `CredenciaisGoogleCalendar` (Task 3) is the one shared type threaded through Tasks 3, 4, 6, 7, 8 with the same 4 fields throughout; `remarcarConsultaComoSistema`/`cancelarConsultaComoSistema` signatures in Task 5 match exactly how Task 6 calls them.
- **Known manual step outside this plan's scope:** registering the new OAuth redirect URI in Google Cloud Console (Task 10 Step 5) — cannot be done from the repo.
