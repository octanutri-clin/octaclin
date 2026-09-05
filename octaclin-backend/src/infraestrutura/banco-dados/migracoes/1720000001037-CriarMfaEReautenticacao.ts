import { MigrationInterface, QueryRunner } from 'typeorm';

/** Estruturas aditivas do MFA; nenhum segredo e persistido sem cifra autenticada. *
 * @aplicacao fora-de-banda
 */
export class CriarMfaEReautenticacao1720000001037 implements MigrationInterface {
  name = 'CriarMfaEReautenticacao1720000001037';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists mfa_fatores_usuario (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null,
        segredo_criptografado bytea,
        segredo_pendente_criptografado bytea,
        pendente_expira_em timestamptz,
        habilitado_em timestamptz,
        ultimo_contador_totp bigint,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_mfa_fatores_tenant_usuario unique (tenant_id, usuario_id),
        constraint fk_mfa_fatores_usuario foreign key (tenant_id, usuario_id)
          references usuarios (tenant_id, id) on delete cascade,
        constraint mfa_fator_ativo_coerente check (
          (habilitado_em is null and segredo_criptografado is null)
          or (habilitado_em is not null and segredo_criptografado is not null)
        ),
        constraint mfa_fator_pendente_coerente check (
          (segredo_pendente_criptografado is null and pendente_expira_em is null)
          or (segredo_pendente_criptografado is not null and pendente_expira_em is not null)
        )
      );
    `);
    await queryRunner.query(`
      create table if not exists mfa_codigos_recuperacao (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null,
        codigo_hash varchar(64) not null,
        usado_em timestamptz,
        criado_em timestamptz not null default now(),
        constraint fk_mfa_codigos_usuario foreign key (tenant_id, usuario_id)
          references usuarios (tenant_id, id) on delete cascade,
        constraint ux_mfa_codigo_usuario unique (tenant_id, usuario_id, codigo_hash)
      );
    `);
    await queryRunner.query(`
      create table if not exists mfa_desafios (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null,
        tipo varchar(32) not null check (tipo in ('login_verificar', 'login_configurar')),
        expira_em timestamptz not null,
        consumido_em timestamptz,
        criado_em timestamptz not null default now(),
        constraint fk_mfa_desafios_usuario foreign key (tenant_id, usuario_id)
          references usuarios (tenant_id, id) on delete cascade
      );
    `);
    await queryRunner.query(`alter table sessoes_usuario add column if not exists mfa_verificado_em timestamptz;`);
    await queryRunner.query(`
      alter table sessoes_usuario drop constraint if exists sessoes_usuario_motivo_revogacao_check;
      alter table sessoes_usuario add constraint sessoes_usuario_motivo_revogacao_check check (
        motivo_revogacao is null
        or motivo_revogacao in (
          'logout', 'encerrada_pelo_usuario', 'encerrada_outras',
          'reuso_detectado', 'senha_redefinida', 'mfa_obrigatorio'
        )
      );
    `);
    await queryRunner.query(`create index if not exists idx_mfa_desafios_validos on mfa_desafios (tenant_id, usuario_id, expira_em) where consumido_em is null;`);
    await queryRunner.query(`create index if not exists idx_mfa_codigos_disponiveis on mfa_codigos_recuperacao (tenant_id, usuario_id) where usado_em is null;`);

    for (const tabela of ['mfa_fatores_usuario', 'mfa_codigos_recuperacao', 'mfa_desafios']) {
      await queryRunner.query(`alter table ${tabela} enable row level security;`);
      await queryRunner.query(`alter table ${tabela} force row level security;`);
      await queryRunner.query(`
        drop policy if exists isolamento_tenant_${tabela} on ${tabela};
        create policy isolamento_tenant_${tabela} on ${tabela}
          using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
          with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists mfa_desafios;');
    await queryRunner.query('drop table if exists mfa_codigos_recuperacao;');
    await queryRunner.query('drop table if exists mfa_fatores_usuario;');
    await queryRunner.query('alter table sessoes_usuario drop column if exists mfa_verificado_em;');
    await queryRunner.query(`
      alter table sessoes_usuario drop constraint if exists sessoes_usuario_motivo_revogacao_check;
      alter table sessoes_usuario add constraint sessoes_usuario_motivo_revogacao_check check (
        motivo_revogacao is null
        or motivo_revogacao in (
          'logout', 'encerrada_pelo_usuario', 'encerrada_outras',
          'reuso_detectado', 'senha_redefinida'
        )
      );
    `);
  }
}
