import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoConcessoesPermissao } from '../aplicacao/servico-concessoes-permissao';
import { GuardaJwt } from './guarda-jwt';
import { ControladorConcessoesPermissao } from './controlador-concessoes-permissao';

/** HTTP/DTO/guards reais; só autenticação e serviço simulados. Banco/RLS em suíte própria. */
describe('Auth-2 HTTP administrativo',()=>{
  let app:INestApplication,url:string;
  const id='00000000-0000-4000-8000-000000000001';
  const conceder=jest.fn(async()=>({id})),revogar=jest.fn(async()=>({id})),listar=jest.fn(async()=>({itens:[],total:0,pagina:1,limite:25}));
  const dados={usuarioId:id,permissao:'restricoes.confirmar',motivo:'habilitacao_administrativa',confirmacaoDoisPassos:true};
  const headers=(papel='Professional')=>({'content-type':'application/json','x-identidade-sintetica':papel});
  beforeAll(async()=>{
    const modulo=await Test.createTestingModule({controllers:[ControladorConcessoesPermissao],providers:[
      {provide:ServicoConcessoesPermissao,useValue:{conceder,revogar,listar}},
      {provide:ServicoAuditoria,useValue:{registrar:async()=>undefined}}
    ]}).overrideGuard(GuardaJwt).useValue({canActivate(c:ExecutionContext){
      const r=c.switchToHttp().getRequest();const papel=r.headers['x-identidade-sintetica'];if(!papel)throw new UnauthorizedException();
      r.usuarioAutenticado={tenantId:id,usuarioId:id,papel,emailHash:'',permissoes:r.headers['x-sem-permissao']?[]:['console.acessar']};return true;
    }}).compile();
    app=modulo.createNestApplication({logger:false});app.useGlobalPipes(criarPipeValidacaoHttp());await app.listen(0,'127.0.0.1');
    url=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/auth/concessoes-permissao`;
  });
  afterAll(async()=>{await app?.close();});
  beforeEach(()=>{conceder.mockClear();revogar.mockClear();listar.mockClear();});
  it('exige sessão e papel nas três rotas',async()=>{
    for(const [path,method,body] of [['','POST',dados],[`/${id}/revogar`,'POST',{confirmacaoDoisPassos:true}],[`/usuarios/${id}`,'GET',undefined]] as const){
      expect((await fetch(url+path,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined})).status).toBe(401);
      for(const papel of ['Collaborator','Patient','Client']) expect((await fetch(url+path,{method,headers:headers(papel),body:body?JSON.stringify(body):undefined})).status).toBe(403);
    }
    expect(conceder).not.toHaveBeenCalled();expect(revogar).not.toHaveBeenCalled();expect(listar).not.toHaveBeenCalled();
  });
  it.each(['Professional','SuperAdmin'])('%s administra sem receber a capacidade clínica no JWT',async papel=>{
    const r=await fetch(url,{method:'POST',headers:headers(papel),body:JSON.stringify(dados)});
    expect(r.status).toBe(201);expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(conceder).toHaveBeenCalledWith(expect.objectContaining({tenantId:id,usuarioId:id,papel,permissoes:['console.acessar']}),expect.objectContaining(dados));
    expect((await fetch(`${url}/${id}/revogar`,{method:'POST',headers:headers(papel),body:JSON.stringify({confirmacaoDoisPassos:true})})).status).toBe(200);
    const h=await fetch(`${url}/usuarios/${id}?pagina=2&limite=10`,{headers:headers(papel)});expect(h.status).toBe(200);expect(h.headers.get('cache-control')).toBe('private, no-store');
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({tenantId:id}),id,2,10);
  });
  it('mantém o guard de permissão de acesso ao console',async()=>{
    expect((await fetch(url,{method:'POST',headers:{...headers(),'x-sem-permissao':'true'},body:JSON.stringify(dados)})).status).toBe(403);
    expect(conceder).not.toHaveBeenCalled();
  });
  it('DTO fechado rejeita campos extras, null, tipos e confirmação não estrita',async()=>{
    for(const payload of [{...dados,tenantId:id},{...dados,concedidaPor:id},{...dados,confirmacaoDoisPassos:false},{...dados,confirmacaoDoisPassos:'true'},{...dados,confirmacaoDoisPassos:undefined},{...dados,usuarioId:null},{...dados,permissao:'pacientes.gerenciar'},{...dados,motivo:'Texto clínico sintético'},{...dados,usuarioId:'invalido'}]) {
      expect((await fetch(url,{method:'POST',headers:headers(),body:JSON.stringify(payload)})).status).toBe(400);
    }
    expect(conceder).not.toHaveBeenCalled();
  });
  it('revogação valida UUID e DTO; listagem limita e rejeita parâmetros arbitrários',async()=>{
    for(const [path,payload] of [[`/invalido/revogar`,{confirmacaoDoisPassos:true}],[`/${id}/revogar`,{confirmacaoDoisPassos:false}],[`/${id}/revogar`,{confirmacaoDoisPassos:true,usuarioId:id}]] as const)
      expect((await fetch(url+path,{method:'POST',headers:headers(),body:JSON.stringify(payload)})).status).toBe(400);
    for(const path of ['/usuarios/invalido',`/usuarios/${id}?limite=51`,`/usuarios/${id}?pagina=0`,`/usuarios/${id}?pagina=1.5`,`/usuarios/${id}?tenantId=${id}`,`/usuarios/${id}?limite=NaN`])
      expect((await fetch(url+path,{headers:headers()})).status).toBe(400);
    expect(revogar).not.toHaveBeenCalled();expect(listar).not.toHaveBeenCalled();
  });
});
