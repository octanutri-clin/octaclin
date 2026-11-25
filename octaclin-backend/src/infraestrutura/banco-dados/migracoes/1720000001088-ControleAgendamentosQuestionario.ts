import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * QST10-09: controle editorial aditivo. Legados permanecem sem ator presumido.
 * Exclusão do ator remove somente sua referência; o worker deve falhar fechado.
 * Rollback permitido apenas antes de qualquer uso dos novos controles.
 * @aplicacao fora-de-banda
 */
export class ControleAgendamentosQuestionario1720000001088 implements MigrationInterface {
  name = 'ControleAgendamentosQuestionario1720000001088';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`alter table agendamentos_questionario
      add column revisao integer not null default 1,
      add column pausado_em timestamptz,
      add column autorizado_por_usuario_id uuid,
      add constraint ck_agendamento_revisao check (revisao >= 1),
      add constraint ck_agendamento_pausa check (not ativo or pausado_em is null),
      add constraint fk_agendamento_autorizador foreign key (tenant_id, autorizado_por_usuario_id)
        references usuarios(tenant_id, id) on delete set null (autorizado_por_usuario_id);`);
  }

  async down(q: QueryRunner): Promise<void> {
    if (!q.isTransactionActive) throw new Error('Rollback recusado: execute em transacao.');
    const iso: Array<{ transaction_isolation: string }> = await q.query('show transaction_isolation');
    if (iso[0]?.transaction_isolation !== 'read committed') throw new Error('Rollback recusado: exige READ COMMITTED.');
    await q.query('set local row_security = off');
    await q.query('lock table agendamentos_questionario in access exclusive mode');
    const rows: Array<{ existe: boolean }> = await q.query(`select exists(select 1 from agendamentos_questionario
      where revisao <> 1 or pausado_em is not null or autorizado_por_usuario_id is not null) as existe`);
    if (rows[0]?.existe !== false) throw new Error('Rollback recusado: preservar controles de agendamento.');
    await q.query(`alter table agendamentos_questionario
      drop constraint fk_agendamento_autorizador, drop constraint ck_agendamento_pausa,
      drop constraint ck_agendamento_revisao, drop column autorizado_por_usuario_id,
      drop column pausado_em, drop column revisao;`);
  }
}
