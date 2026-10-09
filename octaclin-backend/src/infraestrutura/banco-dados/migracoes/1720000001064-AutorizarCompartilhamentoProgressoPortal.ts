import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AutorizarCompartilhamentoProgressoPortal1720000001064 implements MigrationInterface {
  name = 'AutorizarCompartilhamentoProgressoPortal1720000001064';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table avaliacoes_antropometricas
        add column metricas_compartilhadas_portal jsonb not null default '[]'::jsonb,
        add constraint chk_avaliacoes_metricas_compartilhadas_portal
          check (
            jsonb_typeof(metricas_compartilhadas_portal) = 'array'
            and metricas_compartilhadas_portal <@ '["imc", "percentualGordura", "massaMagraKg"]'::jsonb
          );

      alter table acompanhamento_tarefas
        add column exibir_no_progresso boolean not null default false,
        add constraint chk_acompanhamento_tarefa_progresso_categoria
          check (not exibir_no_progresso or categoria = 'meta');
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('Rollback recusado: remover as escolhas de compartilhamento exige avaliacao operacional deliberada.');
  }
}
