import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CompartilharReceitasNutricionais1720000001066 implements MigrationInterface {
  name = 'CompartilharReceitasNutricionais1720000001066';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table receitas_nutricionais
        add column categoria varchar(80),
        add column versao_atual integer not null default 1,
        add constraint ck_receitas_nutricionais_categoria
          check (categoria is null or (length(btrim(categoria)) between 1 and 80)),
        add constraint ck_receitas_nutricionais_versao check (versao_atual > 0);
      create index idx_receitas_nutricionais_categoria
        on receitas_nutricionais (tenant_id, categoria, atualizado_em desc)
        where arquivado_em is null and categoria is not null;

      create table preferencias_compartilhamento_receita (
        tenant_id uuid not null,
        paciente_id uuid not null,
        email_ativo boolean not null default false,
        email_consentido_em timestamptz,
        email_revogado_em timestamptz,
        whatsapp_ativo boolean not null default false,
        whatsapp_consentido_em timestamptz,
        whatsapp_revogado_em timestamptz,
        push_ativo boolean not null default false,
        push_consentido_em timestamptz,
        push_revogado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint pk_preferencias_compartilhamento_receita primary key (tenant_id, paciente_id),
        constraint fk_preferencias_compartilhamento_receita_paciente
          foreign key (tenant_id, paciente_id) references pacientes (tenant_id, id) on delete cascade,
        constraint ck_preferencias_compartilhamento_receita_email
          check (not email_ativo or email_consentido_em is not null),
        constraint ck_preferencias_compartilhamento_receita_whatsapp
          check (not whatsapp_ativo or whatsapp_consentido_em is not null),
        constraint ck_preferencias_compartilhamento_receita_push
          check (not push_ativo or push_consentido_em is not null)
      );

      create table subscriptions_push_paciente (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null,
        paciente_id uuid not null,
        usuario_id uuid not null,
        endpoint_hash char(64) not null,
        endpoint_criptografado bytea not null,
        criada_em timestamptz not null default now(),
        usada_em timestamptz,
        revogada_em timestamptz,
        constraint uq_subscriptions_push_paciente_tenant_id unique (tenant_id, id),
        constraint fk_subscriptions_push_paciente_paciente
          foreign key (tenant_id, paciente_id) references pacientes (tenant_id, id) on delete cascade,
        constraint fk_subscriptions_push_paciente_usuario
          foreign key (tenant_id, usuario_id) references usuarios (tenant_id, id) on delete cascade
      );
      create unique index uq_subscriptions_push_paciente_endpoint_ativo
        on subscriptions_push_paciente (tenant_id, endpoint_hash) where revogada_em is null;
      create index idx_subscriptions_push_paciente_ativas
        on subscriptions_push_paciente (tenant_id, paciente_id, usuario_id, criada_em desc)
        where revogada_em is null;

      create table compartilhamentos_receita_nutricional (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null,
        receita_id uuid not null,
        idempotencia varchar(160) not null,
        paciente_id uuid not null,
        enviado_por_usuario_id uuid not null,
        versao_origem integer not null check (versao_origem > 0),
        snapshot_criptografado bytea not null check (octet_length(snapshot_criptografado) > 0),
        status varchar(20) not null check (status in ('agendado', 'ativo', 'substituido', 'retirado')),
        agendado_para timestamptz,
        enviado_em timestamptz,
        visualizado_em timestamptz,
        retirado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint uq_compartilhamentos_receita_tenant_id unique (tenant_id, id),
        constraint uq_compartilhamentos_receita_idempotencia unique (tenant_id, idempotencia),
        constraint fk_compartilhamentos_receita_receita
          foreign key (tenant_id, receita_id) references receitas_nutricionais (tenant_id, id) on delete restrict,
        constraint fk_compartilhamentos_receita_paciente
          foreign key (tenant_id, paciente_id) references pacientes (tenant_id, id) on delete restrict,
        constraint fk_compartilhamentos_receita_autor
          foreign key (tenant_id, enviado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict,
        constraint ck_compartilhamentos_receita_agendamento
          check ((status = 'agendado' and agendado_para is not null) or status <> 'agendado')
      );
      create unique index uq_compartilhamentos_receita_ativo
        on compartilhamentos_receita_nutricional (tenant_id, receita_id, paciente_id)
        where status = 'ativo';
      create index idx_compartilhamentos_receita_paciente
        on compartilhamentos_receita_nutricional (tenant_id, paciente_id, status, criado_em desc);
      create index idx_compartilhamentos_receita_agendados
        on compartilhamentos_receita_nutricional (tenant_id, agendado_para, id)
        where status = 'agendado';

      create table entregas_compartilhamento_receita (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null,
        compartilhamento_id uuid not null,
        canal varchar(20) not null check (canal in ('portal', 'email', 'whatsapp', 'push')),
        status varchar(20) not null default 'pendente'
          check (status in ('pendente', 'processando', 'enviado', 'incerto', 'falhou', 'cancelado', 'suprimido')),
        agendado_para timestamptz not null,
        iniciado_em timestamptz,
        confirmado_em timestamptz,
        erro_codigo varchar(48),
        idempotencia varchar(160) not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint uq_entregas_compartilhamento_receita_tenant_id unique (tenant_id, id),
        constraint uq_entregas_compartilhamento_receita_canal unique (tenant_id, compartilhamento_id, canal),
        constraint uq_entregas_compartilhamento_receita_idempotencia unique (tenant_id, idempotencia),
        constraint fk_entregas_compartilhamento_receita_compartilhamento
          foreign key (tenant_id, compartilhamento_id)
          references compartilhamentos_receita_nutricional (tenant_id, id) on delete restrict
      );
      create index idx_entregas_compartilhamento_receita_pendentes
        on entregas_compartilhamento_receita (tenant_id, agendado_para, id)
        where status = 'pendente';

      create function impedir_alteracao_snapshot_receita() returns trigger language plpgsql as $$
      begin
        if old.snapshot_criptografado is distinct from new.snapshot_criptografado then
          raise exception 'Snapshot de receita compartilhada e imutavel.';
        end if;
        return new;
      end;
      $$;
      create trigger trg_compartilhamento_receita_snapshot_imutavel
        before update of snapshot_criptografado on compartilhamentos_receita_nutricional
        for each row execute function impedir_alteracao_snapshot_receita();

      alter table preferencias_compartilhamento_receita enable row level security;
      alter table preferencias_compartilhamento_receita force row level security;
      create policy isolamento_tenant_preferencias_compartilhamento_receita
        on preferencias_compartilhamento_receita
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      alter table subscriptions_push_paciente enable row level security;
      alter table subscriptions_push_paciente force row level security;
      create policy isolamento_tenant_subscriptions_push_paciente
        on subscriptions_push_paciente
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      alter table compartilhamentos_receita_nutricional enable row level security;
      alter table compartilhamentos_receita_nutricional force row level security;
      create policy isolamento_tenant_compartilhamentos_receita
        on compartilhamentos_receita_nutricional
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      alter table entregas_compartilhamento_receita enable row level security;
      alter table entregas_compartilhamento_receita force row level security;
      create policy isolamento_tenant_entregas_compartilhamento_receita
        on entregas_compartilhamento_receita
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('Rollback recusado: compartilhamentos, snapshots e consentimentos clinicos exigem retencao aprovada.');
  }
}
