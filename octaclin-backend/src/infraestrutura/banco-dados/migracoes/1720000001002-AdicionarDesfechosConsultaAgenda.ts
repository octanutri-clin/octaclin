import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarDesfechosConsultaAgenda1720000001002 implements MigrationInterface {
  name = 'AdicionarDesfechosConsultaAgenda1720000001002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table agenda_consultas
        drop constraint if exists chk_agenda_consultas_status;

      alter table agenda_consultas
        add constraint chk_agenda_consultas_status
        check (status in ('agendada', 'reagendada', 'concluida', 'falta', 'cancelada'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table agenda_consultas
        drop constraint if exists chk_agenda_consultas_status;

      update agenda_consultas
        set status = case
          when status = 'reagendada' then 'agendada'
          when status in ('concluida', 'falta') then 'cancelada'
          else status
        end
        where status in ('reagendada', 'concluida', 'falta');

      alter table agenda_consultas
        add constraint chk_agenda_consultas_status
        check (status in ('agendada', 'cancelada'));
    `);
  }
}
