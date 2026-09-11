import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarStatusEntregaWhatsapp1720000001041 implements MigrationInterface {
  name = 'AdicionarStatusEntregaWhatsapp1720000001041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table mensagens_notificacao add column if not exists status_entrega_whatsapp varchar(20);
      alter table mensagens_notificacao add column if not exists status_entrega_atualizado_em timestamptz;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table mensagens_notificacao drop column if exists status_entrega_atualizado_em;
      alter table mensagens_notificacao drop column if exists status_entrega_whatsapp;
    `);
  }
}
