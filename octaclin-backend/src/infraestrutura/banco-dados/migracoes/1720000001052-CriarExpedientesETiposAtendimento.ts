import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PB-18 (Fase 276): expediente semanal por profissional (dias e faixas de
 * horario, multiplas faixas por dia para cobrir intervalo de almoco) e
 * catalogo de tipos de atendimento por tenant, com duracao propria. Ambas as
 * tabelas nascem vazias: sem nenhuma linha cadastrada, o agendamento publico
 * continua identico ao comportamento atual (24/7). `agenda_links_publicos`
 * ganha um vinculo opcional com o tipo de atendimento escolhido ao rotacionar
 * o link; sem selecao, a duracao continua manual/herdada como hoje.
 *
 * @aplicacao fora-de-banda
 */
export class CriarExpedientesETiposAtendimento1720000001052 implements MigrationInterface {
  name = 'CriarExpedientesETiposAtendimento1720000001052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists tipos_atendimento (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        nome varchar(120) not null,
        duracao_minutos int not null check (duracao_minutos > 0 and duracao_minutos <= 480),
        ativo boolean not null default true,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      );

      create index if not exists idx_tipos_atendimento_tenant_ativo
        on tipos_atendimento (tenant_id, ativo);

      alter table tipos_atendimento enable row level security;
      alter table tipos_atendimento force row level security;

      drop policy if exists isolamento_tenant_tipos_atendimento on tipos_atendimento;
      create policy isolamento_tenant_tipos_atendimento
        on tipos_atendimento
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      create table if not exists expedientes_profissionais (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        dia_semana int not null check (dia_semana between 0 and 6),
        hora_inicio time not null,
        hora_fim time not null,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        check (hora_fim > hora_inicio)
      );

      create index if not exists idx_expedientes_profissionais_tenant_profissional
        on expedientes_profissionais (tenant_id, profissional_id, dia_semana);

      alter table expedientes_profissionais enable row level security;
      alter table expedientes_profissionais force row level security;

      drop policy if exists isolamento_tenant_expedientes_profissionais on expedientes_profissionais;
      create policy isolamento_tenant_expedientes_profissionais
        on expedientes_profissionais
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      alter table agenda_links_publicos
        add column if not exists tipo_atendimento_id uuid references tipos_atendimento(id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table agenda_links_publicos drop column if exists tipo_atendimento_id;
      drop table if exists expedientes_profissionais cascade;
      drop table if exists tipos_atendimento cascade;
    `);
  }
}
