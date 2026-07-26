import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionaTokenCanalWatchGoogleAgenda1720000000900 implements MigrationInterface {
  name = 'AdicionaTokenCanalWatchGoogleAgenda1720000000900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table google_canais_watch add column if not exists token varchar(120);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table google_canais_watch drop column if exists token;`);
  }
}
