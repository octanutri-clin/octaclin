import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao somente-dados */
export class ForcaRenovacaoCanaisWatchSemToken1720000000902 implements MigrationInterface {
  name = 'ForcaRenovacaoCanaisWatchSemToken1720000000902';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      update profissionais_google_conexao pgc
      set canal_expira_em = now() - interval '1 day'
      from google_canais_watch gcw
      where gcw.canal_watch_id = pgc.canal_watch_id
        and gcw.token is null;
    `);
  }

  public async down(): Promise<void> {
    // Nao reversivel: nao ha como recuperar o canal_expira_em original apos a atualizacao forcada.
  }
}
