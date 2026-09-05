import { MigrationInterface, QueryRunner } from 'typeorm';

/** Metadados globais minimos para provisionamento idempotente e encerramento auditavel. *
 * @aplicacao fora-de-banda
 */
export class AdicionarCicloVidaTenants1720000001027 implements MigrationInterface {
  name = 'AdicionarCicloVidaTenants1720000001027';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table tenants
        add column if not exists provisionamento_referencia varchar(120),
        add column if not exists ciclo_vida_status varchar(40) not null default 'ativo',
        add column if not exists encerrado_em timestamptz;

      alter table tenants drop constraint if exists tenants_ciclo_vida_status_check;
      alter table tenants add constraint tenants_ciclo_vida_status_check check (
        ciclo_vida_status in (
          'ativo_assistido',
          'primeiro_uso_validado',
          'acompanhamento_48h',
          'ativo',
          'suspenso',
          'encerramento_pendente',
          'encerrado'
        )
      );

      create unique index if not exists uq_tenants_provisionamento_referencia
        on tenants (provisionamento_referencia)
        where provisionamento_referencia is not null;
      create index if not exists idx_tenants_ciclo_vida_status
        on tenants (ciclo_vida_status, atualizado_em desc);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop index if exists idx_tenants_ciclo_vida_status;
      drop index if exists uq_tenants_provisionamento_referencia;
      alter table tenants drop constraint if exists tenants_ciclo_vida_status_check;
      alter table tenants
        drop column if exists encerrado_em,
        drop column if exists ciclo_vida_status,
        drop column if exists provisionamento_referencia;
    `);
  }
}
