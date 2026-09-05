import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarTeleconsultaAgenda1720000001015 implements MigrationInterface {
  name = 'AdicionarTeleconsultaAgenda1720000001015';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE agenda_consultas
        ADD COLUMN IF NOT EXISTS modalidade varchar(20) NOT NULL DEFAULT 'presencial',
        ADD COLUMN IF NOT EXISTS link_teleconsulta text
    `);
    await queryRunner.query(`
      ALTER TABLE agenda_consultas
        DROP CONSTRAINT IF EXISTS agenda_consultas_modalidade_check,
        ADD CONSTRAINT agenda_consultas_modalidade_check CHECK (modalidade IN ('presencial', 'online'))
    `);
    await queryRunner.query(`
      ALTER TABLE agenda_consultas
        DROP CONSTRAINT IF EXISTS agenda_consultas_link_presencial_check,
        ADD CONSTRAINT agenda_consultas_link_presencial_check
          CHECK (modalidade = 'online' OR link_teleconsulta IS NULL)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE agenda_consultas
        DROP CONSTRAINT IF EXISTS agenda_consultas_link_presencial_check,
        DROP CONSTRAINT IF EXISTS agenda_consultas_modalidade_check,
        DROP COLUMN IF EXISTS link_teleconsulta,
        DROP COLUMN IF EXISTS modalidade
    `);
  }
}
