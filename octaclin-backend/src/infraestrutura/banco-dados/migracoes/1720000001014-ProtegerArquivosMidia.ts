import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProtegerArquivosMidia1720000001014 implements MigrationInterface {
  name = 'ProtegerArquivosMidia1720000001014';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE arquivos_midia
        ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'pendente',
        ADD COLUMN IF NOT EXISTS categoria varchar(20) NOT NULL DEFAULT 'documento',
        ADD COLUMN IF NOT EXISTS nome_original_criptografado bytea,
        ADD COLUMN IF NOT EXISTS confirmado_em timestamptz,
        ADD COLUMN IF NOT EXISTS excluido_em timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE arquivos_midia
        DROP CONSTRAINT IF EXISTS arquivos_midia_status_check,
        ADD CONSTRAINT arquivos_midia_status_check CHECK (status IN ('pendente', 'confirmado', 'excluido')),
        DROP CONSTRAINT IF EXISTS arquivos_midia_categoria_check,
        ADD CONSTRAINT arquivos_midia_categoria_check CHECK (categoria IN ('exame', 'documento', 'foto', 'diario'))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_arquivos_midia_bucket_chave
      ON arquivos_midia (bucket, chave_objeto)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_arquivos_midia_bucket_chave');
    await queryRunner.query(`
      ALTER TABLE arquivos_midia
        DROP CONSTRAINT IF EXISTS arquivos_midia_categoria_check,
        DROP CONSTRAINT IF EXISTS arquivos_midia_status_check,
        DROP COLUMN IF EXISTS excluido_em,
        DROP COLUMN IF EXISTS confirmado_em,
        DROP COLUMN IF EXISTS nome_original_criptografado,
        DROP COLUMN IF EXISTS categoria,
        DROP COLUMN IF EXISTS status
    `);
  }
}
