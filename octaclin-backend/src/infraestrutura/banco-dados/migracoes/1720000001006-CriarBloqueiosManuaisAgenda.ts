import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarBloqueiosManuaisAgenda1720000001006 implements MigrationInterface {
  name = 'CriarBloqueiosManuaisAgenda1720000001006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists agenda_bloqueios_manuais (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        tipo varchar(20) not null check (tipo in ('intervalo', 'reuniao', 'ferias')),
        inicio_em timestamptz not null,
        fim_em timestamptz not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        check (fim_em > inicio_em)
      );

      create index if not exists idx_agenda_bloqueios_manuais_tenant_profissional
        on agenda_bloqueios_manuais (tenant_id, profissional_id, inicio_em, fim_em);

      alter table agenda_bloqueios_manuais enable row level security;
      alter table agenda_bloqueios_manuais force row level security;

      drop policy if exists isolamento_tenant_agenda_bloqueios_manuais on agenda_bloqueios_manuais;
      create policy isolamento_tenant_agenda_bloqueios_manuais
        on agenda_bloqueios_manuais
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists agenda_bloqueios_manuais cascade`);
  }
}
