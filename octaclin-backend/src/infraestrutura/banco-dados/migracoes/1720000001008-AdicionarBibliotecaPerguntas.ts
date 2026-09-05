import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarBibliotecaPerguntas1720000001008 implements MigrationInterface {
  name = 'AdicionarBibliotecaPerguntas1720000001008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table perguntas
        add column if not exists chave_clinica varchar(120),
        add column if not exists visivel_biblioteca boolean not null default false;

      create index if not exists idx_perguntas_biblioteca
        on perguntas (tenant_id, categoria_id, ordem)
        where visivel_biblioteca = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop index if exists idx_perguntas_biblioteca;
      alter table perguntas
        drop column if exists visivel_biblioteca,
        drop column if exists chave_clinica;
    `);
  }
}
