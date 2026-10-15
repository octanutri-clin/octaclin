import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda
 * Edição cifrada na versão existente; nenhuma publicação ou ativação implícita. */
export class EdicaoPlanos1720000001073 implements MigrationInterface {
  name = 'EdicaoPlanos1720000001073';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`alter table plano_alimentar_versoes
      add column rascunho_revisao integer not null default 0,
      add column edicao_protegida boolean not null default false,
      add column edicao_snapshot_criptografado bytea null,
      add column edicao_materializada_revisao integer null,
      add constraint ck_plano_rascunho_revisao check (rascunho_revisao >= 0),
      add constraint ck_plano_edicao_materializada check
        (edicao_materializada_revisao is null or
         edicao_materializada_revisao between 0 and rascunho_revisao)`);
  }
  async down(_q: QueryRunner): Promise<void> {
    throw new Error('Rollback recusado: preserve a edição clínica e a proteção de concorrência; use correção aditiva.');
  }
}
