import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sessoes de usuario como fonte compartilhada de verdade da revogacao.
 *
 * Uma sessao e a familia de refresh tokens criada por um login. Ela existe como
 * linha propria, e nao como agrupamento derivado de `refresh_tokens`, por dois
 * motivos: revogar a familia inteira passa a ser uma escrita em uma linha, e o
 * guarda de access token precisa de uma leitura indexada por chave primaria em
 * vez de um agregado a cada requisicao.
 *
 * A migracao e aditiva. `refresh_tokens` ganha `sessao_id` e `consumido_em`
 * anulaveis: as linhas ja gravadas permanecem intactas e expiram pelo proprio
 * `expira_em`. `familia_token` continua existindo e passa a receber o mesmo
 * valor de `sessao_id`; remover uma coluna `not null` em uso seria destrutivo e
 * esta fora do escopo deste PR.
 *
 * Nenhum material sensivel entra na tabela: sem token, sem hash, sem IP e sem
 * user-agent bruto.
 *
 * @aplicacao fora-de-banda
 */
export class CriarSessoesUsuario1720000001036 implements MigrationInterface {
  name = 'CriarSessoesUsuario1720000001036';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists sessoes_usuario (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null,
        criado_em timestamptz not null default now(),
        ultima_atividade_em timestamptz not null default now(),
        expira_em timestamptz not null,
        revogado_em timestamptz,
        motivo_revogacao varchar(40),
        constraint ux_sessoes_usuario_tenant_id unique (tenant_id, id),
        constraint fk_sessoes_usuario_usuario
          foreign key (tenant_id, usuario_id) references usuarios (tenant_id, id) on delete cascade,
        constraint sessoes_usuario_motivo_revogacao_check check (
          motivo_revogacao is null
          or motivo_revogacao in ('logout', 'encerrada_pelo_usuario', 'encerrada_outras', 'reuso_detectado', 'senha_redefinida')
        ),
        constraint sessoes_usuario_revogacao_coerente_check check (
          (revogado_em is null and motivo_revogacao is null)
          or (revogado_em is not null and motivo_revogacao is not null)
        )
      );
    `);

    await queryRunner.query(`
      create index if not exists idx_sessoes_usuario_ativas
        on sessoes_usuario (tenant_id, usuario_id, revogado_em, expira_em desc);
    `);

    await queryRunner.query('alter table sessoes_usuario enable row level security;');
    await queryRunner.query('alter table sessoes_usuario force row level security;');
    await queryRunner.query(`
      drop policy if exists isolamento_tenant_sessoes_usuario on sessoes_usuario;
      create policy isolamento_tenant_sessoes_usuario on sessoes_usuario
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);

    await queryRunner.query('alter table refresh_tokens add column if not exists sessao_id uuid;');
    await queryRunner.query('alter table refresh_tokens add column if not exists consumido_em timestamptz;');
    await queryRunner.query('alter table refresh_tokens drop constraint if exists fk_refresh_tokens_sessao;');
    await queryRunner.query(`
      alter table refresh_tokens add constraint fk_refresh_tokens_sessao
        foreign key (tenant_id, sessao_id) references sessoes_usuario (tenant_id, id) on delete cascade;
    `);

    await queryRunner.query(`
      create index if not exists idx_refresh_tokens_sessao
        on refresh_tokens (tenant_id, sessao_id, revogado_em, consumido_em);
    `);
    await queryRunner.query(`
      create index if not exists idx_refresh_tokens_ativos
        on refresh_tokens (tenant_id, usuario_id, token_hash)
        where revogado_em is null and consumido_em is null;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop index if exists idx_refresh_tokens_ativos;');
    await queryRunner.query('drop index if exists idx_refresh_tokens_sessao;');
    await queryRunner.query('alter table refresh_tokens drop constraint if exists fk_refresh_tokens_sessao;');
    await queryRunner.query('alter table refresh_tokens drop column if exists consumido_em;');
    await queryRunner.query('alter table refresh_tokens drop column if exists sessao_id;');
    await queryRunner.query('drop table if exists sessoes_usuario cascade;');
  }
}
