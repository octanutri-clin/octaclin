import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarExamesEFotosClinicas1720000001024 implements MigrationInterface {
  name = 'CriarExamesEFotosClinicas1720000001024';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists coletas_exames_laboratoriais (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id) on delete restrict,
        autor_usuario_id uuid not null references usuarios(id), coletada_em date not null, recebida_em date,
        laboratorio_criptografado bytea, observacoes_criptografadas bytea, excluida_em timestamptz,
        criado_em timestamptz not null default now(), unique (tenant_id, id)
      );
      create table if not exists marcadores_exames_laboratoriais (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
        coleta_id uuid not null, resultado_criptografado bytea not null, ordem_exibicao int not null default 0,
        excluido_em timestamptz, criado_em timestamptz not null default now(),
        constraint fk_marcadores_exames_coleta foreign key (tenant_id, coleta_id)
          references coletas_exames_laboratoriais (tenant_id, id) on delete restrict
      );
      create table if not exists consentimentos_evolucao_fotografica (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id) on delete restrict,
        registrado_por_usuario_id uuid not null references usuarios(id), versao varchar(40) not null,
        consentido_em timestamptz not null, retencao_ate date not null, evidencia_criptografada bytea,
        revogado_em timestamptz, criado_em timestamptz not null default now(), unique (tenant_id, id)
      );
      create table if not exists evolucoes_fotograficas (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id) on delete restrict, consentimento_id uuid not null,
        autor_usuario_id uuid not null references usuarios(id), protocolo_criptografado bytea not null,
        capturada_em date not null, observacoes_criptografadas bytea, excluida_em timestamptz,
        criado_em timestamptz not null default now(),
        constraint fk_evolucoes_fotograficas_consentimento foreign key (tenant_id, consentimento_id)
          references consentimentos_evolucao_fotografica (tenant_id, id) on delete restrict
      );
      create index if not exists idx_coletas_exames_laboratoriais_serie on coletas_exames_laboratoriais (tenant_id, paciente_id, coletada_em desc);
      create index if not exists idx_marcadores_exames_laboratoriais_coleta on marcadores_exames_laboratoriais (tenant_id, coleta_id);
      create index if not exists idx_consentimentos_evolucao_fotografica_ativo on consentimentos_evolucao_fotografica (tenant_id, paciente_id, revogado_em);
      create index if not exists idx_evolucoes_fotograficas_serie on evolucoes_fotograficas (tenant_id, paciente_id, capturada_em desc);
      alter table coletas_exames_laboratoriais enable row level security; alter table coletas_exames_laboratoriais force row level security;
      alter table marcadores_exames_laboratoriais enable row level security; alter table marcadores_exames_laboratoriais force row level security;
      alter table consentimentos_evolucao_fotografica enable row level security; alter table consentimentos_evolucao_fotografica force row level security;
      alter table evolucoes_fotograficas enable row level security; alter table evolucoes_fotograficas force row level security;
      drop policy if exists isolamento_tenant_coletas_exames on coletas_exames_laboratoriais;
      drop policy if exists isolamento_tenant_marcadores_exames on marcadores_exames_laboratoriais;
      drop policy if exists isolamento_tenant_consentimentos_fotos on consentimentos_evolucao_fotografica;
      drop policy if exists isolamento_tenant_evolucoes_fotos on evolucoes_fotograficas;
      create policy isolamento_tenant_coletas_exames on coletas_exames_laboratoriais using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      create policy isolamento_tenant_marcadores_exames on marcadores_exames_laboratoriais using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      create policy isolamento_tenant_consentimentos_fotos on consentimentos_evolucao_fotografica using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      create policy isolamento_tenant_evolucoes_fotos on evolucoes_fotograficas using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists evolucoes_fotograficas cascade; drop table if exists consentimentos_evolucao_fotografica cascade; drop table if exists marcadores_exames_laboratoriais cascade; drop table if exists coletas_exames_laboratoriais cascade;');
  }
}
