import { MigrationInterface, QueryRunner } from 'typeorm';
/** @aplicacao fora-de-banda — biblioteca tenant-aware; nenhum plano é recalculado. */
export class MedidasCaseiras1720000001075 implements MigrationInterface {
    name = 'MedidasCaseiras1720000001075';
    async up(q: QueryRunner): Promise<void> {
        await q.query(`create table medidas_caseiras_alimentos (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references tenants(id) on delete restrict,
      alimento_composicao_id uuid not null references alimentos_composicao(id) on delete restrict,
      profissional_id uuid not null,
      chave_idempotencia uuid not null,
      escopo varchar(10) not null check (escopo in ('pessoal','clinica')),
      conteudo_criptografado bytea not null,
      criacao_snapshot_criptografado bytea not null,
      revisao integer not null default 1 check (revisao > 0),
      ativa boolean not null default true,
      criado_em timestamptz not null default now(),
      atualizado_em timestamptz not null default now(),
      unique (tenant_id,profissional_id,chave_idempotencia),
      foreign key (tenant_id,profissional_id) references profissionais(tenant_id,id) on delete restrict
    );
    create index idx_medidas_caseiras_alimento on medidas_caseiras_alimentos
      (tenant_id,alimento_composicao_id,criado_em desc,id desc);
    alter table medidas_caseiras_alimentos enable row level security;
    alter table medidas_caseiras_alimentos force row level security;
    create policy medidas_caseiras_tenant on medidas_caseiras_alimentos
      using (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
      with check (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
    alter table plano_alimentar_versoes add column medidas_caseiras_snapshot_criptografado bytea null;`);
    }
    async down(_q: QueryRunner): Promise<void> {
        throw new Error('Rollback recusado: preserve a biblioteca e os snapshots; reverta o código mantendo o schema aditivo.');
    }
}
