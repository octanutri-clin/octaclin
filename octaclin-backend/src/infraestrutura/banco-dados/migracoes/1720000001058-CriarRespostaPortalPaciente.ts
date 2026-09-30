import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriarRespostaPortalPaciente1720000001058 implements MigrationInterface {
  name = 'CriarRespostaPortalPaciente1720000001058';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table conversas_portal_paciente (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null,
        profissional_responsavel_id uuid,
        status varchar(32) not null default 'aguardando_clinica'
          check (status in ('aguardando_clinica', 'aguardando_paciente', 'encerrada')),
        ultima_mensagem_em timestamptz not null,
        prazo_resposta_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint uq_conversas_portal_paciente_tenant_id unique (tenant_id, id),
        constraint fk_conversas_portal_paciente_paciente
          foreign key (tenant_id, paciente_id) references pacientes(tenant_id, id) on delete restrict,
        constraint fk_conversas_portal_paciente_profissional
          foreign key (tenant_id, profissional_responsavel_id) references profissionais(tenant_id, id) on delete restrict,
        constraint uq_conversas_portal_paciente_titular unique (tenant_id, paciente_id)
      );
      create index idx_conversas_portal_paciente_fila
        on conversas_portal_paciente (tenant_id, status, prazo_resposta_em, ultima_mensagem_em desc);
      create index idx_conversas_portal_paciente_profissional
        on conversas_portal_paciente (tenant_id, profissional_responsavel_id, status, ultima_mensagem_em desc);

      create table mensagens_portal_paciente (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        conversa_id uuid not null,
        autor_usuario_id uuid not null,
        autor_tipo varchar(16) not null check (autor_tipo in ('paciente', 'equipe')),
        conteudo_criptografado bytea not null check (octet_length(conteudo_criptografado) > 0),
        criado_em timestamptz not null default now(),
        constraint fk_mensagens_portal_paciente_conversa
          foreign key (tenant_id, conversa_id) references conversas_portal_paciente(tenant_id, id) on delete cascade,
        constraint fk_mensagens_portal_paciente_autor
          foreign key (tenant_id, autor_usuario_id) references usuarios(tenant_id, id) on delete restrict
      );
      create index idx_mensagens_portal_conversa_data
        on mensagens_portal_paciente (tenant_id, conversa_id, criado_em, id);
      create index idx_mensagens_portal_paciente_rate_limit
        on mensagens_portal_paciente (tenant_id, conversa_id, autor_usuario_id, criado_em)
        where autor_tipo = 'paciente';

      alter table conversas_portal_paciente enable row level security;
      alter table conversas_portal_paciente force row level security;
      create policy tenant_isolation_conversas_portal_paciente on conversas_portal_paciente
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      alter table mensagens_portal_paciente enable row level security;
      alter table mensagens_portal_paciente force row level security;
      create policy tenant_isolation_mensagens_portal_paciente on mensagens_portal_paciente
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('set row_security = off');
    let mensagens: Array<{ total: string }>;
    try {
      mensagens = await queryRunner.query(
        'select count(*)::text as total from mensagens_portal_paciente'
      ) as Array<{ total: string }>;
    } catch (erro) {
      try {
        await queryRunner.query('reset row_security');
      } catch {
        // Se a transação foi abortada pelo PostgreSQL, o rollback restaura o SET LOCAL/estado da sessão.
      }
      throw erro;
    }
    await queryRunner.query('reset row_security');
    if (Number(mensagens[0]?.total ?? 0) > 0) {
      throw new Error('Rollback bloqueado: conversas clínicas persistidas exigem procedimento de retenção aprovado.');
    }
    await queryRunner.query('drop table if exists mensagens_portal_paciente');
    await queryRunner.query('drop table if exists conversas_portal_paciente');
  }
}
