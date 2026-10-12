import { ServicoModeracaoPiloto } from './servico-moderacao-piloto';
import { ContextoGamificacaoPiloto } from './contexto-piloto';
import { ServicoPublicacoesPiloto } from './servico-publicacoes-piloto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
const u:UsuarioAutenticado={tenantId:'sintetico',usuarioId:'sintetico',papel:'Patient',emailHash:'',permissoes:[]};
describe('papeis da moderacao317',()=>{
  const s=new ServicoModeracaoPiloto({} as ContextoGamificacaoPiloto,{} as ServicoPublicacoesPiloto);
  it('paciente nao acessa fila ou decide denuncias',async()=>{
    await expect(s.listar(u,'circulo',{})).rejects.toThrow('profissional');
    await expect(s.decidir(u,'circulo','denuncia',{chave:'sintetica',versaoEsperada:1,retirar:true,justificativa:'Sintetica'})).rejects.toThrow('profissional');
  });
  it('administrador nao denuncia em nome de paciente',async()=>{
    await expect(s.denunciar({...u,papel:'SuperAdmin'},'circulo','post',undefined,{chave:'sintetica',versaoEsperada:1,motivo:'Sintetico'})).rejects.toThrow('paciente');
  });
});
