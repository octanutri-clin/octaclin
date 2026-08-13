import { CriarCondutasTerapeuticas1720000001026 } from './1720000001026-CriarCondutasTerapeuticas';

describe('CriarCondutasTerapeuticas1720000001026', () => {
  it('cria condutas e versoes aditivas com RLS forcada e uma versao publicada por conduta', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarCondutasTerapeuticas1720000001026().up({ query } as never);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('create table if not exists condutas_terapeuticas');
    expect(sql).toContain('create table if not exists condutas_terapeuticas_versoes');
    expect(sql).toContain('uq_condutas_terapeuticas_versao_publicada');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('isolamento_tenant_condutas_terapeuticas_versoes');
  });
});
