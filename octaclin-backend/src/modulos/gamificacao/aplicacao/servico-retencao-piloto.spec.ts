import { ServicoRetencaoPiloto } from './servico-retencao-piloto';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoCirculosPiloto } from './servico-circulos-piloto';
import { EntityManager } from 'typeorm';
describe('retencao317',()=>{
  it('executa sob tenant e lock sem depender da flag do piloto',async()=>{
    const query=jest.fn<Promise<unknown[]>,[string,unknown[]]>(async()=>[]),m={query} as unknown as EntityManager;
    const executor={executar:jest.fn(async (_id:string,op:(m:EntityManager)=>Promise<unknown>)=>op(m))} as unknown as ExecutorTenant;
    const s=new ServicoRetencaoPiloto(executor,{} as ServicoCirculosPiloto);
    await s.limparTenant('tenant-sintetico');
    expect(executor.executar).toHaveBeenCalledWith('tenant-sintetico',expect.any(Function));
    expect(query.mock.calls[0]).toEqual(['select pg_advisory_xact_lock(hashtextextended($1,0))',['gamificacao317:tenant-sintetico']]);
    expect(query.mock.calls.length).toBeGreaterThan(5);
  });
});
