import { EntityManager } from 'typeorm';
import { ConteudoPiloto, ContextoPiloto } from './contexto-piloto';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoCirculosPiloto } from './servico-circulos-piloto';
import { ContextoGamificacaoPiloto } from './contexto-piloto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
const paciente: UsuarioAutenticado={tenantId:'sintetico',usuarioId:'sintetico',papel:'Patient',emailHash:'',permissoes:[]};
describe('fronteira de circulos privados317',()=>{
  const base={executar:async()=>{throw new Error('Persistencia nao deve ser acessada');}} as unknown as ContextoGamificacaoPiloto;
  const servico=new ServicoCirculosPiloto(base);
  it('Patient nao cria circulo nem convida terceiros',async()=>{
    await expect(servico.criar(paciente,{chave:'00000000-0000-0000-0000-000000000000',versaoEsperada:0,nome:'Sintetico',objetivo:'Sintetico'})).rejects.toThrow('Acao exclusiva');
    await expect(servico.convidar(paciente,'circulo','outra-pessoa',{chave:'00000000-0000-0000-0000-000000000000',versaoEsperada:0})).rejects.toThrow('Acao exclusiva');
  });
  it('profissional nao aceita convite em nome do paciente',async()=>{
    await expect(servico.aceitar({...paciente,papel:'Professional'},'circulo',{chave:'00000000-0000-0000-0000-000000000000',versaoEsperada:1,geracao:1,termoVersao:'317-comunidade-v1',nomeExibicao:'Sintetico'})).rejects.toThrow('Acesso exclusivo');
  });
  it('nome cifrado adulterado nao participa da projecao e pode seguir para limpeza',async()=>{
    const codec=new ConteudoPiloto(new CriptografiaDadosSensiveis());
    const s=new ServicoCirculosPiloto({conteudo:codec} as ContextoGamificacaoPiloto);
    const m={query:async()=>[{id:'membro',paciente_id:'paciente',data_nascimento:'1990-01-01',nome_criptografado:Buffer.from('adulterado')}]} as unknown as EntityManager;
    const c:ContextoPiloto={m,u:paciente};
    expect(await s.perfis(c,{id:'circulo',profissional_id:'profissional',estado_piloto:'ativo',versao_piloto:1,snapshot_criptografado:Buffer.from('sintetico'),criado_texto:''})).toEqual(new Map());
  });

  it('participacoes para revogacao nao sao consultadas por administrador',async()=>{
    await expect(servico.listarParticipacoes({...paciente,papel:'SuperAdmin'},{})).rejects.toThrow('paciente');
  });

});
