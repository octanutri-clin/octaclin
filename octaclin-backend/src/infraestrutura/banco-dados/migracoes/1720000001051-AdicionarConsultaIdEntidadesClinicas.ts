import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PB-24 (Fase 275): vinculo opcional entre evolucao, avaliacao antropometrica,
 * versao de conduta terapeutica e coleta de exame laboratorial com a consulta
 * de origem. Mesmo padrao ja usado em `documentos_emitidos.consulta_id` --
 * unica entidade do produto com esse vinculo antes desta fase: coluna
 * nullable, `references agenda_consultas(id)` sem FK composta por tenant. A
 * validacao de "mesmo tenant, mesmo paciente" fica na aplicacao, nao no
 * banco, pelo mesmo motivo do precedente.
 *
 * @aplicacao fora-de-banda
 */
export class AdicionarConsultaIdEntidadesClinicas1720000001051 implements MigrationInterface {
  name = 'AdicionarConsultaIdEntidadesClinicas1720000001051';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table evolucoes_clinicas
        add column if not exists consulta_id uuid references agenda_consultas(id);
      alter table avaliacoes_antropometricas
        add column if not exists consulta_id uuid references agenda_consultas(id);
      alter table condutas_terapeuticas_versoes
        add column if not exists consulta_id uuid references agenda_consultas(id);
      alter table coletas_exames_laboratoriais
        add column if not exists consulta_id uuid references agenda_consultas(id);

      create index if not exists idx_evolucoes_clinicas_consulta
        on evolucoes_clinicas (tenant_id, consulta_id)
        where consulta_id is not null;
      create index if not exists idx_avaliacoes_antropometricas_consulta
        on avaliacoes_antropometricas (tenant_id, consulta_id)
        where consulta_id is not null;
      create index if not exists idx_condutas_terapeuticas_versoes_consulta
        on condutas_terapeuticas_versoes (tenant_id, consulta_id)
        where consulta_id is not null;
      create index if not exists idx_coletas_exames_laboratoriais_consulta
        on coletas_exames_laboratoriais (tenant_id, consulta_id)
        where consulta_id is not null;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop index if exists idx_evolucoes_clinicas_consulta;
      drop index if exists idx_avaliacoes_antropometricas_consulta;
      drop index if exists idx_condutas_terapeuticas_versoes_consulta;
      drop index if exists idx_coletas_exames_laboratoriais_consulta;

      alter table evolucoes_clinicas drop column if exists consulta_id;
      alter table avaliacoes_antropometricas drop column if exists consulta_id;
      alter table condutas_terapeuticas_versoes drop column if exists consulta_id;
      alter table coletas_exames_laboratoriais drop column if exists consulta_id;
    `);
  }
}
