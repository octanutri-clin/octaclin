import { CriarCalendarioFollowupsAgenda1720000001057 } from './1720000001057-CriarCalendarioFollowupsAgenda';

describe('migration do calendario de follow-ups', () => {
  it('isola politica e ocorrencias pelo tenant e vincula a consulta do mesmo tenant', async () => {
    const executar = jest.fn().mockResolvedValue(undefined);
    await new CriarCalendarioFollowupsAgenda1720000001057().up({ query: executar } as never);
    const sql = executar.mock.calls.map(([trecho]) => trecho).join('\n').toLowerCase();
    expect(sql).toContain('force row level security');
    expect(sql.match(/with check \(tenant_id =/g)).toHaveLength(2);
    expect(sql.match(/foreign key \(tenant_id, consulta_id\)/g)).toHaveLength(2);
    expect(sql).toContain('jsonb_array_length(etapas) <= 30');
    expect(sql).toContain('politica_id uuid not null');
    expect(sql).not.toContain('insert into');
  });
});
