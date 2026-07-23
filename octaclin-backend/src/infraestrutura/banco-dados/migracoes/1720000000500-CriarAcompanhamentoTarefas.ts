import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarAcompanhamentoTarefas1720000000500 implements MigrationInterface {
  name = 'CriarAcompanhamentoTarefas1720000000500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists acompanhamento_tarefas (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        profissional_id uuid not null references usuarios(id),
        titulo varchar(180) not null,
        descricao_criptografada bytea,
        categoria varchar(40) not null default 'tarefa',
        prioridade varchar(40) not null default 'media',
        status varchar(40) not null default 'pendente',
        vencimento_em timestamptz,
        concluido_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      );

      create index if not exists idx_acompanhamento_tarefas_tenant_paciente on acompanhamento_tarefas (tenant_id, paciente_id, status, vencimento_em);
      create index if not exists idx_acompanhamento_tarefas_tenant_profissional on acompanhamento_tarefas (tenant_id, profissional_id, criado_em desc);

      alter table acompanhamento_tarefas enable row level security;
      alter table acompanhamento_tarefas force row level security;

      drop policy if exists isolamento_tenant_acompanhamento_tarefas on acompanhamento_tarefas;
      create policy isolamento_tenant_acompanhamento_tarefas
        on acompanhamento_tarefas
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists acompanhamento_tarefas cascade`);
  }
}
