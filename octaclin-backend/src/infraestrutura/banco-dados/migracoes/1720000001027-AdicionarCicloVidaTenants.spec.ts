import { AdicionarCicloVidaTenants1720000001027 } from './1720000001027-AdicionarCicloVidaTenants';

describe('AdicionarCicloVidaTenants1720000001027', () => {
  it('adiciona referencia unica e estados explicitos de ciclo de vida', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new AdicionarCicloVidaTenants1720000001027().up({ query } as never);

    const sql = query.mock.calls.map(([comando]) => comando).join('\n');
    expect(sql).toContain('provisionamento_referencia');
    expect(sql).toContain('uq_tenants_provisionamento_referencia');
    expect(sql).toContain('encerramento_pendente');
    expect(sql).toContain('encerrado_em');
  });
});
