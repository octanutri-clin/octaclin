import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriarConvitesPacienteAcesso1720000000200 implements MigrationInterface {
  name = 'CriarConvitesPacienteAcesso1720000000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists convites_paciente_acesso (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        usuario_id uuid references usuarios(id),
        criado_por_usuario_id uuid not null references usuarios(id),
        email_hash varchar(128) not null,
        email_criptografado bytea not null,
        token_hash varchar(128) not null unique,
        status varchar(40) not null default 'pendente',
        expira_em timestamptz not null,
        aceito_em timestamptz,
        revogado_em timestamptz,
        payload jsonb not null default '{}'::jsonb,
        criado_em timestamptz not null default now()
      );

      create index if not exists idx_convites_paciente_tenant_paciente on convites_paciente_acesso (tenant_id, paciente_id, criado_em desc);
      create index if not exists idx_convites_paciente_token_hash on convites_paciente_acesso (token_hash);
      create index if not exists idx_convites_paciente_status on convites_paciente_acesso (tenant_id, status, expira_em);

      alter table convites_paciente_acesso enable row level security;
      alter table convites_paciente_acesso force row level security;

      drop policy if exists isolamento_tenant_convites_paciente_acesso on convites_paciente_acesso;
      create policy isolamento_tenant_convites_paciente_acesso
        on convites_paciente_acesso
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists convites_paciente_acesso cascade`);
  }
}
