import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda
 * Snapshot aditivo por versão; nenhuma publicação ou preferência é ativada. */
export class ApresentacaoPlanos1720000001072 implements MigrationInterface {
  name = 'ApresentacaoPlanos1720000001072';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`alter table plano_alimentar_versoes
      add column apresentacao_snapshot_criptografado bytea null,
      add column apresentacao_revisao integer not null default 0,
      add constraint ck_plano_apresentacao_revisao check (apresentacao_revisao >= 0)`);
  }
  async down(_q: QueryRunner): Promise<void> {
    throw new Error('Rollback recusado: preserve os snapshots de apresentação; reverta o código mantendo o schema aditivo.');
  }
}
