import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriarEvolucoesClinicas1720000000400 implements MigrationInterface {
  name = 'CriarEvolucoesClinicas1720000000400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists evolucoes_clinicas (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        autor_usuario_id uuid not null references usuarios(id),
        titulo varchar(180) not null,
        conteudo_criptografado bytea not null,
        tipo varchar(40) not null default 'observacao',
        visibilidade varchar(40) not null default 'privada',
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      );

      create index if not exists idx_evolucoes_clinicas_tenant_paciente on evolucoes_clinicas (tenant_id, paciente_id, criado_em desc);
      create index if not exists idx_evolucoes_clinicas_tenant_autor on evolucoes_clinicas (tenant_id, autor_usuario_id, criado_em desc);

      alter table evolucoes_clinicas enable row level security;
      alter table evolucoes_clinicas force row level security;

      drop policy if exists isolamento_tenant_evolucoes_clinicas on evolucoes_clinicas;
      create policy isolamento_tenant_evolucoes_clinicas
        on evolucoes_clinicas
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists evolucoes_clinicas cascade`);
  }
}
