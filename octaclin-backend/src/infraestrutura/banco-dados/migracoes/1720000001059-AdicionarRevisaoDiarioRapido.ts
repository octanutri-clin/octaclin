import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarRevisaoDiarioRapido1720000001059 implements MigrationInterface {
  name = 'AdicionarRevisaoDiarioRapido1720000001059';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table logs_diario_rapido add column if not exists revisado_em timestamptz;
      alter table logs_diario_rapido add column if not exists revisado_por_usuario_id uuid;
      alter table logs_diario_rapido
        add constraint ck_diario_rapido_revisao_par
        check ((revisado_em is null) = (revisado_por_usuario_id is null));
      create index if not exists idx_diario_rapido_revisao_tenant
        on logs_diario_rapido (tenant_id, registrado_em, id)
        where tipo = 'humor' and revisado_em is null;
      create index if not exists idx_acompanhamento_tarefas_lembrete_prazo
        on acompanhamento_tarefas (tenant_id, vencimento_em, id)
        where categoria = 'tarefa' and status in ('pendente', 'em_andamento') and vencimento_em is not null;
    `);
  }

  async down(): Promise<void> {
    throw new Error('Rollback bloqueado: carimbos de revisão clínica exigem decisão de retenção antes de remover colunas.');
  }
}
