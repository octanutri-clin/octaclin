import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarTarefaConcluidaNotificacoes1720000001039 implements MigrationInterface {
  name = 'AdicionarTarefaConcluidaNotificacoes1720000001039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table notificacoes drop constraint if exists notificacoes_tipo_check;
      alter table notificacoes add constraint notificacoes_tipo_check
        check (tipo in ('mensagem_recebida', 'solicitacao_agendamento', 'formulario_respondido', 'falha_envio', 'tarefa_concluida'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table notificacoes drop constraint if exists notificacoes_tipo_check;
      alter table notificacoes add constraint notificacoes_tipo_check
        check (tipo in ('mensagem_recebida', 'solicitacao_agendamento', 'formulario_respondido', 'falha_envio'));
    `);
  }
}
