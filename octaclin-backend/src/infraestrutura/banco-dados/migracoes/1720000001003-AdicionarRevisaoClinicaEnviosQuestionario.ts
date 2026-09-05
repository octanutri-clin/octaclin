import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarRevisaoClinicaEnviosQuestionario1720000001003 implements MigrationInterface {
  name = 'AdicionarRevisaoClinicaEnviosQuestionario1720000001003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table envios_questionario
        add column revisado_em timestamptz,
        add column revisado_por_usuario_id uuid references usuarios(id);

      create index idx_envios_questionario_revisao_pendente
        on envios_questionario (tenant_id, status, revisado_em);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop index if exists idx_envios_questionario_revisao_pendente;

      alter table envios_questionario
        drop column if exists revisado_por_usuario_id,
        drop column if exists revisado_em;
    `);
  }
}
