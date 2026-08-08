import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarIntegracoesApiPublica1720000001022 implements MigrationInterface {
  name = 'CriarIntegracoesApiPublica1720000001022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table pacientes add column if not exists referencia_externa varchar(180);
      alter table agenda_consultas add column if not exists referencia_externa varchar(180);

      create unique index if not exists ux_pacientes_referencia_externa
        on pacientes (tenant_id, referencia_externa)
        where referencia_externa is not null;
      create unique index if not exists ux_agenda_consultas_referencia_externa
        on agenda_consultas (tenant_id, referencia_externa)
        where referencia_externa is not null;

      create table if not exists api_chaves (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        nome varchar(120) not null,
        prefixo varchar(28) not null,
        segredo_hash varchar(64) not null,
        escopos text[] not null,
        criado_por_usuario_id uuid,
        expira_em timestamptz,
        ultimo_uso_em timestamptz,
        revogada_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint api_chaves_escopos_check check (
          cardinality(escopos) between 1 and 4
          and escopos <@ array['pacientes:ler','pacientes:escrever','agenda:ler','agenda:escrever']::text[]
        ),
        constraint fk_api_chaves_usuario_tenant
          foreign key (tenant_id, criado_por_usuario_id)
          references usuarios (tenant_id, id) on delete restrict
      );

      create unique index if not exists ux_api_chaves_tenant_prefixo on api_chaves (tenant_id, prefixo);
      create index if not exists idx_api_chaves_ativas on api_chaves (tenant_id, criado_em desc)
        where revogada_em is null;

      create table if not exists webhook_assinaturas (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        nome varchar(120) not null,
        url text not null,
        eventos text[] not null,
        segredo_criptografado bytea not null,
        ativo boolean not null default true,
        criado_por_usuario_id uuid,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint webhook_assinaturas_eventos_check check (
          cardinality(eventos) between 1 and 4
          and eventos <@ array['paciente.criado','consulta.criada','consulta.cancelada','formulario.respondido']::text[]
        ),
        constraint fk_webhook_assinaturas_usuario_tenant
          foreign key (tenant_id, criado_por_usuario_id)
          references usuarios (tenant_id, id) on delete restrict
      );

      create index if not exists idx_webhook_assinaturas_ativas
        on webhook_assinaturas (tenant_id, criado_em desc) where ativo = true;

      create unique index if not exists ux_webhook_assinaturas_tenant_id_id
        on webhook_assinaturas (tenant_id, id);

      create table if not exists webhook_entregas (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        assinatura_id uuid not null,
        evento varchar(60) not null,
        recurso_tipo varchar(60) not null,
        recurso_id uuid,
        payload jsonb not null,
        status varchar(20) not null default 'pendente',
        tentativas integer not null default 0,
        proxima_tentativa_em timestamptz not null default now(),
        ultimo_status_http integer,
        ultimo_erro varchar(500),
        entregue_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint webhook_entregas_status_check check (status in ('pendente','processando','entregue','falhou')),
        constraint webhook_entregas_tentativas_check check (tentativas between 0 and 8),
        constraint webhook_entregas_evento_check check (
          evento in ('paciente.criado','consulta.criada','consulta.cancelada','formulario.respondido')
        ),
        constraint fk_webhook_entregas_assinatura_tenant
          foreign key (tenant_id, assinatura_id)
          references webhook_assinaturas (tenant_id, id) on delete cascade
      );

      create unique index if not exists ux_webhook_entregas_evento_recurso
        on webhook_entregas (tenant_id, assinatura_id, evento, recurso_id)
        where recurso_id is not null;
      create index if not exists idx_webhook_entregas_pendentes
        on webhook_entregas (tenant_id, proxima_tentativa_em, criado_em)
        where status = 'pendente';
      create index if not exists idx_webhook_entregas_historico
        on webhook_entregas (tenant_id, criado_em desc);

      alter table api_chaves enable row level security;
      alter table api_chaves force row level security;
      alter table webhook_assinaturas enable row level security;
      alter table webhook_assinaturas force row level security;
      alter table webhook_entregas enable row level security;
      alter table webhook_entregas force row level security;

      drop policy if exists isolamento_tenant_api_chaves on api_chaves;
      create policy isolamento_tenant_api_chaves on api_chaves
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      drop policy if exists isolamento_tenant_webhook_assinaturas on webhook_assinaturas;
      create policy isolamento_tenant_webhook_assinaturas on webhook_assinaturas
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      drop policy if exists isolamento_tenant_webhook_entregas on webhook_entregas;
      create policy isolamento_tenant_webhook_entregas on webhook_entregas
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop table if exists webhook_entregas cascade;
      drop table if exists webhook_assinaturas cascade;
      drop table if exists api_chaves cascade;
      drop index if exists ux_agenda_consultas_referencia_externa;
      drop index if exists ux_pacientes_referencia_externa;
      alter table agenda_consultas drop column if exists referencia_externa;
      alter table pacientes drop column if exists referencia_externa;
    `);
  }
}
