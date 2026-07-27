import { MigrationInterface, QueryRunner } from 'typeorm';

interface SobreposicaoAgendaAtiva {
  consulta_id: string;
  consulta_conflitante_id: string;
  tenant_id: string;
  profissional_id: string;
  total_conflitos: number | string;
}

export class AdicionarDesfechosConsultaAgenda1720000001002 implements MigrationInterface {
  name = 'AdicionarDesfechosConsultaAgenda1720000001002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const sobreposicoes = (await queryRunner.query(`
      select
        a.id as consulta_id,
        b.id as consulta_conflitante_id,
        a.tenant_id,
        a.profissional_id,
        count(*) over () as total_conflitos
      from agenda_consultas a
      inner join agenda_consultas b
        on b.tenant_id = a.tenant_id
        and b.profissional_id = a.profissional_id
        and b.id > a.id
        and b.inicio_em < a.fim_em
        and b.fim_em > a.inicio_em
      where a.profissional_id is not null
        and a.status in ('agendada', 'reagendada')
        and b.status in ('agendada', 'reagendada')
      order by a.tenant_id, a.profissional_id, a.inicio_em
      limit 10;
    `)) as SobreposicaoAgendaAtiva[];

    if (sobreposicoes.length > 0) {
      const total = Number(sobreposicoes[0].total_conflitos) || sobreposicoes.length;
      const exemplos = sobreposicoes
        .map((item) => `${item.consulta_id}/${item.consulta_conflitante_id}`)
        .join(', ');
      throw new Error(
        `Migracao de desfechos da agenda bloqueada: ${total} par(es) de consultas ativas com horario sobreposto. ` +
          `Consultas conflitantes (amostra): ${exemplos}. Resolva os conflitos manualmente antes de executar novamente; ` +
          'nenhuma consulta foi alterada.'
      );
    }

    await queryRunner.query(`
      alter table agenda_consultas
        drop constraint if exists chk_agenda_consultas_status;

      alter table agenda_consultas
        add constraint chk_agenda_consultas_status
        check (status in ('agendada', 'reagendada', 'concluida', 'falta', 'cancelada'));

      create extension if not exists btree_gist;

      alter table agenda_consultas
        add constraint ex_agenda_consultas_profissional_horario_ativo
        exclude using gist (
          tenant_id with =,
          profissional_id with =,
          tstzrange(inicio_em, fim_em, '[)') with &&
        )
        where (profissional_id is not null and status in ('agendada', 'reagendada'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table agenda_consultas
        drop constraint if exists ex_agenda_consultas_profissional_horario_ativo;

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
