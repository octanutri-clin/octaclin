import { AlimentosPersonalizados1720000001076 } from './1720000001076-AlimentosPersonalizados';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
describe('FOOD02 schema aditivo', () => {
  it('isola biblioteca e generaliza medidas sem alterar catálogo ou fatos', async () => {
    const query = jest.fn(async (_s: string) => []);
    await new AlimentosPersonalizados1720000001076().up({ query } as any);
    const sql = query.mock.calls.map(a => a[0]).join('\n').toLowerCase();
    for (const t of ['create table alimentos_personalizados', 'force row level security', "nullif(current_setting('app.tenant_id',true),'')::uuid", 'foreign key (tenant_id,profissional_id)', 'unique (tenant_id,id)', 'using gin (busca_hashes)', 'foreign key (tenant_id,alimento_personalizado_id)', '(alimento_composicao_id is null) <> (alimento_personalizado_id is null)', 'alimentos_personalizados_snapshot_criptografado']) expect(sql).toContain(t);
    expect(sql).not.toMatch(/(?:update|insert into|delete from)\s+(?:alimentos_composicao|plano_alimentar)/);
    await expect(new AlimentosPersonalizados1720000001076().down({ query } as any)).rejects.toThrow(/preserve/i);
  });
  it('registra exatamente uma migration e entidade sem sincronização automática', () => {
    const o = criarOpcoesTypeOrm();
    expect((o.migrations as any[]).filter(v => v.name === 'AlimentosPersonalizados1720000001076')).toHaveLength(1);
    expect((o.entities as any[]).filter(v => v.name === 'AlimentoPersonalizadoOrm')).toHaveLength(1);
    expect(o.synchronize).toBe(false);
  });
});
