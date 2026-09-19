import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarAutomacaoExecutadaNotificacoes1720000001048 implements MigrationInterface {
  name = 'AdicionarAutomacaoExecutadaNotificacoes1720000001048';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table notificacoes drop constraint if exists notificacoes_tipo_check;
      alter table notificacoes add constraint notificacoes_tipo_check
        check (tipo in ('mensagem_recebida', 'solicitacao_agendamento', 'formulario_respondido', 'falha_envio', 'tarefa_concluida', 'automacao_executada'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      delete from notificacoes where tipo = 'automacao_executada';
      alter table notificacoes drop constraint if exists notificacoes_tipo_check;
      alter table notificacoes add constraint notificacoes_tipo_check
        check (tipo in ('mensagem_recebida', 'solicitacao_agendamento', 'formulario_respondido', 'falha_envio', 'tarefa_concluida'));
    `);
  }
}
