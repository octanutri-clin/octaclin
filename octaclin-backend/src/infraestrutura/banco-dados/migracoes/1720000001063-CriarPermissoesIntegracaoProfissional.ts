import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda; concessoes de acesso sao estado de autorizacao. */
export class CriarPermissoesIntegracaoProfissional1720000001063 implements MigrationInterface {
  name = 'CriarPermissoesIntegracaoProfissional1720000001063';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists permissoes_integracao_profissional (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null,
        tipo varchar(16) not null,
        escopos_api text[] not null default array[]::text[],
        eventos_webhook text[] not null default array[]::text[],
        concedida_por_usuario_id uuid not null,
        concedida_em timestamptz not null default now(),
        revogada_por_usuario_id uuid,
        revogada_em timestamptz,
        constraint ck_permissoes_integracao_prof_tipo check (tipo in ('api', 'webhook')),
        constraint ck_permissoes_integracao_prof_conjunto check (
          (tipo = 'api'
            and cardinality(escopos_api) between 1 and 4
            and escopos_api <@ array['pacientes:ler','pacientes:escrever','agenda:ler','agenda:escrever']::text[]
            and cardinality(eventos_webhook) = 0)
          or
          (tipo = 'webhook'
            and cardinality(escopos_api) = 0
            and cardinality(eventos_webhook) between 1 and 4
            and eventos_webhook <@ array['paciente.criado','consulta.criada','consulta.cancelada','formulario.respondido']::text[])
        ),
        constraint ck_permissoes_integracao_prof_revogacao check (
          (revogada_em is null and revogada_por_usuario_id is null)
          or (revogada_em is not null and revogada_por_usuario_id is not null)
        ),
        constraint fk_permissoes_integracao_prof_usuario
          foreign key (tenant_id, usuario_id) references usuarios (tenant_id, id) on delete restrict,
        constraint fk_permissoes_integracao_prof_concedente
          foreign key (tenant_id, concedida_por_usuario_id) references usuarios (tenant_id, id) on delete restrict,
        constraint fk_permissoes_integracao_prof_revogador
          foreign key (tenant_id, revogada_por_usuario_id) references usuarios (tenant_id, id) on delete restrict
      );

      create unique index if not exists ux_permissoes_integracao_prof_ativas
        on permissoes_integracao_profissional (tenant_id, usuario_id, tipo)
        where revogada_em is null;
      create index if not exists idx_permissoes_integracao_prof_historico
        on permissoes_integracao_profissional (tenant_id, usuario_id, concedida_em desc);

      alter table permissoes_integracao_profissional enable row level security;
      alter table permissoes_integracao_profissional force row level security;
      drop policy if exists permissoes_integracao_prof_tenant on permissoes_integracao_profissional;
      create policy permissoes_integracao_prof_tenant on permissoes_integracao_profissional
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      alter table api_chaves add column if not exists profissional_usuario_id uuid;
      alter table webhook_assinaturas add column if not exists profissional_usuario_id uuid;
      alter table api_chaves
        add constraint fk_api_chaves_profissional_usuario
        foreign key (tenant_id, profissional_usuario_id)
        references usuarios (tenant_id, id) on delete restrict;
      alter table webhook_assinaturas
        add constraint fk_webhook_assinaturas_profissional_usuario
        foreign key (tenant_id, profissional_usuario_id)
        references usuarios (tenant_id, id) on delete restrict;
      create index if not exists idx_api_chaves_profissional_usuario
        on api_chaves (tenant_id, profissional_usuario_id)
        where profissional_usuario_id is not null;
      create index if not exists idx_webhook_assinaturas_profissional_usuario
        on webhook_assinaturas (tenant_id, profissional_usuario_id)
        where profissional_usuario_id is not null;
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('Rollback recusado: preserve o historico de autorizacoes e reverta o runtime para frente.');
  }
}
