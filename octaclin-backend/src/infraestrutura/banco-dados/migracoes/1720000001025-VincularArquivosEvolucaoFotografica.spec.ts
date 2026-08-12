import { VincularArquivosEvolucaoFotografica1720000001025 } from './1720000001025-VincularArquivosEvolucaoFotografica';

describe('VincularArquivosEvolucaoFotografica1720000001025', () => {
  it('cria somente vinculo aditivo com RLS forcada e unicidade de arquivo', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new VincularArquivosEvolucaoFotografica1720000001025().up({ query } as never);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('uq_evolucoes_fotograficas_tenant_id unique (tenant_id, id)');
    expect(sql).toContain('create table if not exists evolucoes_fotograficas_arquivos');
    expect(sql).toContain('unique (tenant_id, arquivo_midia_id)');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('isolamento_tenant_evolucoes_fotograficas_arquivos');
  });
});
