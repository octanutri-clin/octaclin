import { MigrationInterface, QueryRunner } from 'typeorm';

/** Vinculo aditivo entre serie fotografica e objeto privado confirmado. */
export class VincularArquivosEvolucaoFotografica1720000001025 implements MigrationInterface {
  name = 'VincularArquivosEvolucaoFotografica1720000001025';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table evolucoes_fotograficas
        add constraint uq_evolucoes_fotograficas_tenant_id unique (tenant_id, id);
      create table if not exists evolucoes_fotograficas_arquivos (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        evolucao_fotografica_id uuid not null,
        arquivo_midia_id uuid not null references arquivos_midia(id) on delete restrict,
        criado_em timestamptz not null default now(),
        constraint fk_evolucoes_fotograficas_arquivos_evolucao foreign key (tenant_id, evolucao_fotografica_id)
          references evolucoes_fotograficas (tenant_id, id) on delete restrict,
        unique (tenant_id, evolucao_fotografica_id, arquivo_midia_id),
        unique (tenant_id, arquivo_midia_id)
      );
      create index if not exists idx_evolucoes_fotograficas_arquivos_serie
        on evolucoes_fotograficas_arquivos (tenant_id, evolucao_fotografica_id);
      alter table evolucoes_fotograficas_arquivos enable row level security;
      alter table evolucoes_fotograficas_arquivos force row level security;
      drop policy if exists isolamento_tenant_evolucoes_fotograficas_arquivos on evolucoes_fotograficas_arquivos;
      create policy isolamento_tenant_evolucoes_fotograficas_arquivos on evolucoes_fotograficas_arquivos
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists evolucoes_fotograficas_arquivos cascade; alter table evolucoes_fotograficas drop constraint if exists uq_evolucoes_fotograficas_tenant_id;');
  }
}
