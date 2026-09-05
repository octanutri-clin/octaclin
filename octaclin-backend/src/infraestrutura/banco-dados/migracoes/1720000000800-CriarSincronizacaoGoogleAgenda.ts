import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
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
