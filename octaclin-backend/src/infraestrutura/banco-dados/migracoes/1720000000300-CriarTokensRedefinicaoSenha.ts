import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarTokensRedefinicaoSenha1720000000300 implements MigrationInterface {
  name = 'CriarTokensRedefinicaoSenha1720000000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists tokens_redefinicao_senha (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null references usuarios(id),
        email_hash varchar(128) not null,
        token_hash varchar(128) not null unique,
        status varchar(40) not null default 'pendente',
        expira_em timestamptz not null,
        usado_em timestamptz,
        revogado_em timestamptz,
        ip_solicitacao varchar(80),
        user_agent_solicitacao text,
        payload jsonb not null default '{}'::jsonb,
        criado_em timestamptz not null default now()
      );

      create index if not exists idx_tokens_redefinicao_tenant_usuario on tokens_redefinicao_senha (tenant_id, usuario_id, criado_em desc);
      create index if not exists idx_tokens_redefinicao_token_hash on tokens_redefinicao_senha (token_hash);
      create index if not exists idx_tokens_redefinicao_status on tokens_redefinicao_senha (tenant_id, status, expira_em);

      alter table tokens_redefinicao_senha enable row level security;
      alter table tokens_redefinicao_senha force row level security;

      drop policy if exists isolamento_tenant_tokens_redefinicao_senha on tokens_redefinicao_senha;
      create policy isolamento_tenant_tokens_redefinicao_senha
        on tokens_redefinicao_senha
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists tokens_redefinicao_senha cascade`);
  }
}
