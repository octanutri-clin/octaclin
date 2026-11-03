import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ExecutionContext,UnauthorizedException,ForbiddenException,ConflictException,UnprocessableEntityException,type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { request as requisitarHttp } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { middlewareAnalisesFactuais,middlewareLimiteAnalisesFactuais,middlewareErroAnalisesFactuais } from '../../../infraestrutura/http/middleware-analises-factuais';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoRegistrosAnaliseFactual } from '../aplicacao/servico-registros-analise-factual';
import { ControladorRegistrosFactuais } from './controlador-registros-factuais';
const id=randomUUID(),outro=randomUUID(),data=new Date('2026-11-03T12:00:00.000Z');
const fonte={registro:{chaveIdempotencia:id,origem:{planoId:id,versaoId:outro,numero:1,status:'publicada'}},selecao:{ativacaoRevisaoEsperada:0,identidadesRefeicoes:[id]}};
/** HTTP/validation/role+permission guards reais; identidade e serviço simulados. PG separado. */
describe('API factual M05/M07',()=>{
 let app:NestExpressApplication,url:string;
 const registrarVersao=jest.fn(async()=>({id,criadoEm:data,segredo:'CANARIO'}));
 const listar=jest.fn(async()=>({itens:[{id,criadoEm:data,segredo:'CANARIO'}],total:1,pagina:1,limite:25,segredo:'CANARIO'}));
 const consultarApi=jest.fn(async()=>({schemaVersao:1,motorVersao:'food06-registro-api-v1'}));
 const compararApi=jest.fn(async()=>({schemaVersao:1,motorVersao:'food06-comparacao-api-v1'}));
 const prefixo=()=>`${url}/pacientes/${id}/planos-alimentares/analises-factuais`;
 const chamar=(sufixo:string,body:unknown,papel='Professional',perms='planos_alimentares.ler,planos_alimentares.gerenciar')=>fetch(prefixo()+sufixo,{method:'POST',headers:{'content-type':'application/json',...(papel?{'x-papel-sintetico':papel,'x-permissoes-sinteticas':perms}:{})},body:JSON.stringify(body)});
 beforeAll(async()=>{
  const module=await Test.createTestingModule({controllers:[ControladorRegistrosFactuais],providers:[{provide:ServicoRegistrosAnaliseFactual,useValue:{registrarVersao,listar,consultarApi,compararApi}},{provide:ServicoAuditoria,useValue:{registrar:async()=>undefined}}]})
   .overrideGuard(GuardaJwt).useValue({canActivate(c:ExecutionContext){const r=c.switchToHttp().getRequest();if(!r.headers['x-papel-sintetico'])throw new UnauthorizedException();r.usuarioAutenticado={tenantId:id,usuarioId:id,papel:r.headers['x-papel-sintetico'],permissoes:String(r.headers['x-permissoes-sinteticas']??'').split(','),emailHash:''};return true;}}).compile();
  app=module.createNestApplication<NestExpressApplication>({rawBody:true});app.useLogger(false);app.use(middlewareAnalisesFactuais);app.useBodyParser('json',{limit:'100kb'});app.use(middlewareErroAnalisesFactuais,middlewareLimiteAnalisesFactuais);app.useGlobalPipes(criarPipeValidacaoHttp());await app.listen(0,'127.0.0.1');url=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
 });
 afterAll(async()=>{await app?.close();});
 it('registro usa identidade autenticada e projeta metadados sem campos extras',async()=>{
  registrarVersao.mockClear();const r=await chamar('',fonte);expect(r.status).toBe(200);expect(await r.json()).toEqual({schemaVersao:1,registro:{id,criadoEm:data.toISOString()}});expect(r.headers.get('cache-control')).toBe('private, no-store');
  expect(registrarVersao.mock.calls).toEqual([[id,id,expect.objectContaining({usuarioId:id,tenantId:id}),fonte]]);
 });
 it('índice é paginado por corpo, mínimo e sem valores clínicos em query',async()=>{const r=await chamar('/listar',{pagina:1,limite:25});expect(r.status).toBe(200);expect(await r.json()).toEqual({schemaVersao:1,itens:[{id,criadoEm:data.toISOString()}],total:1,pagina:1,limite:25});});
 it('consulta/comparação chamam apenas métodos de projeção, nunca leitor bruto',async()=>{
  expect((await chamar('/consultar',{registroId:id})).status).toBe(200);expect((await chamar('/comparar',{antesId:id,depoisId:outro})).status).toBe(200);
 });
 it.each(['','SuperAdmin','Client','Collaborator','Patient'])('nega identidade/papel %s também sem cache',async papel=>{
  const r=await chamar('/listar',{pagina:1,limite:25},papel);expect(r.status).toBe(papel?403:401);expect(r.headers.get('cache-control')).toBe('private, no-store');
 });
 it('exige ler e gerenciar no registro; ler é suficiente nas consultas',async()=>{
  expect((await chamar('',fonte,'Professional','planos_alimentares.gerenciar')).status).toBe(403);
  expect((await chamar('',fonte,'Professional','planos_alimentares.ler')).status).toBe(403);
  expect((await chamar('/listar',{pagina:1,limite:25},'Professional','planos_alimentares.ler')).status).toBe(200);
 });
 it('nega campos extras/tipos/faixas/proveniência e não reflete o payload no erro',async()=>{
  for(const body of [{...fonte,tenantId:id},{...fonte,confirmacaoOrigem:'CANARIO'},{...fonte,registro:{...fonte.registro,origem:{...fonte.registro.origem,numero:'1'}}},{...fonte,selecao:{...fonte.selecao,identidadesRefeicoes:[id,id]}}]){
   const r=await chamar('',body);expect(r.status).toBe(400);expect(await r.text()).not.toMatch(/CANARIO|tenantId|confirmacaoOrigem/);
  }
  for(const body of [{pagina:'1',limite:25},{pagina:0,limite:25},{pagina:1,limite:101},{pagina:1,limite:25,extra:'CANARIO'}])expect((await chamar('/listar',body)).status).toBe(400);
 });
 it('limites e JSON inválido são genéricos e sem cache antes do handler',async()=>{
  for(const body of ['{"CANARIO":',JSON.stringify({extra:'x'.repeat(17000)})]){
   const r=await fetch(prefixo(),{method:'POST',headers:{'content-type':'application/json'},body});expect(r.status).toBe(body.length>16384?413:400);expect(r.headers.get('cache-control')).toBe('private, no-store');expect(await r.text()).not.toContain('CANARIO');
  }
 });
 it.each([new ConflictException('CANARIO'),new UnprocessableEntityException('CANARIO'),new Error('CANARIO')])('erros do serviço não revelam internals %p',async erro=>{
  consultarApi.mockRejectedValueOnce(erro);const r=await chamar('/consultar',{registroId:id});expect(r.status).toBe(erro instanceof ConflictException?409:erro instanceof UnprocessableEntityException?422:500);expect(await r.text()).not.toContain('CANARIO');expect(r.headers.get('cache-control')).toBe('private, no-store');
 });
 it('corpo chunked é medido pelos bytes reais e JSON inválido não é refletido',async()=>{
  for(const texto of ['{"CANARIO":',JSON.stringify({extra:'€'.repeat(6000)})]){
   const r=await new Promise<{status:number;headers:Record<string,unknown>;body:string}>((resolve,reject)=>{
    const req=requisitarHttp(prefixo(),{method:'POST',headers:{'content-type':'application/json','x-papel-sintetico':'Professional','x-permissoes-sinteticas':'planos_alimentares.ler,planos_alimentares.gerenciar'}},res=>{let body='';res.setEncoding('utf8');res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,body}));});
    req.on('error',reject);req.write(texto.slice(0,10));req.end(texto.slice(10));
   });
   expect(r.status).toBe(Buffer.byteLength(texto)>16384?413:400);expect(r.headers['cache-control']).toBe('private, no-store');expect(r.body).not.toContain('CANARIO');
  }
 });
 it('métodos desconhecidos e limites válidos não ampliam permissões',async()=>{
  for(const [fim,body] of [['/consultar',{registroId:'invalido'}],['/comparar',{antesId:id,depoisId:'invalido'}],['/comparar',{antesId:id,depoisId:outro,extra:true}]] as const)expect((await chamar(fim,body)).status).toBe(400);
  expect((await fetch(prefixo(),{method:'GET'})).status).toBe(404);
  expect((await chamar('/listar',{pagina:10000,limite:1})).status).toBe(200);expect((await chamar('/listar',{pagina:10001,limite:1})).status).toBe(400);
 });

 it('roteamento sem distinção de caixa conserva limite e mensagens seguras',async()=>{
  for(const endereco of [prefixo().replace('/pacientes/','/PACIENTES/'),prefixo().replace('/planos-alimentares/analises-factuais','/PLANOS-ALIMENTARES/ANALISES-FACTUAIS')]){
   for(const body of [' '.repeat(17000)+JSON.stringify({pagina:1,limite:25}),'{"CANARIO":']){
    const r=await fetch(endereco+'/listar',{method:'POST',headers:{'content-type':'application/json','x-papel-sintetico':'Professional','x-permissoes-sinteticas':'planos_alimentares.ler'},body});
    expect(r.status).toBe(Buffer.byteLength(body)>16384?413:400);expect(r.headers.get('cache-control')).toBe('private, no-store');expect(await r.text()).not.toContain('CANARIO');
   }
  }
 });

});
