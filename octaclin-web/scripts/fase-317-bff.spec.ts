import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import type { NextRequest } from 'next/server';
import { tratarOperacaoPiloto } from '../lib/server/gamificacao-piloto-bff';
import { salvarSessaoBff } from '../lib/server/sessao-bff';
import { PATCH as patchConfiguracao, GET as getConfiguracao } from '../app/api/gamificacao-piloto/configuracao/route';
import { GET as getRetencao, POST as postRetencao } from '../app/api/gamificacao-piloto/configuracao/retencao/route';

const { __clearCookies } = nextHeaders as typeof nextHeaders & { __clearCookies: () => void };
const patientId = '10000000-0000-4000-8000-000000000001';
const circleId = '20000000-0000-4000-8000-000000000002';
function request(body: unknown, headers: Record<string,string> = {'origin':'http://localhost','sec-fetch-site':'same-origin'}) {
  const url = new URL('http://localhost/api/gamificacao-piloto/console');
  const r = new Request(url, {method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  Object.defineProperty(r,'nextUrl',{value:url});
  return r as NextRequest;
}
function configRequest(method:'GET'|'PATCH', body?:unknown, query='') {
  const url = new URL(`http://localhost/api/gamificacao-piloto/configuracao${query}`);
  const r = new Request(url, { method, headers: method === 'PATCH' ? {'content-type':'application/json','origin':'http://localhost','sec-fetch-site':'same-origin'} : {}, ...(method === 'PATCH' ? {body:JSON.stringify(body)} : {}) });
  Object.defineProperty(r,'nextUrl',{value:url});
  return r as NextRequest;
}
function retencaoRequest(method:'GET'|'POST', body?:unknown, query='') {
  const url=new URL(`http://localhost/api/gamificacao-piloto/configuracao/retencao${query}`);
  const r=new Request(url,{method,headers:method==='POST'?{'content-type':'application/json','origin':'http://localhost','sec-fetch-site':'same-origin'}:{},...(method==='POST'?{body:JSON.stringify(body)}:{})});
  Object.defineProperty(r,'nextUrl',{value:url});return r as NextRequest;
}
async function login(papel:string, permissoes:string[]) {
  await salvarSessaoBff({apiUrl:'http://backend.octaclin.local',tenantSlug:'clinica-sintetica',email:'sintetico@example.test'},
    {accessToken:'token-sintetico',refreshToken:'refresh-sintetico',tipoToken:'Bearer',expiraEmSegundos:3600,papel,permissoes});
}

test('Fase317 BFF exige sessão, papel, permissões e origem da mutação',async()=>{
  const original=global.fetch;let calls=0;global.fetch=(async()=>{calls++;return Response.json({itens:[],temMais:false});}) as typeof fetch;
  try{
    __clearCookies();assert.equal((await tratarOperacaoPiloto(request({acao:'console-circulos'}),false)).status,401);
    await login('Patient',['gamificacao.gerenciar','pacientes.gerenciar']);assert.equal((await tratarOperacaoPiloto(request({acao:'console-circulos'}),false)).status,403);
    await login('Professional',['gamificacao.gerenciar']);assert.equal((await tratarOperacaoPiloto(request({acao:'console-circulos'}),false)).status,403);
    await login('Professional',['gamificacao.gerenciar','pacientes.gerenciar']);
    assert.equal((await tratarOperacaoPiloto(request({acao:'console-circulos'},{'origin':'https://attacker.invalid','sec-fetch-site':'cross-site'}),false)).status,403);
    assert.equal(calls,0);
  }finally{global.fetch=original;__clearCookies();}
});

test('Fase317 BFF não aceita caminhos/campos livres e reduz a projeção de saída',async()=>{
  const original=global.fetch,urls:string[]=[];
  await login('Professional',['gamificacao.gerenciar','pacientes.gerenciar']);
  global.fetch=(async(input)=>{urls.push(String(input));return Response.json({itens:[{id:circleId,nome:'Grupo sintético',objetivo:'Apoio',estado:'ativo',versao:1,pacienteId:patientId,usuarioId:'sensitive',tenantId:'sensitive'}],temMais:false,cursorInterno:'secret'});}) as typeof fetch;
  try{
    const body={acao:'console-circulos'};const response=await tratarOperacaoPiloto(request(body),false);
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie');
    const result=await response.json() as {itens:Array<Record<string,unknown>>};assert.deepEqual(Object.keys(result.itens[0]).sort(),['estado','id','nome','objetivo','versao']);
    assert(!JSON.stringify(result).includes(patientId));assert(urls[0].endsWith('/gamificacao/piloto/circulos'));
    assert.equal((await tratarOperacaoPiloto(request({acao:'console-feed',circuloId:circleId,cursor:'cursor / sintético'}),false)).status,200);
    assert(urls[1].endsWith('/publicacoes?cursor=cursor%20%2F%20sint%C3%A9tico'));
    for(const invalid of [
      {acao:'console-feed',circuloId:'../../admin'},
      {acao:'console-circulos',url:'/arbitrary/path'},
      {acao:'console-circulos',tenantId:'tenant-synthetic'},
      {acao:'conceder-conquista',pacienteId:patientId,chave:'10000000-0000-4000-8000-000000000001',versaoEsperada:0,titulo:'Marco',icone:'award',tenantId:'sensitive'}
    ]) assert([400,404].includes((await tratarOperacaoPiloto(request(invalid),false)).status));
    assert.equal(urls.length,2);

    assert.equal((await tratarOperacaoPiloto(request({acao:'console-circulos',extra:'x'.repeat(9000)}),false)).status,413);
    global.fetch=(async()=>Response.json({message:'Sensitive free text should never be echoed'}, {status:400})) as typeof fetch;
    const rejected=await tratarOperacaoPiloto(request(body),false);
    assert.equal(rejected.status,400);
    assert(!JSON.stringify(await rejected.json()).includes('Sensitive free text'));
  }finally{global.fetch=original;__clearCookies();}
});

test('Fase317 portal limita a projeção mas mantém texto como texto simples',async()=>{
  const original=global.fetch;await login('Patient',[]);
  global.fetch=(async()=>Response.json({itens:[{id:circleId,texto:'<script>alert(1)</script>',autor:'Nome sintético',criadoEm:'2026-01-01T00:00:00.000Z',versao:1,proprio:true,reacoes:{total:2,curti:false,pacienteId:patientId},usuarioId:'sensitive',html:'<svg/>'}],temMais:false} )) as typeof fetch;
  try{
    const response=await tratarOperacaoPiloto(request({acao:'portal-feed',circuloId:circleId}),true);
    assert.equal(response.status,200);const result=await response.json() as {itens:Array<Record<string,unknown>>};
    assert.equal(result.itens[0].texto,'<script>alert(1)</script>');assert(!JSON.stringify(result).includes('sensitive'));
    assert.deepEqual(result.itens[0].reacoes,{total:2,curti:false});
  }finally{global.fetch=original;__clearCookies();}
});

test('Fase317 configuração valida papel, limite do corpo, tenant e não ecoa erros livres',async()=>{
  const original=global.fetch;let calls=0;
  await login('Client',['cliente.configuracoes.gerenciar']);
  global.fetch=(async()=>{calls++;return Response.json({conquistas:false,comunidade:false,versao:1,operacaoAprovada:false});}) as typeof fetch;
  try{
    assert.equal((await getConfiguracao(configRequest('GET'))).status,200);
    const oversized=await patchConfiguracao(configRequest('PATCH',{conquistas:false,comunidade:false,versaoEsperada:1,payload:'x'.repeat(1200)}));
    assert.equal(oversized.status,413);assert.equal(calls,1);
    global.fetch=(async()=>{calls++;return Response.json({message:'Sensitive free text should never be echoed'}, {status:400});}) as typeof fetch;
    const rejected=await patchConfiguracao(configRequest('PATCH',{conquistas:true,comunidade:false,versaoEsperada:1}));
    assert.equal(rejected.status,400);assert(!JSON.stringify(await rejected.json()).includes('Sensitive free text'));
    await login('SuperAdmin',['operacoes.tenants.gerenciar']);
    assert.equal((await getConfiguracao(configRequest('GET',undefined,'?tenantId=not-a-uuid'))).status,403);assert.equal(calls,2);
  }finally{global.fetch=original;__clearCookies();}
});

test('Fase317 retenção expõe metadados mínimos só ao gestor e valida exceções',async()=>{
  const original=global.fetch;let calls=0;
  const denunciaId='30000000-0000-4000-8000-000000000003';
  await login('Client',['cliente.configuracoes.gerenciar']);
  global.fetch=(async()=>{calls++;return Response.json({itens:[{id:denunciaId,versao:3,eliminarEm:'2099-01-01T00:00:00.000Z',holdAte:null,evidencia:{texto:'sensitive'},tenantId:'sensitive'}],temMais:false,conteudo:'sensitive'});}) as typeof fetch;
  try{
    const page=await getRetencao(retencaoRequest('GET'));
    assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'private, no-store');
    const projected=await page.json() as {itens:Array<Record<string,unknown>>};
    assert.deepEqual(projected.itens[0],{id:denunciaId,versao:3,eliminarEm:'2099-01-01T00:00:00.000Z',holdAte:null});
    assert(!JSON.stringify(projected).includes('sensitive'));
    assert.equal((await getRetencao(retencaoRequest('GET',undefined,'?tenantId=other'))).status,400);
    await login('Professional',['cliente.configuracoes.gerenciar']);
    assert.equal((await getRetencao(retencaoRequest('GET'))).status,403);
    await login('Client',['cliente.configuracoes.gerenciar']);
    const good={denunciaId,chave:'40000000-0000-4000-8000-000000000004',versaoEsperada:3,holdAte:'2099-02-01T00:00:00.000Z',justificativa:'Revisão legal sintética',confirmacaoLegal:true};
    assert.equal((await postRetencao(retencaoRequest('POST',{...good,justificativa:'x'.repeat(9_000)}))).status,413);
    global.fetch=(async()=>{calls++;return Response.json({id:denunciaId,versao:4,holdAte:good.holdAte});}) as typeof fetch;
    assert.equal((await postRetencao(retencaoRequest('POST',{...good,confirmacaoLegal:false}))).status,400);
    const saved=await postRetencao(retencaoRequest('POST',good));assert.equal(saved.status,200);
    global.fetch=(async()=>Response.json({message:'Sensitive free text should never be echoed'},{status:400})) as typeof fetch;
    const rejected=await postRetencao(retencaoRequest('POST',good));assert.equal(rejected.status,400);
    assert(!JSON.stringify(await rejected.json()).includes('Sensitive free text'));
    assert.equal(calls,2);
  }finally{global.fetch=original;__clearCookies();}
});

test('Fase317 BFF rejeita objetos em campos escalares e páginas acima do limite',async()=>{
  const original=global.fetch;await login('Patient',[]);
  const item={id:circleId,texto:'Texto sintético',autor:'Nome sintético',versao:1,reacoes:{total:0,curti:false}};
  try{
    for(const invalid of [
      {...item,texto:{pacienteId:patientId}},
      {...item,autor:['nome protegido']},
      {...item,reacoes:{total:{usuarioId:patientId},curti:false}}
    ]){
      global.fetch=(async()=>Response.json({itens:[invalid],temMais:false})) as typeof fetch;
      const response=await tratarOperacaoPiloto(request({acao:'portal-feed',circuloId:circleId}),true);
      assert.equal(response.status,502);assert(!JSON.stringify(await response.json()).includes(patientId));
    }
    global.fetch=(async()=>Response.json({itens:Array.from({length:51},()=>item),temMais:false})) as typeof fetch;
    assert.equal((await tratarOperacaoPiloto(request({acao:'portal-feed',circuloId:circleId}),true)).status,502);
  }finally{global.fetch=original;__clearCookies();}
});

test('Fase317 moderador pode retirar post e comentário sem denúncia pelo BFF',async()=>{
  const original=global.fetch;const urls:string[]=[];await login('Professional',['gamificacao.gerenciar','pacientes.gerenciar']);
  global.fetch=(async(input)=>{urls.push(String(input));return Response.json({id:patientId,versao:2,estado:'retirado'});}) as typeof fetch;
  const command={circuloId:circleId,postId:patientId,chave:circleId,versaoEsperada:1};
  try{
    assert.equal((await tratarOperacaoPiloto(request({acao:'console-retirar-post',...command}),false)).status,200);
    assert.equal((await tratarOperacaoPiloto(request({acao:'console-retirar-comentario',...command,comentarioId:circleId}),false)).status,200);
    assert(urls[0].endsWith(`/publicacoes/${patientId}/retirada`));
    assert(urls[1].endsWith(`/publicacoes/${patientId}/comentarios/${circleId}/retirada`));
    await login('Client',['gamificacao.gerenciar','pacientes.gerenciar']);
    assert.equal((await tratarOperacaoPiloto(request({acao:'console-retirar-post',...command}),false)).status,403);assert.equal(urls.length,2);
  }finally{global.fetch=original;__clearCookies();}
});

test('Fase317 convite projeta clínica e profissional confirmados sem IDs internos',async()=>{
  const original=global.fetch;await login('Patient',[]);
  global.fetch=(async()=>Response.json({itens:[{id:circleId,nome:'Círculo sintético',estado:'ativo',destinatarios:{clinica:'Clínica sintética',profissional:'Profissional sintético',usuarioId:patientId}}],temMais:false})) as typeof fetch;
  try{
    const response=await tratarOperacaoPiloto(request({acao:'portal-circulos'}),true);assert.equal(response.status,200);
    const body=await response.json() as {itens:Array<Record<string,unknown>>};
    assert.deepEqual(body.itens[0].destinatarios,{clinica:'Clínica sintética',profissional:'Profissional sintético'});
    assert(!JSON.stringify(body).includes(patientId));
  }finally{global.fetch=original;__clearCookies();}
});
