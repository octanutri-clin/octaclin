import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriarPerfisCadastroPaciente1720000001023 implements MigrationInterface {
  name = 'CriarPerfisCadastroPaciente1720000001023';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists pacientes_perfis (
        paciente_id uuid primary key references pacientes(id) on delete restrict,
        tenant_id uuid not null references tenants(id),
        identificacao_criptografada bytea,
        contato_criptografado bytea,
        operacao_criptografada bytea,
        fiscal_criptografado bytea,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint uq_pacientes_perfis_tenant_paciente unique (tenant_id, paciente_id)
      );

      create index if not exists idx_pacientes_perfis_tenant on pacientes_perfis (tenant_id, atualizado_em desc);

      alter table pacientes_perfis enable row level security;
      alter table pacientes_perfis force row level security;
      drop policy if exists isolamento_tenant_pacientes_perfis on pacientes_perfis;
      create policy isolamento_tenant_pacientes_perfis on pacientes_perfis
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists pacientes_perfis cascade');
  }
}
