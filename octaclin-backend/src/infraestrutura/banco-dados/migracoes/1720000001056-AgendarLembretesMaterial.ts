import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @aplicacao fora-de-banda
 * Aditiva, sem backfill: envios existentes nao recebem notificacao retroativa.
 */
export class AgendarLembretesMaterial1720000001056 implements MigrationInterface {
  name = 'AgendarLembretesMaterial1720000001056';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE envios_material_paciente ADD COLUMN IF NOT EXISTS proximo_lembrete_em timestamptz NULL'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_envios_material_paciente_proximo_lembrete ON envios_material_paciente (tenant_id, proximo_lembrete_em) WHERE proximo_lembrete_em IS NOT NULL'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_envios_material_paciente_proximo_lembrete');
    await queryRunner.query('ALTER TABLE envios_material_paciente DROP COLUMN IF EXISTS proximo_lembrete_em');
  }
}
