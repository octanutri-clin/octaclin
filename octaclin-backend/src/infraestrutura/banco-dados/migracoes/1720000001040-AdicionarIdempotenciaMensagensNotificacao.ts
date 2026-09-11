import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarIdempotenciaMensagensNotificacao1720000001040 implements MigrationInterface {
  name = 'AdicionarIdempotenciaMensagensNotificacao1720000001040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table mensagens_notificacao add column if not exists chave_idempotencia varchar(200);

      create unique index if not exists uq_mensagens_notificacao_tenant_chave_idempotencia
        on mensagens_notificacao (tenant_id, chave_idempotencia)
        where chave_idempotencia is not null;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop index if exists uq_mensagens_notificacao_tenant_chave_idempotencia;
      alter table mensagens_notificacao drop column if exists chave_idempotencia;
    `);
  }
}
