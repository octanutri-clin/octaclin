import { MigrationInterface, QueryRunner } from 'typeorm';

/** PB-17: catalogo cifrado e vinculo opcional dos resultados, sem backfill.
 * @aplicacao fora-de-banda
 */
export class CriarCatalogoMarcadoresExames1720000001054 implements MigrationInterface {
  name = 'CriarCatalogoMarcadoresExames1720000001054';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists catalogo_marcadores_exames (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        definicao_criptografada bytea not null,
        criado_por_usuario_id uuid not null,
        arquivado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_catalogo_marcadores_exames_tenant_id_id unique (tenant_id, id),
        constraint fk_catalogo_marcadores_exames_usuario
          foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict
      );
      create index if not exists idx_catalogo_marcadores_exames_listagem
        on catalogo_marcadores_exames (tenant_id, arquivado_em, atualizado_em desc);
      alter table catalogo_marcadores_exames enable row level security;
      alter table catalogo_marcadores_exames force row level security;
      create policy isolamento_tenant_catalogo_marcadores_exames on catalogo_marcadores_exames
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      alter table marcadores_exames_laboratoriais
        add column if not exists catalogo_marcador_id uuid;
      alter table marcadores_exames_laboratoriais
        add constraint fk_marcadores_exames_catalogo_tenant
        foreign key (tenant_id, catalogo_marcador_id)
        references catalogo_marcadores_exames (tenant_id, id) on delete restrict;
      create index if not exists idx_marcadores_exames_catalogo
        on marcadores_exames_laboratoriais (tenant_id, catalogo_marcador_id)
        where catalogo_marcador_id is not null;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop index if exists idx_marcadores_exames_catalogo;
      alter table marcadores_exames_laboratoriais drop constraint if exists fk_marcadores_exames_catalogo_tenant;
      alter table marcadores_exames_laboratoriais drop column if exists catalogo_marcador_id;
      drop table if exists catalogo_marcadores_exames;
    `);
  }
}
