import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class FavoritosAlimentosProfissional1720000001077 implements MigrationInterface {
  name = 'FavoritosAlimentosProfissional1720000001077';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`create table favoritos_alimentos_profissional (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references tenants(id) on delete restrict,
      profissional_id uuid not null,
      alimento_composicao_id uuid null references alimentos_composicao(id) on delete restrict,
      alimento_personalizado_id uuid null,
      criado_em timestamptz not null default now(),
      constraint fk_favorito_profissional foreign key (tenant_id, profissional_id) references profissionais(tenant_id,id) on delete restrict,
      constraint fk_favorito_custom foreign key (tenant_id, alimento_personalizado_id) references alimentos_personalizados(tenant_id,id) on delete restrict,
      constraint ck_favorito_origem_unica check ((alimento_composicao_id is null) <> (alimento_personalizado_id is null))
    );
    create unique index ux_favorito_alimento_profissional on favoritos_alimentos_profissional
      (tenant_id,profissional_id,alimento_composicao_id,alimento_personalizado_id) nulls not distinct;
    create index idx_favorito_profissional_catalogo on favoritos_alimentos_profissional
      (tenant_id,profissional_id,alimento_composicao_id) where alimento_composicao_id is not null;
    create index idx_favorito_profissional_custom on favoritos_alimentos_profissional
      (tenant_id,profissional_id,alimento_personalizado_id) where alimento_personalizado_id is not null;
    alter table favoritos_alimentos_profissional enable row level security;
    alter table favoritos_alimentos_profissional force row level security;
    create policy favoritos_alimentos_tenant on favoritos_alimentos_profissional
      using (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
      with check (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);`);
  }
  async down(_q: QueryRunner): Promise<void> {
    throw new Error('Rollback recusado: reverta o código mantendo preferências e schema aditivo.');
  }
}
