import { DataSource } from 'typeorm';
import { ProcessadorRetencaoPiloto } from './processador-retencao-piloto';
import { ServicoRetencaoPiloto } from './servico-retencao-piloto';
describe('rodada de retencao317',()=>{
  it('inclui tenants inativos e isola erro sem registrar payload',async()=>{
    const find=jest.fn().mockResolvedValueOnce([{id:'tenant-a'},{id:'tenant-b'}]);
    const limparTenant=jest.fn().mockRejectedValueOnce(new Error('conteudo sensivel sintetico')).mockResolvedValueOnce(undefined);
    const p=new ProcessadorRetencaoPiloto({getRepository:()=>({find})} as unknown as DataSource,{limparTenant} as unknown as ServicoRetencaoPiloto);
    const aviso=jest.spyOn(p['logger'],'warn').mockImplementation(()=>{});
    await p.processar();
    expect(find).toHaveBeenCalledWith({select:{id:true},order:{id:'ASC'},take:100});
    expect(limparTenant).toHaveBeenCalledTimes(2);expect(aviso).toHaveBeenCalledWith('Falha na rodada de retencao da comunidade; nova tentativa na proxima rodada.');
    aviso.mockRestore();
  });
});
