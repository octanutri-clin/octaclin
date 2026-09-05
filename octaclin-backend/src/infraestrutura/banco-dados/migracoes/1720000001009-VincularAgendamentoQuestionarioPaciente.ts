import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class VincularAgendamentoQuestionarioPaciente1720000001009 implements MigrationInterface {
  name = 'VincularAgendamentoQuestionarioPaciente1720000001009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table agendamentos_questionario
        add column if not exists paciente_id uuid;

      update agendamentos_questionario
        set ativo = false
        where paciente_id is null and ativo = true;

      create index if not exists idx_agendamentos_questionario_paciente_execucao
        on agendamentos_questionario (tenant_id, paciente_id, proxima_execucao_em)
        where ativo = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop index if exists idx_agendamentos_questionario_paciente_execucao;
      alter table agendamentos_questionario drop column if exists paciente_id;
    `);
  }
}
