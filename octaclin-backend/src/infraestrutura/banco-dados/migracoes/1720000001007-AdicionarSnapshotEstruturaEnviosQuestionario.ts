import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarSnapshotEstruturaEnviosQuestionario1720000001007 implements MigrationInterface {
  name = 'AdicionarSnapshotEstruturaEnviosQuestionario1720000001007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table envios_questionario
        add column if not exists snapshot_estrutura jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table envios_questionario
        drop column if exists snapshot_estrutura;
    `);
  }
}
