import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Visoes de trabalho salvas da lista de pacientes.
 *
 * Guarda apenas criterio estruturado. O texto da busca livre fica de fora de
 * proposito: ele aceita nome e CPF, e um filtro de clinica carregando esse
 * texto vazaria PII para toda a equipe.
 */
export class CriarFiltrosSalvosPacientes1720000001035 implements MigrationInterface {
  name = 'CriarFiltrosSalvosPacientes1720000001035';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists filtros_salvos_pacientes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        origem varchar(20) not null check (origem in ('pessoal', 'clinica')),
        profissional_id uuid,
        nome_criptografado bytea not null,
        criterios jsonb not null,
        criado_por_usuario_id uuid not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        arquivado_em timestamptz,
        constraint ux_filtros_salvos_pacientes_tenant_id_id unique (tenant_id, id),
        constraint fk_filtros_salvos_pacientes_profissional
          foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete cascade,
        constraint fk_filtros_salvos_pacientes_usuario
          foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict,
        constraint filtros_salvos_pacientes_origem_profissional_check check (
          (origem = 'pessoal' and profissional_id is not null)
          or (origem = 'clinica' and profissional_id is null)
        )
      );
      create index if not exists idx_filtros_salvos_pacientes_listagem
        on filtros_salvos_pacientes (tenant_id, origem, arquivado_em, atualizado_em desc);
      create index if not exists idx_filtros_salvos_pacientes_profissional
        on filtros_salvos_pacientes (tenant_id, profissional_id, arquivado_em, atualizado_em desc)
        where profissional_id is not null;
      alter table filtros_salvos_pacientes enable row level security;
      alter table filtros_salvos_pacientes force row level security;
      create policy isolamento_tenant_filtros_salvos_pacientes on filtros_salvos_pacientes
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists filtros_salvos_pacientes cascade;');
  }
}
