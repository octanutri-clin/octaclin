import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FOOD06 (revisão R4 da P2d-3a): uma conta de acesso pertence a no máximo UMA ficha de paciente por tenant.
 * `pacientes.usuario_id` não tinha unique; o portal resolve "a própria ficha" por essa coluna. O código já falha fechado
 * com duplicata; este índice torna a regra do banco. Índice parcial: fichas sem conta (`usuario_id` nulo) continuam livres.
 * Recusa aplicar se houver duplicata, sem expor identificadores (resolver antes; ver o runbook da FOOD06).
 * Aplicar fora de banda, com a role owner, depois da 1083 a 1085. `down` só remove o índice (nenhum dado é alterado).
 * @aplicacao fora-de-banda
 */
export class ContaUnicaPaciente1720000001086 implements MigrationInterface {
  name = 'ContaUnicaPaciente1720000001086';

  async up(q: QueryRunner): Promise<void> {
    if (!q.isTransactionActive) throw new Error('Migration recusada: execute em transacao.');
    // Sem filtro de RLS: a contagem precisa ver todos os tenants. Sem BYPASSRLS, o PostgreSQL falha em vez de filtrar.
    await q.query('set local row_security = off');
    await q.query('lock table pacientes in share row exclusive mode');
    const duplicadas: Array<{ existe: boolean }> = await q.query(`select exists(
      select 1 from pacientes where usuario_id is not null group by tenant_id, usuario_id having count(*) > 1) as existe`);
    if (duplicadas[0]?.existe !== false) {
      throw new Error('Migration recusada: ha contas de acesso ligadas a mais de uma ficha de paciente; resolver antes (runbook FOOD06).');
    }
    await q.query('create unique index ux_pacientes_conta_unica on pacientes (tenant_id, usuario_id) where usuario_id is not null');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('drop index if exists ux_pacientes_conta_unica');
  }
}
