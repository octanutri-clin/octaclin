import { TornarTrilhaAuditoriaImutavel1720000001038 } from './1720000001038-TornarTrilhaAuditoriaImutavel';

/**
 * Prova de DDL, nao prova de comportamento.
 *
 * A rejeicao real de `UPDATE`/`DELETE` so pode ser demonstrada contra Postgres,
 * e isso esta em `rls-isolamento-tenant.integracao.spec.ts`, que exige Docker e
 * fica SKIPPED na suite local. Este arquivo existe porque um gate que so roda
 * com Docker nao protege o dia a dia: aqui se afirma que a migration emite o
 * mecanismo esperado, e essa afirmacao roda em todo CI.
 */
describe('TornarTrilhaAuditoriaImutavel1720000001038', () => {
  async function coletarSqlDoUp(): Promise<string> {
    const consultas: string[] = [];
    await new TornarTrilhaAuditoriaImutavel1720000001038().up({
      query: jest.fn(async (sql: string) => consultas.push(sql))
    } as never);
    return consultas.join('\n').toLowerCase();
  }

  it('bloqueia update e delete por trigger de linha, e nao apenas por privilegio de role', async () => {
    const sql = await coletarSqlDoUp();

    expect(sql).toContain('create or replace function rejeitar_mutacao_trilha_auditoria()');
    expect(sql).toContain('before update or delete on user_action_logs');
    expect(sql).toContain('for each row execute function rejeitar_mutacao_trilha_auditoria()');
    expect(sql).toContain('raise exception');
    expect(sql).toContain("using errcode = '42501'");
  });

  it('mantem o trigger ativo em sessao de replicacao, onde um trigger comum seria ignorado', async () => {
    const sql = await coletarSqlDoUp();

    expect(sql).toContain('enable always trigger trg_trilha_auditoria_append_only');
    expect(sql).toContain('enable always trigger trg_trilha_auditoria_sem_truncate');
  });

  it('fecha o truncate, que trigger de linha nao enxerga', async () => {
    const sql = await coletarSqlDoUp();

    expect(sql).toContain('before truncate on user_action_logs');
    expect(sql).toContain('for each statement execute function rejeitar_mutacao_trilha_auditoria()');
  });

  it('preserva o insert, porque os dois caminhos de escrita da trilha so inserem', async () => {
    const sql = await coletarSqlDoUp();

    expect(sql).not.toContain('revoke insert');
    expect(sql).not.toContain('before insert on user_action_logs');
    expect(sql).not.toContain('insert or update');
  });

  it('revoga privilegio apenas onde a role existe, sem quebrar ambiente com outro nome', async () => {
    const sql = await coletarSqlDoUp();

    expect(sql).toContain('revoke update, delete, truncate on user_action_logs from public');
    expect(sql).toContain('select 1 from pg_roles where rolname = papel');
    expect(sql).toContain('revoke update, delete, truncate on user_action_logs from %i');
    expect(sql).toContain("'octaclin_runtime_integracao'");
    expect(sql).toContain("'octaclin_app_producao'");
  });

  it('rollback remove os triggers e devolve o grant anterior, sem tocar na tabela', async () => {
    const consultas: string[] = [];
    await new TornarTrilhaAuditoriaImutavel1720000001038().down({
      query: jest.fn(async (sql: string) => consultas.push(sql))
    } as never);

    const sql = consultas.join('\n').toLowerCase();
    expect(sql).toContain('drop trigger if exists trg_trilha_auditoria_append_only on user_action_logs');
    expect(sql).toContain('drop trigger if exists trg_trilha_auditoria_sem_truncate on user_action_logs');
    expect(sql).toContain('drop function if exists rejeitar_mutacao_trilha_auditoria()');
    expect(sql).toContain('grant update, delete on user_action_logs to %i');
    expect(sql).not.toContain('grant truncate');
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain('delete from user_action_logs');
  });
});
