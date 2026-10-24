import { GruposSubstituicoes1720000001078 } from './1720000001078-GruposSubstituicoes';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
describe('FOOD04 schema aditivo', () => {
  it('cria grupos/favoritos, integridade por tenant e FORCE RLS sem apagar planos', async () => {
    const query = jest.fn(async (_s: string) => []);
    await new GruposSubstituicoes1720000001078().up({ query } as any);
    const sql = query.mock.calls.flat().join('\n').toLowerCase();
    for (const table of ['grupos_substituicoes','favoritos_grupos_substituicoes']) {
      expect(sql).toContain(`create table ${table}`);
      expect(sql).toContain(`alter table ${table} force row level security`);
      expect(sql).toContain(`alter table ${table} enable row level security`);
    }
    for (const fragmento of ['foreign key (tenant_id, profissional_id)', 'foreign key (tenant_id, grupo_id)', 'unique (tenant_id,id)', "nullif(current_setting('app.tenant_id',true),'')", 'conteudo_criptografado bytea', "check (estado in ('ativo','arquivado'))"]) expect(sql).toContain(fragmento);
    expect(sql).not.toMatch(/paciente_id|delete cascade|drop table|update plano/);
    await expect(new GruposSubstituicoes1720000001078().down({ query } as any)).rejects.toThrow(/rollback recusado/i);
  });
  it('registra a migration uma vez sem habilitar synchronize', () => {
    const o = criarOpcoesTypeOrm();
    expect((o.migrations as any[]).filter(m => m === GruposSubstituicoes1720000001078)).toHaveLength(1);
    expect(o.synchronize).toBe(false);
  });
});
