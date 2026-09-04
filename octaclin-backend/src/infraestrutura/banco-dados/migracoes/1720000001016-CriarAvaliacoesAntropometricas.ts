import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriarAvaliacoesAntropometricas1720000001016 implements MigrationInterface {
  name = 'CriarAvaliacoesAntropometricas1720000001016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists avaliacoes_antropometricas (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        autor_usuario_id uuid not null references usuarios(id),
        avaliada_em date not null,
        protocolo varchar(20) not null default 'nenhum',
        sexo varchar(20),
        idade_anos int,
        medidas_criptografadas bytea not null,
        resultado_criptografado bytea not null,
        formula_aplicada text,
        observacoes_criptografadas bytea,
        excluida_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint avaliacoes_antropometricas_protocolo_check
          check (protocolo in ('nenhum', 'pollock_3', 'pollock_7', 'faulkner', 'guedes')),
        constraint avaliacoes_antropometricas_sexo_check
          check (sexo is null or sexo in ('masculino', 'feminino')),
        constraint avaliacoes_antropometricas_idade_check
          check (idade_anos is null or (idade_anos >= 0 and idade_anos <= 120))
      );

      -- Serie temporal por paciente: e como a curva e a comparacao entre datas leem.
      create index if not exists idx_avaliacoes_antropometricas_serie
        on avaliacoes_antropometricas (tenant_id, paciente_id, avaliada_em desc)
        where excluida_em is null;

      alter table avaliacoes_antropometricas enable row level security;
      alter table avaliacoes_antropometricas force row level security;

      drop policy if exists isolamento_tenant_avaliacoes_antropometricas on avaliacoes_antropometricas;
      create policy isolamento_tenant_avaliacoes_antropometricas
        on avaliacoes_antropometricas
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists avaliacoes_antropometricas cascade`);
  }
}
