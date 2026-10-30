import { MigrationInterface, QueryRunner } from 'typeorm';
/** @aplicacao fora-de-banda */
export class GruposSubstituicoes1720000001078 implements MigrationInterface {
  name = 'GruposSubstituicoes1720000001078';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`create table grupos_substituicoes (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references tenants(id) on delete restrict,
      profissional_id uuid not null,
      criado_por_usuario_id uuid not null, alterado_por_usuario_id uuid not null,
      chave_idempotencia uuid not null,
      escopo varchar(10) not null check (escopo in ('pessoal','clinica')),
      estado varchar(10) not null default 'ativo' check (estado in ('ativo','arquivado')),
      revisao integer not null default 1 check (revisao > 0),
      conteudo_criptografado bytea not null, criacao_snapshot_criptografado bytea not null,
      busca_hashes text[] not null default '{}', categoria_hash text null,
      etiquetas_hashes text[] not null default '{}',
      criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
      unique (tenant_id,id), unique (tenant_id,profissional_id,chave_idempotencia),
      foreign key (tenant_id, profissional_id) references profissionais(tenant_id,id) on delete restrict,
      foreign key (tenant_id, criado_por_usuario_id) references usuarios(tenant_id,id) on delete restrict,
      foreign key (tenant_id, alterado_por_usuario_id) references usuarios(tenant_id,id) on delete restrict
    );
    create index idx_grupos_substituicoes_lista on grupos_substituicoes(tenant_id,escopo,estado,criado_em desc,id desc);
    create index idx_grupos_substituicoes_criador on grupos_substituicoes(tenant_id,profissional_id,estado,criado_em desc,id desc);
    create index idx_grupos_substituicoes_busca on grupos_substituicoes using gin(busca_hashes);
    create index idx_grupos_substituicoes_categoria on grupos_substituicoes(tenant_id,categoria_hash);
    create index idx_grupos_substituicoes_etiquetas on grupos_substituicoes using gin(etiquetas_hashes);
    create table favoritos_grupos_substituicoes (
      id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete restrict,
      profissional_id uuid not null, grupo_id uuid not null, criado_em timestamptz not null default now(),
      unique (tenant_id,profissional_id,grupo_id),
      foreign key (tenant_id, profissional_id) references profissionais(tenant_id,id) on delete restrict,
      foreign key (tenant_id, grupo_id) references grupos_substituicoes(tenant_id,id) on delete restrict
    );
    alter table grupos_substituicoes enable row level security;
    alter table grupos_substituicoes force row level security;
    create policy grupos_substituicoes_tenant on grupos_substituicoes
      using (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
      with check (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
    alter table favoritos_grupos_substituicoes enable row level security;
    alter table favoritos_grupos_substituicoes force row level security;
    create policy favoritos_grupos_tenant on favoritos_grupos_substituicoes
      using (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
      with check (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);`);
  }
  async down(_q: QueryRunner): Promise<void> { throw new Error('Rollback recusado: manter dados e schema aditivo.'); }
}
