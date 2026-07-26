import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarAgendamentoPublico1720000001000 implements MigrationInterface {
  name = 'CriarAgendamentoPublico1720000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists agenda_links_publicos (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        token_hash varchar(128) not null,
        ativo boolean not null default true,
        duracao_minutos int not null default 30,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        unique (tenant_id, profissional_id)
      );

      create index if not exists idx_agenda_links_publicos_tenant_profissional
        on agenda_links_publicos (tenant_id, profissional_id);
      create unique index if not exists idx_agenda_links_publicos_token_hash
        on agenda_links_publicos (token_hash);

      create table if not exists agenda_solicitacoes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        inicio_em timestamptz not null,
        fim_em timestamptz not null,
        nome_criptografado bytea not null,
        contato_criptografado bytea not null,
        observacao_criptografada bytea,
        status varchar(32) not null default 'pendente',
        expira_em timestamptz not null,
        decidida_em timestamptz,
        decidida_por_usuario_id uuid references usuarios(id),
        paciente_id uuid references pacientes(id),
        consulta_id uuid references agenda_consultas(id),
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      );

      create index if not exists idx_agenda_solicitacoes_tenant_profissional_status_inicio
        on agenda_solicitacoes (tenant_id, profissional_id, status, inicio_em);
      create index if not exists idx_agenda_solicitacoes_tenant_status_expira
        on agenda_solicitacoes (tenant_id, status, expira_em);

      alter table agenda_links_publicos enable row level security;
      alter table agenda_links_publicos force row level security;
      alter table agenda_solicitacoes enable row level security;
      alter table agenda_solicitacoes force row level security;

      drop policy if exists isolamento_tenant_agenda_links_publicos on agenda_links_publicos;
      create policy isolamento_tenant_agenda_links_publicos
        on agenda_links_publicos
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      drop policy if exists isolamento_tenant_agenda_solicitacoes on agenda_solicitacoes;
      create policy isolamento_tenant_agenda_solicitacoes
        on agenda_solicitacoes
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists agenda_solicitacoes cascade`);
    await queryRunner.query(`drop table if exists agenda_links_publicos cascade`);
  }
}
