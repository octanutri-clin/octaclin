import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda; aditiva, sem envios ou backfill no ato da migration. */
export class CriarCalendarioFollowupsAgenda1720000001057 implements MigrationInterface {
  name = 'CriarCalendarioFollowupsAgenda1720000001057';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table agenda_consultas add constraint ux_agenda_consultas_tenant_id_id unique (tenant_id, id);
      alter table agenda_consultas add column followup_politica_id uuid;
      alter table agenda_consultas add column followup_versao integer;
      alter table outbox_eventos add column reivindicado_em timestamptz;
      alter table mensagens_notificacao add column tentativa_externa_em timestamptz;
      create table politicas_followup_agenda (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        consulta_id uuid,
        ativo boolean not null default false,
        etapas jsonb not null default '[]'::jsonb,
        versao integer not null default 1,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint fk_politica_followup_consulta foreign key (tenant_id, consulta_id)
          references agenda_consultas (tenant_id, id) on delete cascade,
        constraint ck_politica_followup_versao check (versao > 0),
        constraint ck_politica_followup_etapas check (jsonb_typeof(etapas) = 'array' and jsonb_array_length(etapas) <= 30)
      );
      create unique index ux_politicas_followup_padrao on politicas_followup_agenda (tenant_id) where consulta_id is null;
      create unique index ux_politicas_followup_consulta on politicas_followup_agenda (tenant_id, consulta_id) where consulta_id is not null;
      create table ocorrencias_followup_agenda (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        consulta_id uuid not null,
        politica_id uuid not null,
        inicio_consulta_em timestamptz not null,
        indice integer not null,
        condicao varchar(40) not null,
        envio_em timestamptz not null,
        disponivel_em timestamptz not null,
        status varchar(24) not null default 'pendente',
        politica_versao integer not null,
        chave_idempotencia varchar(200) not null,
        mensagem_id uuid,
        motivo varchar(80),
        reivindicado_em timestamptz,
        tentativas integer not null default 0,
        criado_em timestamptz not null default now(),
        constraint fk_ocorrencia_followup_consulta foreign key (tenant_id, consulta_id)
          references agenda_consultas (tenant_id, id) on delete cascade,
        constraint ck_ocorrencia_followup_indice check (indice >= 0 and indice < 30),
        constraint ck_ocorrencia_followup_status check (status in ('pendente','processando','enfileirada','enviada','suprimida','falhou')),
        constraint ux_ocorrencia_followup_chave unique (tenant_id, chave_idempotencia),
        constraint ux_ocorrencia_followup_instante unique (tenant_id, consulta_id, inicio_consulta_em, envio_em)
      );
      create index idx_ocorrencia_followup_vencimento on ocorrencias_followup_agenda (tenant_id, status, disponivel_em);
      create index idx_ocorrencia_followup_consulta on ocorrencias_followup_agenda (tenant_id, consulta_id, criado_em);
      alter table politicas_followup_agenda enable row level security;
      alter table politicas_followup_agenda force row level security;
      create policy isolamento_tenant_politicas_followup_agenda on politicas_followup_agenda
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      alter table ocorrencias_followup_agenda enable row level security;
      alter table ocorrencias_followup_agenda force row level security;
      create policy isolamento_tenant_ocorrencias_followup_agenda on ocorrencias_followup_agenda
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop table if exists ocorrencias_followup_agenda;
      drop table if exists politicas_followup_agenda;
      alter table agenda_consultas drop column if exists followup_versao;
      alter table agenda_consultas drop column if exists followup_politica_id;
      alter table outbox_eventos drop column if exists reivindicado_em;
      alter table mensagens_notificacao drop column if exists tentativa_externa_em;
      alter table agenda_consultas drop constraint if exists ux_agenda_consultas_tenant_id_id;
    `);
  }
}
