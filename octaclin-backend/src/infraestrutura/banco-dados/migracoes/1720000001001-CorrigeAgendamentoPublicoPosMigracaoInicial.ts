import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CorrigeAgendamentoPublicoPosMigracaoInicial1720000001001 implements MigrationInterface {
  name = 'CorrigeAgendamentoPublicoPosMigracaoInicial1720000001001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table agenda_links_publicos
        drop constraint if exists agenda_links_publicos_tenant_id_profissional_id_key;

      drop index if exists idx_agenda_links_publicos_tenant_profissional_ativo;

      create unique index if not exists idx_agenda_links_publicos_tenant_profissional_ativo
        on agenda_links_publicos (tenant_id, profissional_id)
        where ativo = true;

      do $$
      declare
        nome_constraint text;
      begin
        select con.conname
          into nome_constraint
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        where rel.relname = 'agenda_solicitacoes'
          and con.contype = 'c'
          and pg_get_constraintdef(con.oid) ilike '%status = ''pendente''%'
          and pg_get_constraintdef(con.oid) ilike '%status in (''aprovada'', ''recusada'', ''expirada'')%'
        limit 1;

        if nome_constraint is not null then
          execute format('alter table agenda_solicitacoes drop constraint %I', nome_constraint);
        end if;
      end $$;

      alter table agenda_solicitacoes
        add constraint chk_agenda_solicitacoes_estado
        check (
          (status = 'pendente' and paciente_id is null and consulta_id is null and decidida_em is null and decidida_por_usuario_id is null)
          or (status = 'processando' and paciente_id is null and consulta_id is null and decidida_em is not null and decidida_por_usuario_id is not null)
          or (status in ('aprovada', 'recusada', 'expirada'))
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table agenda_solicitacoes
        drop constraint if exists chk_agenda_solicitacoes_estado;

      alter table agenda_solicitacoes
        add constraint chk_agenda_solicitacoes_estado
        check (
          (status = 'pendente' and paciente_id is null and consulta_id is null and decidida_em is null and decidida_por_usuario_id is null)
          or (status in ('aprovada', 'recusada', 'expirada'))
        );

      drop index if exists idx_agenda_links_publicos_tenant_profissional_ativo;

      alter table agenda_links_publicos
        add constraint agenda_links_publicos_tenant_id_profissional_id_key unique (tenant_id, profissional_id);
    `);
  }
}
