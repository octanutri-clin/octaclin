import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PB-19 (Fase 277): agrupador de series de consulta recorrente (semanal ou
 * diaria, terminando por contagem de ocorrencias ou por data-fim). O dia da
 * semana da recorrencia semanal nao e armazenado: e sempre o dia da semana
 * de `inicio_primeira_ocorrencia`, para nao existir campo redundante que
 * possa divergir dele. `agenda_consultas` ganha um vinculo opcional com a
 * serie; sem nenhuma linha usando a coluna nova, o comportamento de criacao
 * de consulta continua identico ao atual.
 *
 * @aplicacao fora-de-banda
 */
export class CriarRecorrenciaConsulta1720000001053 implements MigrationInterface {
  name = 'CriarRecorrenciaConsulta1720000001053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists agenda_recorrencias (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        profissional_id uuid references profissionais(id),
        frequencia varchar(10) not null check (frequencia in ('diaria', 'semanal')),
        inicio_primeira_ocorrencia timestamptz not null,
        duracao_minutos int not null check (duracao_minutos > 0 and duracao_minutos <= 480),
        criterio_termino varchar(10) not null check (criterio_termino in ('contagem', 'data')),
        total_ocorrencias int,
        termina_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        check (
          (criterio_termino = 'contagem' and total_ocorrencias is not null and termina_em is null)
          or
          (criterio_termino = 'data' and termina_em is not null and total_ocorrencias is null)
        )
      );

      create index if not exists idx_agenda_recorrencias_tenant_paciente
        on agenda_recorrencias (tenant_id, paciente_id);

      alter table agenda_recorrencias enable row level security;
      alter table agenda_recorrencias force row level security;

      drop policy if exists isolamento_tenant_agenda_recorrencias on agenda_recorrencias;
      create policy isolamento_tenant_agenda_recorrencias
        on agenda_recorrencias
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

      alter table agenda_consultas
        add column if not exists recorrencia_id uuid references agenda_recorrencias(id);

      create index if not exists idx_agenda_consultas_recorrencia
        on agenda_consultas (tenant_id, recorrencia_id)
        where recorrencia_id is not null;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop index if exists idx_agenda_consultas_recorrencia;
      alter table agenda_consultas drop column if exists recorrencia_id;
      drop table if exists agenda_recorrencias cascade;
    `);
  }
}
