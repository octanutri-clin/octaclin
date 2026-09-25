import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda; backfill separado, apos confirmar alvo e role owner. */
export class AdicionarIndicesPerfilPacientes1720000001055 implements MigrationInterface {
  name = 'AdicionarIndicesPerfilPacientes1720000001055';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS perfil_filtros_hashes text[] NOT NULL DEFAULT ARRAY[]::text[]`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pacientes_perfil_filtros_hashes ON pacientes USING GIN (perfil_filtros_hashes)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_pacientes_perfil_filtros_hashes');
    await queryRunner.query('ALTER TABLE pacientes DROP COLUMN IF EXISTS perfil_filtros_hashes');
  }
}
