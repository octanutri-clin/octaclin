import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class ConfigurarResumosNotificacoes1720000001065 implements MigrationInterface {
  name = 'ConfigurarResumosNotificacoes1720000001065';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table preferencias_notificacao_usuario (
        tenant_id uuid not null,
        usuario_id uuid not null,
        modo_formulario_respondido varchar(20),
        modo_tarefa_concluida varchar(20),
        modo_automacao_executada varchar(20),
        timezone varchar(80) not null default 'America/Sao_Paulo',
        email_resumo boolean not null default false,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint pk_preferencias_notificacao_usuario primary key (tenant_id, usuario_id),
        constraint fk_preferencias_notificacao_usuario
          foreign key (tenant_id, usuario_id) references usuarios (tenant_id, id) on delete cascade,
        constraint ck_preferencias_notificacao_usuario_timezone
          check (length(btrim(timezone)) between 1 and 80),
        constraint ck_preferencias_notificacao_usuario_formulario
          check (modo_formulario_respondido is null or modo_formulario_respondido in ('imediato', 'diario', 'semanal', 'silenciado')),
        constraint ck_preferencias_notificacao_usuario_tarefa
          check (modo_tarefa_concluida is null or modo_tarefa_concluida in ('imediato', 'diario', 'semanal', 'silenciado')),
        constraint ck_preferencias_notificacao_usuario_automacao
          check (modo_automacao_executada is null or modo_automacao_executada in ('imediato', 'diario', 'semanal', 'silenciado'))
      );

      create table resumos_notificacao_usuario (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null,
        usuario_id uuid not null,
        periodo_inicio_em timestamptz not null,
        periodo_fim_em timestamptz not null,
        gerado_em timestamptz not null default now(),
        lido_em timestamptz,
        contagens jsonb not null default '{}'::jsonb,
        contagens_email jsonb not null default '{}'::jsonb,
        estado_email varchar(20) not null default 'nao_solicitado',
        tentativa_email_em timestamptz,
        finalizado_email_em timestamptz,
        constraint uq_resumos_notificacao_tenant_usuario_id unique (tenant_id, usuario_id, id),
        constraint fk_resumos_notificacao_usuario
          foreign key (tenant_id, usuario_id) references usuarios (tenant_id, id) on delete cascade,
        constraint ck_resumos_notificacao_periodo check (periodo_fim_em >= periodo_inicio_em),
        constraint ck_resumos_notificacao_estado_email
          check (estado_email in ('nao_solicitado', 'pendente', 'reservado', 'enviado', 'incerto', 'falhou', 'cancelado')),
        constraint ck_resumos_notificacao_contagens
          check (
            jsonb_typeof(contagens) = 'object'
            and contagens - array['formulario_respondido', 'tarefa_concluida', 'automacao_executada']::text[] = '{}'::jsonb
            and coalesce(jsonb_typeof(contagens->'formulario_respondido') = 'number', true)
            and coalesce((contagens->>'formulario_respondido')::numeric >= 0, true)
            and coalesce(jsonb_typeof(contagens->'tarefa_concluida') = 'number', true)
            and coalesce((contagens->>'tarefa_concluida')::numeric >= 0, true)
            and coalesce(jsonb_typeof(contagens->'automacao_executada') = 'number', true)
            and coalesce((contagens->>'automacao_executada')::numeric >= 0, true)
            and jsonb_typeof(contagens_email) = 'object'
            and contagens_email - array['formulario_respondido', 'tarefa_concluida', 'automacao_executada']::text[] = '{}'::jsonb
            and coalesce(jsonb_typeof(contagens_email->'formulario_respondido') = 'number', true)
            and coalesce((contagens_email->>'formulario_respondido')::numeric >= 0, true)
            and coalesce(jsonb_typeof(contagens_email->'tarefa_concluida') = 'number', true)
            and coalesce((contagens_email->>'tarefa_concluida')::numeric >= 0, true)
            and coalesce(jsonb_typeof(contagens_email->'automacao_executada') = 'number', true)
            and coalesce((contagens_email->>'automacao_executada')::numeric >= 0, true)
          )
      );

      alter table notificacoes
        add column modo_entrega varchar(20) not null default 'imediato',
        add column timezone_resumo varchar(80),
        add column resumo_previsto_em timestamptz,
        add column email_resumo boolean not null default false,
        add column email_cancelado_em timestamptz,
        add column resumo_id uuid,
        add constraint ck_notificacoes_modo_entrega
          check (modo_entrega in ('imediato', 'diario', 'semanal', 'silenciado')),
        add constraint ck_notificacoes_tipos_obrigatorios_imediatos
          check (tipo not in ('mensagem_recebida', 'solicitacao_agendamento', 'falha_envio') or modo_entrega = 'imediato'),
        add constraint ck_notificacoes_vencimento_digest
          check (
            (modo_entrega in ('diario', 'semanal') and timezone_resumo is not null and resumo_previsto_em is not null)
            or (modo_entrega in ('imediato', 'silenciado') and timezone_resumo is null and resumo_previsto_em is null)
          ),
        add constraint ck_notificacoes_email_digest
          check (not email_resumo or modo_entrega in ('diario', 'semanal')),
        add constraint fk_notificacoes_resumo_usuario
          foreign key (tenant_id, usuario_id, resumo_id)
          references resumos_notificacao_usuario (tenant_id, usuario_id, id) on delete set null (resumo_id);

      create index idx_notificacoes_digest_pendente
        on notificacoes (tenant_id, usuario_id, resumo_previsto_em, criado_em, id)
        where modo_entrega in ('diario', 'semanal') and resumo_id is null;
      create index idx_resumos_notificacao_usuario_data
        on resumos_notificacao_usuario (tenant_id, usuario_id, gerado_em desc, id desc);
      create index idx_resumos_notificacao_email_pendente
        on resumos_notificacao_usuario (tenant_id, gerado_em, id)
        where estado_email = 'pendente';

      alter table preferencias_notificacao_usuario enable row level security;
      alter table preferencias_notificacao_usuario force row level security;
      create policy isolamento_tenant_preferencias_notificacao
        on preferencias_notificacao_usuario
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      alter table resumos_notificacao_usuario enable row level security;
      alter table resumos_notificacao_usuario force row level security;
      create policy isolamento_tenant_resumos_notificacao
        on resumos_notificacao_usuario
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('Rollback recusado: apagar preferencias e resumos exige decisao operacional deliberada.');
  }
}
