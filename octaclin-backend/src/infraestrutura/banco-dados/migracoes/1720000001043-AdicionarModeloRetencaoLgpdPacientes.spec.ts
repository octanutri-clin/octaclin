import { QueryRunner } from 'typeorm';
import { AdicionarModeloRetencaoLgpdPacientes1720000001043 } from './1720000001043-AdicionarModeloRetencaoLgpdPacientes';

describe('AdicionarModeloRetencaoLgpdPacientes1720000001043', () => {
  async function executar() {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new AdicionarModeloRetencaoLgpdPacientes1720000001043();

    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    return { sqlUp, sqlDown };
  }

  it('adiciona status_ciclo_vida com default ACTIVE e os campos de rastreio da solicitacao', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain("add column if not exists status_ciclo_vida varchar(30) not null default 'ACTIVE'");
    expect(sqlUp).toContain('add column if not exists deletion_requested_at timestamptz');
    expect(sqlUp).toContain('add column if not exists retention_reason varchar(60)');
    expect(sqlUp).toContain('add column if not exists retention_until timestamptz');
    expect(sqlUp).toContain('add column if not exists legal_basis varchar(60)');
    expect(sqlUp).toContain('add column if not exists deleted_at timestamptz');
  });

  it('restringe status_ciclo_vida aos cinco valores do modelo', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toMatch(
      /check \(status_ciclo_vida in \('ACTIVE', 'ARCHIVED', 'RETENTION_HELD', 'DELETION_PENDING', 'DELETED'\)\)/
    );
  });

  it('cria a tabela de tombstones com unicidade por tenant/tabela/registro', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain('create table if not exists tombstones_exclusao_lgpd');
    expect(sqlUp).toContain('unique (tenant_id, tabela, registro_id)');
    expect(sqlUp).toContain('create index if not exists idx_tombstones_exclusao_lgpd_tenant_tabela');
  });

  it('e reversivel: down remove a tabela nova e as colunas novas de pacientes', async () => {
    const { sqlDown } = await executar();

    expect(sqlDown).toContain('drop table if exists tombstones_exclusao_lgpd');
    expect(sqlDown).toContain('drop constraint if exists pacientes_status_ciclo_vida_check');
    expect(sqlDown).toContain('drop column if exists deleted_at');
    expect(sqlDown).toContain('drop column if exists legal_basis');
    expect(sqlDown).toContain('drop column if exists retention_until');
    expect(sqlDown).toContain('drop column if exists retention_reason');
    expect(sqlDown).toContain('drop column if exists deletion_requested_at');
    expect(sqlDown).toContain('drop column if exists status_ciclo_vida');
  });
});
