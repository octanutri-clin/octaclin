import type { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda — desenvolvimento/provas somente em banco descartável. */
export class MetadadosReceitasNutricionais1720000001080 implements MigrationInterface {
  name = 'MetadadosReceitasNutricionais1720000001080';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`alter table receitas_nutricionais
      add column etiquetas_hashes text[] not null default '{}'::text[],
      add constraint ck_receitas_nutricionais_etiquetas_hashes check (
        cardinality(etiquetas_hashes) <= 10 and coalesce(array_ndims(etiquetas_hashes),1)=1
        and array_position(etiquetas_hashes,null) is null
      );
      create index idx_receitas_nutricionais_etiquetas on receitas_nutricionais using gin(etiquetas_hashes);`);
  }
  async down(_q: QueryRunner): Promise<void> {
    throw new Error('Rollback recusado: preservar histórico e schema aditivo; usar reader/writer compatível.');
  }
}
