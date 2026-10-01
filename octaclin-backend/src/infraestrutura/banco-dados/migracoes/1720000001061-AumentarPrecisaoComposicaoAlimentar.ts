import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AumentarPrecisaoComposicaoAlimentar1720000001061 implements MigrationInterface {
  name = 'AumentarPrecisaoComposicaoAlimentar1720000001061';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table alimentos_composicao
        alter column energia_kcal type numeric(16,8) using energia_kcal::numeric(16,8),
        alter column proteinas_g type numeric(16,8) using proteinas_g::numeric(16,8),
        alter column carboidratos_g type numeric(16,8) using carboidratos_g::numeric(16,8),
        alter column lipidios_g type numeric(16,8) using lipidios_g::numeric(16,8),
        alter column fibras_g type numeric(16,8) using fibras_g::numeric(16,8),
        alter column sodio_mg type numeric(16,8) using sodio_mg::numeric(16,8)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      do $$
      begin
        if exists (
          select 1 from alimentos_composicao
          where energia_kcal is distinct from round(energia_kcal, 4)
             or proteinas_g is distinct from round(proteinas_g, 4)
             or carboidratos_g is distinct from round(carboidratos_g, 4)
             or lipidios_g is distinct from round(lipidios_g, 4)
             or fibras_g is distinct from round(fibras_g, 4)
             or sodio_mg is distinct from round(sodio_mg, 4)
        ) then
          raise exception 'Rollback recusado: há composição alimentar com precisão acima de quatro casas decimais.';
        end if;
      end;
      $$;
      alter table alimentos_composicao
        alter column energia_kcal type numeric(12,4) using energia_kcal::numeric(12,4),
        alter column proteinas_g type numeric(12,4) using proteinas_g::numeric(12,4),
        alter column carboidratos_g type numeric(12,4) using carboidratos_g::numeric(12,4),
        alter column lipidios_g type numeric(12,4) using lipidios_g::numeric(12,4),
        alter column fibras_g type numeric(12,4) using fibras_g::numeric(12,4),
        alter column sodio_mg type numeric(12,4) using sodio_mg::numeric(12,4)
    `);
  }
}
