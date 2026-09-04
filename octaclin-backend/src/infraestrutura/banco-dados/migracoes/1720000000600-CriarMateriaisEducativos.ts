import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriarMateriaisEducativos1720000000600 implements MigrationInterface {
  name = 'CriarMateriaisEducativos1720000000600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists materiais_educativos (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        criado_por_usuario_id uuid not null references usuarios(id),
        titulo varchar(180) not null,
        tipo varchar(40) not null,
        categoria varchar(80),
        resumo varchar(500),
        url varchar(1000),
        conteudo text,
        ativo boolean not null default true,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      );

      create index if not exists idx_materiais_educativos_tenant_ativo on materiais_educativos (tenant_id, ativo, criado_em desc);
      create index if not exists idx_materiais_educativos_tenant_categoria on materiais_educativos (tenant_id, categoria);

      create table if not exists envios_material_paciente (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        material_id uuid not null references materiais_educativos(id),
        enviado_por_usuario_id uuid not null references usuarios(id),
        observacao_criptografada bytea,
        status varchar(40) not null default 'enviado',
        enviado_em timestamptz default now(),
        visualizado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      );

      create index if not exists idx_envios_material_paciente_tenant_paciente on envios_material_paciente (tenant_id, paciente_id, enviado_em desc);
      create index if not exists idx_envios_material_paciente_tenant_material on envios_material_paciente (tenant_id, material_id);

      alter table materiais_educativos enable row level security;
      alter table materiais_educativos force row level security;
      alter table envios_material_paciente enable row level security;
      alter table envios_material_paciente force row level security;

      drop policy if exists isolamento_tenant_materiais_educativos on materiais_educativos;
      create policy isolamento_tenant_materiais_educativos
        on materiais_educativos
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      drop policy if exists isolamento_tenant_envios_material_paciente on envios_material_paciente;
      create policy isolamento_tenant_envios_material_paciente
        on envios_material_paciente
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists envios_material_paciente cascade`);
    await queryRunner.query(`drop table if exists materiais_educativos cascade`);
  }
}
