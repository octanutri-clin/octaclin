import { ServicoConquistasPiloto } from './servico-conquistas-piloto';
import { ContextoGamificacaoPiloto } from './contexto-piloto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
describe('fronteira de conquistas317', () => {
  const paciente: UsuarioAutenticado = { tenantId:'sintetico',usuarioId:'sintetico',papel:'Patient',emailHash:'',permissoes:[] };
  const base = { executar: async () => { throw new Error('Nao deveria acessar persistencia'); } } as unknown as ContextoGamificacaoPiloto;
  const servico = new ServicoConquistasPiloto(base);
  it('Patient nao concede conquista em seu nome', async () => {
    await expect(servico.conceder(paciente,'00000000-0000-0000-0000-000000000000',{chave:'00000000-0000-0000-0000-000000000000',versaoEsperada:0,titulo:'Sintetica',icone:'award'})).rejects.toThrow('Acao exclusiva');
  });
  it('gestor e SuperAdmin nao compartilham por outra pessoa', async () => {
    for (const papel of ['Client','SuperAdmin','Collaborator'] as const) await expect(servico.compartilhar({...paciente,papel},'p','c',{chave:'00000000-0000-0000-0000-000000000000',versaoEsperada:1,compartilhado:true})).rejects.toThrow('Acao exclusiva');
  });
  it('lista de privacidade e exclusiva do proprio paciente',async()=>{
    await expect(servico.listarConsentimentos({...paciente,papel:'Client'},{})).rejects.toThrow('paciente');
  });

});
