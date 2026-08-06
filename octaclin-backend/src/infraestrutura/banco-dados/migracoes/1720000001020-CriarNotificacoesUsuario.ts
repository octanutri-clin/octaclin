import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarNotificacoesUsuario1720000001020 implements MigrationInterface {
  name = 'CriarNotificacoesUsuario1720000001020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists notificacoes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null references usuarios(id),
        tipo varchar(40) not null,
        paciente_id uuid references pacientes(id),
        recurso_tipo varchar(40) not null,
        recurso_id uuid not null,
        lido_em timestamptz,
        criado_em timestamptz not null default now(),
        constraint notificacoes_tipo_check
          check (tipo in ('mensagem_recebida', 'solicitacao_agendamento', 'formulario_respondido', 'falha_envio'))
      );

      -- Webhook da Meta reentrega e o outbox reprocessa. Sem esta unicidade a
      -- mesma mensagem recebida contaria varias vezes no sino, que e pior do que
      -- nao contar: o usuario abre a inbox e nao encontra o que o contador diz.
      create unique index if not exists idx_notificacoes_evento
        on notificacoes (tenant_id, usuario_id, tipo, recurso_id);

      -- Indice parcial porque a consulta de nao lidas roda a cada poll de 5s por
      -- usuario logado; ela nao pode depender do tamanho historico da tabela.
      create index if not exists idx_notificacoes_nao_lidas
        on notificacoes (tenant_id, usuario_id, criado_em desc)
        where lido_em is null;

      create index if not exists idx_notificacoes_usuario
        on notificacoes (tenant_id, usuario_id, criado_em desc);

      alter table notificacoes enable row level security;
      alter table notificacoes force row level security;

      drop policy if exists isolamento_tenant_notificacoes on notificacoes;
      create policy isolamento_tenant_notificacoes
        on notificacoes
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop table if exists notificacoes cascade;
    `);
  }
}
