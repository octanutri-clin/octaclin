import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProtegerResolucaoAgendaPublica1720000001034 implements MigrationInterface {
  name = 'ProtegerResolucaoAgendaPublica1720000001034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create or replace function resolver_agenda_link_publico(p_token_hash char(64))
      returns table (tenant_id uuid, profissional_id uuid, duracao_minutos int)
      language sql
      stable
      security definer
      set search_path = public, pg_temp
      as $$
        select link.tenant_id, link.profissional_id, link.duracao_minutos
          from agenda_links_publicos link
         where link.token_hash = p_token_hash
           and link.ativo = true
         limit 1
      $$;

      revoke all on function resolver_agenda_link_publico(char(64)) from public;
      grant execute on function resolver_agenda_link_publico(char(64)) to public;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop function if exists resolver_agenda_link_publico(char(64))');
  }
}
