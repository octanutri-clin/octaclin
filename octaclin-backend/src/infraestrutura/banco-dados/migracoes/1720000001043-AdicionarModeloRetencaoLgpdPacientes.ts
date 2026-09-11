import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 261, decisao de produto sobre exclusao/retencao LGPD: introduz o
 * modelo de status explicito exigido (`ACTIVE`, `ARCHIVED`, `RETENTION_HELD`,
 * `DELETION_PENDING`, `DELETED`) e os campos de rastreio de uma solicitacao
 * de eliminacao (`deletion_requested_at`, `retention_reason`,
 * `retention_until`, `legal_basis`, `deleted_at`).
 *
 * So aditiva: nenhuma linha existente muda de status (todas continuam
 * `ACTIVE`, o default), nenhum dado e apagado aqui. A logica de quando
 * transicionar para `RETENTION_HELD`/`DELETION_PENDING`/`DELETED` vive na
 * aplicacao (`ServicoLgpdRetencao`), nao nesta migration.
 *
 * Tabela `tombstones_exclusao_lgpd` nova: registra toda exclusao real
 * (`DELETED`) por tenant/tabela/registro, para que um restore de backup nao
 * ressuscite dado que ja foi legitimamente eliminado -- o processo de
 * restore precisa reaplicar as exclusoes cujo `excluido_em` for posterior ao
 * ponto no tempo do backup restaurado. Ver
 * RUNBOOK_BACKUP_RESTORE.md.
 *
 * @aplicacao fora-de-banda
 */
export class AdicionarModeloRetencaoLgpdPacientes1720000001043 implements MigrationInterface {
  name = 'AdicionarModeloRetencaoLgpdPacientes1720000001043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table pacientes
        add column if not exists status_ciclo_vida varchar(30) not null default 'ACTIVE',
        add column if not exists deletion_requested_at timestamptz,
        add column if not exists retention_reason varchar(60),
        add column if not exists retention_until timestamptz,
        add column if not exists legal_basis varchar(60),
        add column if not exists deleted_at timestamptz;

      alter table pacientes
        drop constraint if exists pacientes_status_ciclo_vida_check,
        add constraint pacientes_status_ciclo_vida_check
          check (status_ciclo_vida in ('ACTIVE', 'ARCHIVED', 'RETENTION_HELD', 'DELETION_PENDING', 'DELETED'));

      comment on column pacientes.status_ciclo_vida is
        'Modelo de ciclo de vida LGPD (Fase 261): ACTIVE, ARCHIVED (arquivadoEm legado), RETENTION_HELD (solicitacao de eliminacao recebida mas prontuario ainda dentro do prazo legal de guarda), DELETION_PENDING (elegivel para eliminacao real, aguardando execucao), DELETED (eliminado de verdade dos sistemas ativos).';
      comment on column pacientes.deletion_requested_at is
        'Quando o titular ou responsavel solicitou eliminacao de dados. Nulo enquanto nenhuma solicitacao existir.';
      comment on column pacientes.retention_reason is
        'Motivo pelo qual o dado nao pode ser eliminado agora (ex: prontuario_clinico_20_anos). Nulo fora de RETENTION_HELD.';
      comment on column pacientes.retention_until is
        'Ate quando a retencao se aplica. Preenchido junto com retention_reason.';
      comment on column pacientes.legal_basis is
        'Base legal LGPD que ampara reter ou eliminar (ex: cfm_conselho_federal_medicina, lgpd_art_16).';
      comment on column pacientes.deleted_at is
        'Quando a eliminacao real ocorreu. So preenchido em DELETED.';

      create table if not exists tombstones_exclusao_lgpd (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null,
        tabela varchar(80) not null,
        registro_id uuid not null,
        motivo varchar(60) not null,
        excluido_em timestamptz not null default now(),
        unique (tenant_id, tabela, registro_id)
      );

      comment on table tombstones_exclusao_lgpd is
        'Registro de toda exclusao real de dado por LGPD (Fase 261). Sobrevive independente do registro original: um restore de backup precisa reaplicar (excluir de novo) todo tombstone com excluido_em posterior ao ponto no tempo restaurado, para que dado legitimamente eliminado nao reapareca.';

      create index if not exists idx_tombstones_exclusao_lgpd_tenant_tabela
        on tombstones_exclusao_lgpd (tenant_id, tabela);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop table if exists tombstones_exclusao_lgpd;

      alter table pacientes
        drop constraint if exists pacientes_status_ciclo_vida_check,
        drop column if exists deleted_at,
        drop column if exists legal_basis,
        drop column if exists retention_until,
        drop column if exists retention_reason,
        drop column if exists deletion_requested_at,
        drop column if exists status_ciclo_vida;
    `);
  }
}
