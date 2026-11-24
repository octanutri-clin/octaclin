import type { MigrationInterface, QueryRunner } from 'typeorm';
/**
 * Index-only migration; owner execution after an authorized rehearsal.
 * @aplicacao fora-de-banda
 */
export class IndicesConsultaRespostasQuestionario1720000001087 implements MigrationInterface {
  name = 'IndicesConsultaRespostasQuestionario1720000001087';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE INDEX idx_qst_respostas_pagina ON respostas_checkin (tenant_id,finalizado_em DESC NULLS LAST,id DESC) INCLUDE (paciente_id,envio_questionario_id)`);
    await q.query(`CREATE INDEX idx_qst_envios_respondidos ON envios_questionario (tenant_id,questionario_id,id) INCLUDE (paciente_id) WHERE status='respondido'`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX IF EXISTS idx_qst_envios_respondidos');
    await q.query('DROP INDEX IF EXISTS idx_qst_respostas_pagina');
  }
}
