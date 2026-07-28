import { QueryRunner } from 'typeorm';
import { CriarAlertasOcultosDashboardClinico1720000001004 } from './1720000001004-CriarAlertasOcultosDashboardClinico';

describe('CriarAlertasOcultosDashboardClinico1720000001004', () => {
  it('cria tabela tenant-aware com RLS forcada e unicidade individual', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migracao = new CriarAlertasOcultosDashboardClinico1720000001004();

    await migracao.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => comando as string).join('\n').toLowerCase();
    expect(sql).toContain('create table dashboard_alertas_ocultos');
    expect(sql).toContain('unique (tenant_id, usuario_id, alerta_id)');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql).toContain("current_setting('app.tenant_id', true)");
    expect(sql).toContain('with check');
  });

  it('remove somente a tabela do dashboard no rollback', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migracao = new CriarAlertasOcultosDashboardClinico1720000001004();

    await migracao.down({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/drop table if exists dashboard_alertas_ocultos/i)
    );
  });
});
