import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriarAgendaConsultas1720000000100 implements MigrationInterface {
  name = 'CriarAgendaConsultas1720000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists agenda_consultas (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        profissional_id uuid references profissionais(id),
        titulo varchar(180) not null,
        inicio_em timestamptz not null,
        fim_em timestamptz not null,
        timezone varchar(80) not null default 'America/Sao_Paulo',
        status varchar(40) not null default 'agendada',
        local varchar(180),
        observacoes text,
        google_calendar_id varchar(220),
        google_event_id varchar(220),
        google_event_html_link text,
        notificacoes jsonb not null default '{}'::jsonb,
        payload jsonb not null default '{}'::jsonb,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      );

      create index if not exists idx_agenda_consultas_tenant_inicio on agenda_consultas (tenant_id, inicio_em);
      create index if not exists idx_agenda_consultas_tenant_paciente on agenda_consultas (tenant_id, paciente_id, inicio_em desc);
      create index if not exists idx_agenda_consultas_google_event on agenda_consultas (tenant_id, google_event_id);

      alter table agenda_consultas enable row level security;
      alter table agenda_consultas force row level security;

      drop policy if exists isolamento_tenant_agenda_consultas on agenda_consultas;
      create policy isolamento_tenant_agenda_consultas
        on agenda_consultas
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists agenda_consultas cascade`);
  }
}
