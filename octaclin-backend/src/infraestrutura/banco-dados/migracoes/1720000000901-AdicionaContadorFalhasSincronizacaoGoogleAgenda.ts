import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionaContadorFalhasSincronizacaoGoogleAgenda1720000000901 implements MigrationInterface {
  name = 'AdicionaContadorFalhasSincronizacaoGoogleAgenda1720000000901';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table profissionais_google_conexao add column if not exists falhas_consecutivas_sincronizacao integer not null default 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table profissionais_google_conexao drop column if exists falhas_consecutivas_sincronizacao;`);
  }
}
