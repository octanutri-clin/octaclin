import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarRevisaoHumanaIa1720000001011 implements MigrationInterface {
  name = 'AdicionarRevisaoHumanaIa1720000001011';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_sentiment_analysis
      ADD COLUMN IF NOT EXISTS revisao_humana jsonb NOT NULL DEFAULT '{"status":"pendente"}'::jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE food_recognition_cache
      ADD COLUMN IF NOT EXISTS revisao_humana jsonb NOT NULL DEFAULT '{"status":"pendente"}'::jsonb,
      ADD COLUMN IF NOT EXISTS limitacoes jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    await queryRunner.query(`ALTER TABLE regras_automacao ALTER COLUMN ativa SET DEFAULT false`);
    await queryRunner.query(`
      UPDATE regras_automacao regra
      SET ativa = false
      WHERE regra.ativa = true
        AND NOT EXISTS (
          SELECT 1 FROM execucoes_regra execucao
          WHERE execucao.regra_id = regra.id
            AND execucao.resultado @> '{"simulacao":true}'::jsonb
        )
    `);
    await queryRunner.query('DROP INDEX IF EXISTS idx_food_hash');
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_food_hash
      ON food_recognition_cache (tenant_id, paciente_id, provedor, imagem_hash)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_food_hash');
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_food_hash
      ON food_recognition_cache (tenant_id, provedor, imagem_hash)
    `);
    await queryRunner.query(`ALTER TABLE regras_automacao ALTER COLUMN ativa SET DEFAULT true`);
    await queryRunner.query('ALTER TABLE food_recognition_cache DROP COLUMN IF EXISTS limitacoes');
    await queryRunner.query('ALTER TABLE food_recognition_cache DROP COLUMN IF EXISTS revisao_humana');
    await queryRunner.query('ALTER TABLE ai_sentiment_analysis DROP COLUMN IF EXISTS revisao_humana');
  }
}
