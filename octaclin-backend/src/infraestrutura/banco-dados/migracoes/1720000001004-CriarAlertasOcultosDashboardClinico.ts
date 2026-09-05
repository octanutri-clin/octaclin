import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriarAlertasOcultosDashboardClinico1720000001004 implements MigrationInterface {
  name = 'CriarAlertasOcultosDashboardClinico1720000001004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table dashboard_alertas_ocultos (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null references usuarios(id),
        alerta_id varchar(240) not null,
        oculto_ate_em timestamptz not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        unique (tenant_id, usuario_id, alerta_id)
      );

      create index idx_dashboard_alertas_ocultos_ativos
        on dashboard_alertas_ocultos (tenant_id, usuario_id, oculto_ate_em);

      alter table dashboard_alertas_ocultos enable row level security;
      alter table dashboard_alertas_ocultos force row level security;

      create policy isolamento_tenant_dashboard_alertas_ocultos
        on dashboard_alertas_ocultos
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists dashboard_alertas_ocultos cascade`);
  }
}
