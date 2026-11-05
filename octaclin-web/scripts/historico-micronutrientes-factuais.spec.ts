import assert from 'node:assert/strict';
import test from 'node:test';
import { obterHistoricoMicronutrientesFactual } from '../lib/calculo-combinado-planos-api';
import { lerPaginaHistoricoMicronutrientesFactual } from '../lib/historico-micronutrientes-factuais';
import { CAMPOS_MICRONUTRIENTES_PLANO } from '../lib/micronutrientes-plano';

const cursor={id:'00000000-0000-4000-8000-000000000010',criadoEm:'2026-11-05T12:00:00.123456Z'};
function linha(codigo:string,unidade:string,estado:'COMPLETO'|'PARCIAL'|'DESCONHECIDO',valor?:number){
 const incluidos=2,conhecidos=estado==='COMPLETO'?2:estado==='PARCIAL'?1:0;
 return {codigo,unidade,estado,contagens:{incluidos,conhecidos,semComposicao:incluidos-conhecidos,incompativeis:0,naoResolvidos:0},causas:conhecidos<incluidos?[{codigo:'ausente',quantidade:incluidos-conhecidos}]:[],...(estado==='COMPLETO'&&valor!==undefined?{total:valor}:estado==='PARCIAL'&&valor!==undefined?{quantidadeConhecida:valor}:{})};
}
function pagina(overrides:Record<string,unknown>={}){
 const nutrientes=Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,linha(c.codigo,c.unidade,'DESCONHECIDO')]));
 Object.assign(nutrientes.calcioMg,linha('calcioMg','mg','COMPLETO',0));
 Object.assign(nutrientes.ferroMg,linha('ferroMg','mg','PARCIAL',1.25));
 const item={schemaVersao:1,registro:{id:cursor.id,criadoEm:'2026-11-05T12:00:00.123Z'},origem:{planoId:'plano-a',versaoId:'versao-a',numero:2,status:'publicada',registradaEm:'2026-11-05T11:59:00.000Z'},comparacaoBaseComposicao:'DIFERENTE',motorVersao:'food06-v1',nutrientes,referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},bases:{planejamentoDocumentado:true,composicaoDocumentada:false,contextoDocumentado:true}};
 return {schemaVersao:1,itens:[item],temMais:true,proximoCursor:cursor,...overrides};
}

test('M10 valida histórico factual, mantém zero e subtotal parcial sem expor envelope ou contexto',()=>{
 const entrada=pagina();
 const antes=JSON.stringify(entrada),lida=lerPaginaHistoricoMicronutrientesFactual(entrada);
 assert.equal(lida.itens[0].nutrientes.calcioMg.valor,0);
 assert.equal(lida.itens[0].nutrientes.ferroMg.valor,1.25);
 assert.equal(lida.itens[0].nutrientes.ferroMg.estado,'PARCIAL');
 assert.equal(lida.itens[0].nutrientes.selenioMcg.valor,undefined);
 assert.equal(JSON.stringify(lida).includes('conteudoCriptografado'),false);
 assert.equal(JSON.stringify(entrada),antes);
});

for(const [nome,alteracao] of [
 ['total no parcial',(p:ReturnType<typeof pagina>)=>Object.assign(p.itens[0].nutrientes.ferroMg,{total:1.25})],
 ['cursor fora do último item',(p:ReturnType<typeof pagina>)=>{p.proximoCursor={id:'00000000-0000-4000-8000-000000000099',criadoEm:cursor.criadoEm};}],
 ['campo clínico inesperado',(p:ReturnType<typeof pagina>)=>Object.assign(p.itens[0],{pacienteId:'outro'})],
 ['comparação desconhecida',(p:ReturnType<typeof pagina>)=>{p.itens[0].comparacaoBaseComposicao='ALTERADA';}],
 ['datas fora de ordem',(p:ReturnType<typeof pagina>)=>{p.itens.push({...p.itens[0],registro:{id:'00000000-0000-4000-8000-000000000011',criadoEm:'2026-11-06T12:00:00.000Z'}});}],
] as const)test(`M10 rejeita ${nome}`,()=>assert.throws(()=>lerPaginaHistoricoMicronutrientesFactual(alteracao(pagina()))));

test('M10 cliente envia cursor mínimo, sem cache e propaga cancelamento',async()=>{
 const original=global.fetch,controller=new AbortController();let chamada:{url:string;init?:RequestInit}|undefined;
 global.fetch=(async(url:string|URL|Request,init?:RequestInit)=>{chamada={url:String(url),init};return Response.json(pagina());}) as typeof fetch;
 try{
  const obtida=await obterHistoricoMicronutrientesFactual('paciente/1',cursor,controller.signal);
  assert.equal(obtida.itens.length,1);assert.equal(chamada!.url,'/api/pacientes/paciente%2F1/planos-alimentares/analises-factuais/historico');
  assert.equal(chamada!.init!.cache,'no-store');assert.equal(chamada!.init!.signal,controller.signal);
  assert.equal(chamada!.init!.body,JSON.stringify({limite:10,cursorId:cursor.id,cursorCriadoEm:cursor.criadoEm}));
 }finally{global.fetch=original;}
});
