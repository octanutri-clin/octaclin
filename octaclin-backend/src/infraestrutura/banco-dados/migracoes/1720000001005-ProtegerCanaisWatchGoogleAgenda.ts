import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProtegerCanaisWatchGoogleAgenda1720000001005 implements MigrationInterface {
  name = 'ProtegerCanaisWatchGoogleAgenda1720000001005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      update profissionais_google_conexao
      set canal_expira_em = now() - interval '1 second'
      where canal_watch_id is not null
        and canal_watch_id not like 'octaclin-gcal:%';

      alter table google_canais_watch enable row level security;
      alter table google_canais_watch force row level security;

      drop policy if exists isolamento_tenant_google_canais_watch on google_canais_watch;
      create policy isolamento_tenant_google_canais_watch
        on google_canais_watch
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop policy if exists isolamento_tenant_google_canais_watch on google_canais_watch;`);
    await queryRunner.query(`alter table google_canais_watch no force row level security;`);
    await queryRunner.query(`alter table google_canais_watch disable row level security;`);
  }
}
