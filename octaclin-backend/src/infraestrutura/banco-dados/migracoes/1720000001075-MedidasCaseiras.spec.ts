import * as contrato from './1720000001075-MedidasCaseiras';
describe('FOOD01 schema aditivo', () => {
    it('força RLS fail-closed, FKs e invariantes sem reescrever publicações', async () => {
        const Classe = (contrato as any).MedidasCaseiras1720000001075;
        expect(typeof Classe).toBe('function');
        const query = jest.fn(async () => []);
        await new Classe().up({ query });
        const sql = query.mock.calls.map((args: any[]) => args[0]).join('\n').toLowerCase();
        for (const trecho of ['force row level security', "nullif(current_setting('app.tenant_id',true),'')::uuid", 'foreign key (tenant_id,profissional_id)', 'revisao > 0', 'unique (tenant_id,profissional_id,chave_idempotencia)', 'medidas_caseiras_snapshot_criptografado'])
            expect(sql).toContain(trecho);
        expect(sql).not.toMatch(/update\s+plano_alimentar/);
        await expect(new Classe().down({ query })).rejects.toThrow(/preserve/i);
    });
});
