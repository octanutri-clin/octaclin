import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriptografarConteudoNotificacoes1720000001018 implements MigrationInterface {
  name = 'CriptografarConteudoNotificacoes1720000001018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table mensagens_notificacao
        add column if not exists conteudo_criptografado bytea;

      comment on column mensagens_notificacao.conteudo_criptografado is
        'Texto, assunto e nomes da mensagem. O payload em claro ao lado guarda so o que a infra roteia e consulta.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table mensagens_notificacao
        drop column if exists conteudo_criptografado;
    `);
  }
}
