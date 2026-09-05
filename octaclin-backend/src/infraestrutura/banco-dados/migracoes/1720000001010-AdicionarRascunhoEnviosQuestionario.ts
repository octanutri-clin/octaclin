import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarRascunhoEnviosQuestionario1720000001010 implements MigrationInterface {
  name = 'AdicionarRascunhoEnviosQuestionario1720000001010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table envios_questionario
        add column if not exists respostas_rascunho jsonb,
        add column if not exists rascunho_atualizado_em timestamptz,
        add column if not exists rascunho_versao integer not null default 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table envios_questionario
        drop column if exists rascunho_versao,
        drop column if exists rascunho_atualizado_em,
        drop column if exists respostas_rascunho;
    `);
  }
}
