import { MigrationInterface, QueryRunner } from 'typeorm';
/** @aplicacao fora-de-banda — preservar biblioteca, medidas e snapshots no rollback. */
export class AlimentosPersonalizados1720000001076 implements MigrationInterface {
  name = 'AlimentosPersonalizados1720000001076';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`create table alimentos_personalizados (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references tenants(id) on delete restrict,
      profissional_id uuid not null,
      chave_idempotencia uuid not null,
      escopo varchar(10) not null check (escopo in ('pessoal','clinica')),
      conteudo_criptografado bytea not null,
      criacao_snapshot_criptografado bytea not null,
      busca_hashes text[] not null default '{}',
      revisao integer not null default 1 check (revisao > 0),
      ativo boolean not null default true,
      criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
      unique (tenant_id,id), unique (tenant_id,profissional_id,chave_idempotencia),
      foreign key (tenant_id,profissional_id) references profissionais(tenant_id,id) on delete restrict
    );
    create index idx_alimentos_custom_listagem on alimentos_personalizados (tenant_id,escopo,criado_em desc,id desc);
    create index idx_alimentos_custom_proprietario on alimentos_personalizados (tenant_id,profissional_id,criado_em desc,id desc);
    create index idx_alimentos_custom_busca on alimentos_personalizados using gin (busca_hashes);
    alter table alimentos_personalizados enable row level security;
    alter table alimentos_personalizados force row level security;
    create policy alimentos_personalizados_tenant on alimentos_personalizados
      using (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
      with check (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
    alter table plano_alimentar_versoes add column alimentos_personalizados_snapshot_criptografado bytea null;
    alter table medidas_caseiras_alimentos add column alimento_personalizado_id uuid null;
    alter table medidas_caseiras_alimentos alter column alimento_composicao_id drop not null;
    alter table medidas_caseiras_alimentos add constraint fk_medida_alimento_personalizado
      foreign key (tenant_id,alimento_personalizado_id) references alimentos_personalizados(tenant_id,id) on delete restrict;
    alter table medidas_caseiras_alimentos add constraint ck_medida_pai_unico
      check ((alimento_composicao_id is null) <> (alimento_personalizado_id is null));
    create index idx_medidas_custom_alimento on medidas_caseiras_alimentos (tenant_id,alimento_personalizado_id,criado_em desc,id desc)
      where alimento_personalizado_id is not null;`);
  }
  async down(_q: QueryRunner): Promise<void> {
    throw new Error('Rollback recusado: preserve biblioteca, medidas e snapshots com leitor compatível.');
  }
}
