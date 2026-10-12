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
});
