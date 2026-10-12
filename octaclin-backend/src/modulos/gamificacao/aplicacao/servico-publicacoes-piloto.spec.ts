import { ServicoPublicacoesPiloto } from './servico-publicacoes-piloto';
import { ContextoGamificacaoPiloto } from './contexto-piloto';
import { ServicoCirculosPiloto } from './servico-circulos-piloto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
const u:UsuarioAutenticado={tenantId:'sintetico',usuarioId:'sintetico',papel:'Professional',emailHash:'',permissoes:['gamificacao.gerenciar','pacientes.gerenciar']};
describe('autoria da comunidade317',()=>{
  const base={executar:async()=>{throw new Error('Persistencia nao deve ser acessada');}} as unknown as ContextoGamificacaoPiloto;
  const servico=new ServicoPublicacoesPiloto(base,{} as ServicoCirculosPiloto);
  it('profissional nao publica nem comenta se passando por paciente',async()=>{
    await expect(servico.publicar(u,'circulo',{chave:'00000000-0000-0000-0000-000000000000',versaoEsperada:0,texto:'Sintetico'})).rejects.toThrow('Acesso exclusivo');
    await expect(servico.comentar(u,'circulo','post',{chave:'00000000-0000-0000-0000-000000000000',versaoEsperada:0,texto:'Sintetico'})).rejects.toThrow('Acesso exclusivo');
  });
  it('papel administrativo nao participa por outra pessoa',async()=>{
    await expect(servico.curtir({...u,papel:'SuperAdmin'},'circulo','post',undefined,{chave:'00000000-0000-0000-0000-000000000000',versaoEsperada:1,curti:true})).rejects.toThrow('Acesso exclusivo');
  });
  it('leituras passam pelo contexto autenticado antes de consultar conteudo',async()=>{
    await expect(servico.feed(u,'circulo',{})).rejects.toThrow('Persistencia nao deve ser acessada');
    await expect(servico.comentarios(u,'circulo','post',{})).rejects.toThrow('Persistencia nao deve ser acessada');
    await expect(servico.quemCurtiu(u,'circulo','post',undefined,{})).rejects.toThrow('Persistencia nao deve ser acessada');
  });

});
