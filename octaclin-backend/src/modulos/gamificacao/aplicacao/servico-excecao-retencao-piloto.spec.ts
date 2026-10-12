import { ServicoExcecaoRetencaoPiloto } from './servico-excecao-retencao-piloto';
import { ServicoConfiguracaoPiloto } from './servico-configuracao-piloto';
import { ContextoGamificacaoPiloto } from './contexto-piloto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
describe('excecao legal de retencao317',()=>{
  it('profissional e paciente nao registram excecao administrativa',async()=>{
    const s=new ServicoExcecaoRetencaoPiloto({} as ServicoConfiguracaoPiloto,{} as ContextoGamificacaoPiloto);
    for(const papel of ['Patient','Professional'] as const) {
      const u:UsuarioAutenticado={tenantId:'sintetico',usuarioId:'sintetico',emailHash:'',papel,permissoes:[]};
      await expect(s.registrar(u.tenantId,u,'sintetico',{chave:'sintetica',versaoEsperada:1,holdAte:'2099-01-01T00:00:00.000Z',justificativa:'Sintetica',confirmacaoLegal:true})).rejects.toThrow();
    }
  });

  it('lista somente id, versao e prazos para o Client da propria clinica',async()=>{
    const selecionado={id:'10000000-0000-4000-8000-000000000001',versao:4,eliminarEm:'2099-01-01T00:00:00.000Z',holdAte:null,evidencia_criptografada:'nao deve sair'};
    const query=jest.fn().mockResolvedValue([selecionado]);
    const config={executarAdministrativo:async (_tenant:string,_u:UsuarioAutenticado,op:(m:unknown)=>Promise<unknown>)=>op({query})} as unknown as ServicoConfiguracaoPiloto;
    const s=new ServicoExcecaoRetencaoPiloto(config,{} as ContextoGamificacaoPiloto);
    const u:UsuarioAutenticado={tenantId:'10000000-0000-4000-8000-000000000010',usuarioId:'10000000-0000-4000-8000-000000000011',emailHash:'',papel:'Client',permissoes:['cliente.configuracoes.gerenciar']};
    const result=await s.listar(u) as {itens:Array<Record<string,unknown>>;temMais:boolean};
    expect(result).toEqual({itens:[{id:selecionado.id,versao:4,eliminarEm:selecionado.eliminarEm,holdAte:null}],temMais:false});
    expect(JSON.stringify(result)).not.toContain('evidencia_criptografada');
    expect(query.mock.calls[0][0]).not.toContain('evidencia_criptografada,');
  });

  it('rejeita cursor manipulado antes de consultar o tenant',async()=>{
    const executarAdministrativo=jest.fn();
    const abrirCursor=jest.fn(()=>{throw new Error('Cursor incorreto ou de outro tenant');});
    const s=new ServicoExcecaoRetencaoPiloto({executarAdministrativo} as unknown as ServicoConfiguracaoPiloto,{conteudo:{abrirCursor}} as unknown as ContextoGamificacaoPiloto);
    const u:UsuarioAutenticado={tenantId:'10000000-0000-4000-8000-000000000010',usuarioId:'10000000-0000-4000-8000-000000000011',emailHash:'',papel:'Client',permissoes:['cliente.configuracoes.gerenciar']};
    const cursor='cursor-sintetico';
    await expect(s.listar(u,cursor)).rejects.toThrow();
    expect(abrirCursor).toHaveBeenCalledWith(`retencao:${u.tenantId}`,cursor);
    expect(executarAdministrativo).not.toHaveBeenCalled();
  });

  it('limita a 100 itens e cifra o cursor com escopo do tenant',async()=>{
    const rows=Array.from({length:101},(_,index)=>({id:`10000000-0000-4000-8000-${String(index+100).padStart(12,'0')}`,versao:1,eliminarEm:`2099-01-${String((index%28)+1).padStart(2,'0')}T00:00:00.000Z`,holdAte:null,evidencia_criptografada:'sensivel'}));
    const query=jest.fn().mockResolvedValue(rows);
    const cursor=jest.fn(()=>'cursor-opaco-cifrado');
    const config={executarAdministrativo:async (_tenant:string,_u:UsuarioAutenticado,op:(m:unknown)=>Promise<unknown>)=>op({query})} as unknown as ServicoConfiguracaoPiloto;
    const u:UsuarioAutenticado={tenantId:'10000000-0000-4000-8000-000000000010',usuarioId:'10000000-0000-4000-8000-000000000011',emailHash:'',papel:'Client',permissoes:['cliente.configuracoes.gerenciar']};
    const s=new ServicoExcecaoRetencaoPiloto(config,{conteudo:{cursor}} as unknown as ContextoGamificacaoPiloto);
    const page=await s.listar(u) as {itens:Array<Record<string,unknown>>;temMais:boolean;proximoCursor:string};
    expect(page.itens).toHaveLength(100);expect(page.temMais).toBe(true);expect(page.proximoCursor).toBe('cursor-opaco-cifrado');
    expect(cursor).toHaveBeenCalledWith(`retencao:${u.tenantId}`,{eliminarEm:page.itens[99].eliminarEm,id:page.itens[99].id});
    expect(JSON.stringify(page)).not.toContain('sensivel');
  });
});
