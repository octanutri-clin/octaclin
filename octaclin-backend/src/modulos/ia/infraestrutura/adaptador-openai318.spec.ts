import { AdaptadorOpenAi318 } from './adaptador-openai318';
import { Modelo318 } from '../dominio/rascunhos-clinicos';
const modelo:Modelo318={id:'modelo-sintetico',versao:'fixture-v1',nome:'Fixture',maxOutputTokens:2048,precoEntradaMilhaoUsd:0,precoSaidaMilhaoUsd:0,precoEm:'2026-10-13',padrao:true};
const fontes=[{ref:'medida:1',tipo:'medida' as const,data:'2026-01-01',texto:'Peso70kg'}];
describe('adaptadorOpenAI318 isolado',()=>{
 const anterior=global.fetch;
 afterEach(()=>{global.fetch=anterior;});
 it('nega chamada mesmo com env true quando direitos nao aprovados',async()=>{
  global.fetch=jest.fn();await expect(new AdaptadorOpenAi318([modelo],false).gerar('segredo-sintetico','modelo-sintetico',fontes,'evolucao')).rejects.toThrow();expect(global.fetch).not.toHaveBeenCalled();
 });
 it('nega modelo fora do catalogo antes de enviar segredo',async()=>{
  global.fetch=jest.fn();await expect(new AdaptadorOpenAi318([],true).gerar('segredo-sintetico','arbitrario',fontes,'evolucao')).rejects.toThrow();expect(global.fetch).not.toHaveBeenCalled();
 });
 it('chama endpoint fixo sem ferramentas e store:false, validando referencias',async()=>{
  global.fetch=jest.fn(async()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({itens:[{texto:'Peso70kg',refs:['medida:1']}],limitacoes:[]})}]}]}))) as never;
  expect(await new AdaptadorOpenAi318([modelo],true).gerar('segredo-sintetico',modelo.id,fontes,'evolucao')).toHaveProperty('itens');
  const [url,init]=(global.fetch as jest.Mock).mock.calls[0];expect(url).toBe('https://api.openai.com/v1/responses');expect(init.redirect).toBe('error');const body=JSON.parse(init.body);expect(body.store).toBe(false);expect(body.tools).toBeUndefined();expect(body.background).toBe(false);expect(body.max_output_tokens).toBe(2048);
 });
 it.each(['incomplete','failed'])('nao aceita resposta %s nem repete chamada',async status=>{
  global.fetch=jest.fn(async()=>new Response(JSON.stringify({status,output:[]}))) as never;
  await expect(new AdaptadorOpenAi318([modelo],true).gerar('segredo-sintetico',modelo.id,fontes,'evolucao')).rejects.toThrow();expect(global.fetch).toHaveBeenCalledTimes(1);
 });
 it('erro externo nao vaza segredo, corpo ou stack',async()=>{
  global.fetch=jest.fn(async()=>new Response('segredo-sintetico texto-clinico',{status:401})) as never;
  const chamada=new AdaptadorOpenAi318([modelo],true).gerar('segredo-sintetico',modelo.id,fontes,'evolucao');
  await expect(chamada).rejects.toThrow('Credencial OpenAI');
  await chamada.catch(e=>{expect(e.message).not.toContain('segredo-sintetico');expect(e.message).not.toContain('texto-clinico');});
 });
});
