import { PreferenciasEquivalencia1720000001079 } from './1720000001079-PreferenciasEquivalencia';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
describe('FOOD05 preferências schema mínimo aditivo',()=>{
 it('acrescenta apenas configuração pessoal, valida JSON e preserva RLS/schema no rollback',async()=>{
  const query=jest.fn(async(_sql:string)=>[]);await new PreferenciasEquivalencia1720000001079().up({query} as any);
  const sql=query.mock.calls.flat().join('\n').toLowerCase();
  for(const f of ['alter table profissionais','preferencias_equivalencia jsonb','preferencias_equivalencia_revisao integer','not null default','jsonb_typeof','casasGramas','passoPorcaoGramas'])expect(sql).toContain(f.toLowerCase());
  expect(sql).not.toMatch(/create table|disable row level|no force|grant|drop|paciente|plano_alimentar|alter role/);
  await expect(new PreferenciasEquivalencia1720000001079().down({query} as any)).rejects.toThrow(/rollback recusado/i);
 });
 it('registra uma única vez, sem synchronize',()=>{const o=criarOpcoesTypeOrm();expect((o.migrations as any[]).filter(x=>x===PreferenciasEquivalencia1720000001079)).toHaveLength(1);expect(o.synchronize).toBe(false);});
});
