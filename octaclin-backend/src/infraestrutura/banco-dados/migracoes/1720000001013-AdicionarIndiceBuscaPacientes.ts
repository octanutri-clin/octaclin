import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarIndiceBuscaPacientes1720000001013 implements MigrationInterface {
  name = 'AdicionarIndiceBuscaPacientes1720000001013';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pacientes
      ADD COLUMN IF NOT EXISTS busca_hashes text[] NOT NULL DEFAULT ARRAY[]::text[]
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pacientes_busca_hashes
      ON pacientes USING GIN (busca_hashes)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_pacientes_busca_hashes');
    await queryRunner.query('ALTER TABLE pacientes DROP COLUMN IF EXISTS busca_hashes');
  }
}
