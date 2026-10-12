import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { AddressInfo } from 'net';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { ControladorConsolePiloto, ControladorPortalPiloto } from './controladores-piloto';
import { ServicoConquistasPiloto } from '../aplicacao/servico-conquistas-piloto';
import { ServicoCirculosPiloto } from '../aplicacao/servico-circulos-piloto';
import { ServicoPublicacoesPiloto } from '../aplicacao/servico-publicacoes-piloto';
import { ServicoModeracaoPiloto } from '../aplicacao/servico-moderacao-piloto';

/** Real HTTP/validation/role guards; authentication and services simulated. RLS proven separately. */
describe('HTTP piloto317 com identidade sintetica',()=>{
  let app:INestApplication,url:string;
  const id='00000000-0000-4000-8000-000000000000';
  const publicar=jest.fn(async()=>({id,versao:1,estado:'publicado'}));
  beforeAll(async()=>{
    const module=await Test.createTestingModule({controllers:[ControladorConsolePiloto,ControladorPortalPiloto],providers:[
      {provide:ServicoConquistasPiloto,useValue:{}},{provide:ServicoCirculosPiloto,useValue:{listar:async()=>({itens:[],temMais:false})}},
      {provide:ServicoPublicacoesPiloto,useValue:{publicar}},{provide:ServicoModeracaoPiloto,useValue:{}},{provide:ServicoAuditoria,useValue:{registrar:async()=>undefined}}
    ]}).overrideGuard(GuardaJwt).useValue({canActivate(c:ExecutionContext){
      const r=c.switchToHttp().getRequest();const papel=r.headers['x-identidade-sintetica'];
      if(!papel) throw new UnauthorizedException();
      r.usuarioAutenticado={tenantId:id,usuarioId:id,papel,permissoes:papel==='Professional' ? ['gamificacao.gerenciar','pacientes.gerenciar'] : [],emailHash:''};return true;
    }}).compile();
    app=module.createNestApplication();app.useGlobalPipes(criarPipeValidacaoHttp());await app.listen(0,'127.0.0.1');url=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async()=>{await app?.close();});
  it('retorna401 sem identidade e403 para papel errado em ambos os fluxos',async()=>{
    expect((await fetch(`${url}/portal/paciente/gamificacao-piloto/circulos`)).status).toBe(401);
    expect((await fetch(`${url}/portal/paciente/gamificacao-piloto/circulos`,{headers:{'x-identidade-sintetica':'Professional'}})).status).toBe(403);
    expect((await fetch(`${url}/gamificacao/piloto/circulos`,{headers:{'x-identidade-sintetica':'Patient'}})).status).toBe(403);
  });
  it('validacao real rejeita campo de autoria e UUID malformado antes do servico',async()=>{
    publicar.mockClear();
    const options={method:'POST',headers:{'content-type':'application/json','x-identidade-sintetica':'Patient'},body:JSON.stringify({chave:id,versaoEsperada:0,texto:'Sintetico',pacienteId:id})};
    expect((await fetch(`${url}/portal/paciente/gamificacao-piloto/circulos/${id}/publicacoes`,options)).status).toBe(400);
    expect((await fetch(`${url}/portal/paciente/gamificacao-piloto/circulos/invalido/publicacoes`,{...options,body:JSON.stringify({chave:id,versaoEsperada:0,texto:'Sintetico'})})).status).toBe(400);
    expect(publicar).not.toHaveBeenCalled();
  });
  it('sucesso usa tenant/autor autenticados e resposta sem cache',async()=>{
    const response=await fetch(`${url}/portal/paciente/gamificacao-piloto/circulos/${id}/publicacoes`,{method:'POST',headers:{'content-type':'application/json','x-identidade-sintetica':'Patient'},body:JSON.stringify({chave:id,versaoEsperada:0,texto:'Sintetico'})});
    expect(response.status).toBe(201);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(await response.json()).toEqual({id,versao:1,estado:'publicado'});
    expect(publicar).toHaveBeenCalledWith(expect.objectContaining({tenantId:id,usuarioId:id,papel:'Patient'}),id,expect.objectContaining({texto:'Sintetico'}));
  });
});
