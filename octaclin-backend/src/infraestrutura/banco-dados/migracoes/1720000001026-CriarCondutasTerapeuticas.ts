import { MigrationInterface, QueryRunner } from 'typeorm';

/** Registro versionado de condutas documentadas pelo profissional, sem motor de prescricao. *
 * @aplicacao fora-de-banda
 */
export class CriarCondutasTerapeuticas1720000001026 implements MigrationInterface {
  name = 'CriarCondutasTerapeuticas1720000001026';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists condutas_terapeuticas (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        profissional_id uuid not null references profissionais(id),
        tipo varchar(40) not null check (tipo in ('meta', 'orientacao', 'suplemento', 'produto', 'formula_manipulada')),
        arquivada_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        unique (tenant_id, id)
      );
      create table if not exists condutas_terapeuticas_versoes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        conduta_terapeutica_id uuid not null,
        numero integer not null check (numero > 0),
        titulo_criptografado bytea not null,
        conteudo_criptografado bytea not null,
        validade_inicio date,
        validade_fim date,
        criado_por_usuario_id uuid not null references usuarios(id),
        revisada_em timestamptz,
        revisada_por_usuario_id uuid references usuarios(id),
        publicada_em timestamptz,
        descartada_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint fk_condutas_terapeuticas_versoes_conduta foreign key (tenant_id, conduta_terapeutica_id)
          references condutas_terapeuticas (tenant_id, id) on delete restrict,
        unique (tenant_id, conduta_terapeutica_id, numero),
        check (validade_fim is null or validade_inicio is null or validade_fim >= validade_inicio)
      );
      create unique index if not exists uq_condutas_terapeuticas_versao_publicada
        on condutas_terapeuticas_versoes (tenant_id, conduta_terapeutica_id)
        where publicada_em is not null and descartada_em is null;
      create index if not exists idx_condutas_terapeuticas_paciente
        on condutas_terapeuticas (tenant_id, paciente_id, arquivada_em, atualizado_em desc);
      create index if not exists idx_condutas_terapeuticas_versoes_conduta
        on condutas_terapeuticas_versoes (tenant_id, conduta_terapeutica_id, numero desc);
      alter table condutas_terapeuticas enable row level security;
      alter table condutas_terapeuticas force row level security;
      alter table condutas_terapeuticas_versoes enable row level security;
      alter table condutas_terapeuticas_versoes force row level security;
      create policy isolamento_tenant_condutas_terapeuticas on condutas_terapeuticas
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      create policy isolamento_tenant_condutas_terapeuticas_versoes on condutas_terapeuticas_versoes
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists condutas_terapeuticas_versoes cascade; drop table if exists condutas_terapeuticas cascade;');
  }
}
