import { analisarMicronutrientesPlanejados } from '../lib/calculo-combinado-planos-api';
import { ErroApiPlanoAlimentar } from '../lib/plano-alimentar-api';
import assert from 'node:assert/strict';
import test from 'node:test';
import { lerAnaliseMicronutrientesFactual, filtrarMicronutrientesFactuais, CAMPOS_MICRONUTRIENTES_PLANO } from '../lib/micronutrientes-factuais';
const entrada={selecoes:[{planoId:'p1',versaoIdEsperada:'v1',ativacaoRevisaoEsperada:2,identidadesRefeicoes:['r1']}]};
function resposta() {
  return {schemaVersao:1,motorVersao:'food06-factual-v1',calculadoEm:'2026-10-31T12:00:00.000Z',publicacoes:[{planoId:'p1',versaoId:'v1',ativacaoRevisao:2}],comparacoes:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},cobertura:{schemaVersao:1,nutrientes:Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,{codigo:c.codigo,unidade:c.unidade,estado:'DESCONHECIDO',contagens:{incluidos:2,conhecidos:0,semComposicao:2,incompativeis:0,naoResolvidos:0},causas:[{codigo:'ausente',quantidade:2}]}]))}};
}
function conhecido(r:ReturnType<typeof resposta>,codigo:string,valor:number,parcial=false) {
  Object.assign(r.cobertura.nutrientes[codigo],{estado:parcial?'PARCIAL':'COMPLETO',contagens:{incluidos:2,conhecidos:parcial?1:2,semComposicao:parcial?1:0,incompativeis:0,naoResolvidos:0},causas:parcial?[{codigo:'ausente',quantidade:1}]:[],...(parcial?{quantidadeConhecida:valor}:{total:valor})});
}
test('FOOD06 preserva zero completo, subtotal parcial e ausência sem replicar campos livres',()=>{
  const r=resposta();conhecido(r,'calcioMg',0);conhecido(r,'ferroMg',1.2,true);
  Object.assign(r.cobertura.nutrientes.calcioMg,{interno:'canario-sintetico'});
  const antes=JSON.stringify(r),a=lerAnaliseMicronutrientesFactual(r,entrada);
  assert.equal(a.linhas.length,22);assert.equal(a.linhas.find(x=>x.codigo==='calcioMg')!.valor,0);
  assert.equal(a.linhas.find(x=>x.codigo==='ferroMg')!.estado,'PARCIAL');
  assert.equal(a.linhas.find(x=>x.codigo==='ferroMg')!.valor,1.2);
  assert.equal(a.linhas.find(x=>x.codigo==='selenioMcg')!.valor,undefined);
  assert.ok(!JSON.stringify(a).includes('canario-sintetico'));assert.equal(JSON.stringify(r),antes);
});
for(const delta of [undefined,null,{}, {schemaVersao:2}])test(`FOOD06 rejeita formato não suportado ${JSON.stringify(delta)}`,()=>{
  assert.throws(()=>lerAnaliseMicronutrientesFactual(delta,entrada),/interpretar/);
});
for(const valor of [NaN,Infinity,-1,'9',null])test(`FOOD06 rejeita conhecido inválido ${String(valor)}`,()=>{
  const r=resposta();conhecido(r,'ferroMg',valor as number);assert.throws(()=>lerAnaliseMicronutrientesFactual(r,entrada));
});
test('FOOD06 rejeita total com cobertura parcial ou contagens contraditórias',()=>{
  const r=resposta();conhecido(r,'ferroMg',3,true);Object.assign(r.cobertura.nutrientes.ferroMg,{total:3});assert.throws(()=>lerAnaliseMicronutrientesFactual(r,entrada));
  const s=resposta();conhecido(s,'calcioMg',2);s.cobertura.nutrientes.calcioMg.contagens.conhecidos=1;assert.throws(()=>lerAnaliseMicronutrientesFactual(s,entrada));
});
test('FOOD06 rejeita resposta de outra publicação/revisão ou comparação habilitada inesperada',()=>{
  for(const delta of [{versaoId:'obsoleta'},{ativacaoRevisao:1},{planoId:'outro'}]){
    const r=resposta();Object.assign(r.publicacoes[0],delta);assert.throws(()=>lerAnaliseMicronutrientesFactual(r,entrada));
  }
  const r=resposta();r.comparacoes.estado='comparavel';assert.throws(()=>lerAnaliseMicronutrientesFactual(r,entrada));
});
test('FOOD06 filtra grupo/cobertura sem alterar entrada e ordena ausentes por último',()=>{
  const r=resposta();conhecido(r,'calcioMg',0);conhecido(r,'ferroMg',1.2,true);
  const a=lerAnaliseMicronutrientesFactual(r,entrada),antes=JSON.stringify(a);
  const f={grupo:'minerais',cobertura:'todas',ordem:'quantidade'} as const;
  const lista=filtrarMicronutrientesFactuais(a.linhas,f);
  assert.deepEqual(lista.slice(0,2).map(x=>x.codigo),['calcioMg','ferroMg']);
  assert.ok(lista.every(x=>x.grupo==='minerais'));assert.equal(JSON.stringify(a),antes);
  assert.deepEqual(filtrarMicronutrientesFactuais(a.linhas,{...f,cobertura:'PARCIAL'}).map(x=>x.codigo),['ferroMg']);
  assert.ok(filtrarMicronutrientesFactuais(a.linhas,{...f,grupo:'vitaminas'}).length>0);
});

test('FOOD06 cliente usa body mínimo, no-store e AbortSignal, sem incluir respostas completas',async()=>{
  const original=global.fetch,controller=new AbortController();let chamada:{url:string;init?:RequestInit}|undefined;
  global.fetch=(async(url:string|URL|Request,init?:RequestInit)=>{chamada={url:String(url),init};return Response.json(resposta());}) as typeof fetch;
  try {
    const r=await analisarMicronutrientesPlanejados('paciente/1',entrada,controller.signal);
    assert.equal(r.linhas.length,22);assert.equal(chamada!.url,'/api/pacientes/paciente%2F1/planos-alimentares/analise-micronutrientes');
    assert.equal(chamada!.init!.cache,'no-store');assert.equal(chamada!.init!.signal,controller.signal);
    assert.equal(chamada!.init!.body,JSON.stringify(entrada));
  }finally{global.fetch=original;}
});
test('FOOD06 cliente conserva409 sem retry ou uso de resultado anterior',async()=>{
  const original=global.fetch;let chamadas=0;
  global.fetch=(async()=>{chamadas++;return Response.json({message:'Seleção alterada.'},{status:409});}) as typeof fetch;
  try {await assert.rejects(analisarMicronutrientesPlanejados('paciente',entrada),(e:unknown)=>e instanceof ErroApiPlanoAlimentar&&e.status===409);assert.equal(chamadas,1);}finally{global.fetch=original;}
});

test('FOOD06 rejeita publicações duplicadas com caixa diferente sem encobrir plano ausente',()=>{
  const r=resposta();r.publicacoes.push({planoId:'P1',versaoId:'v1',ativacaoRevisao:2});
  const e={selecoes:[...entrada.selecoes,{...entrada.selecoes[0],planoId:'p2',versaoIdEsperada:'v2'}]};
  assert.throws(()=>lerAnaliseMicronutrientesFactual(r,e));
});

test('FOOD06 rejeita causas omitidas ou duplicadas que contradizem as contagens',()=>{
  const r=resposta();r.cobertura.nutrientes.ferroMg.causas=[];assert.throws(()=>lerAnaliseMicronutrientesFactual(r,entrada));
  const s=resposta();s.cobertura.nutrientes.ferroMg.causas=[{codigo:'ausente',quantidade:1},{codigo:'ausente',quantidade:1}];assert.throws(()=>lerAnaliseMicronutrientesFactual(s,entrada));
});

test('FOOD06 rejeita estado incompatível sem incompatibilidade e indisponível sem impedimento',()=>{
  for(const estado of ['INCOMPATIVEL','INDISPONIVEL']){
    const r=resposta();r.cobertura.nutrientes.ferroMg.estado=estado;
    assert.throws(()=>lerAnaliseMicronutrientesFactual(r,entrada));
  }
});

test('FOOD06 aceita publicações equivalentes em ordem diferente e mantém ordenação de cobertura',()=>{
  const r=resposta();r.publicacoes=[{planoId:'p2',versaoId:'v2',ativacaoRevisao:2},...r.publicacoes];
  const e={selecoes:[...entrada.selecoes,{...entrada.selecoes[0],planoId:'p2',versaoIdEsperada:'v2'}]};
  conhecido(r,'calcioMg',0);conhecido(r,'ferroMg',1.2,true);
  const a=lerAnaliseMicronutrientesFactual(r,e);
  assert.deepEqual(filtrarMicronutrientesFactuais(a.linhas,{grupo:'todos',cobertura:'todas',ordem:'cobertura'}).slice(0,2).map(x=>x.codigo),['calcioMg','ferroMg']);
});
test('FOOD06 ordenação por quantidade agrupa unidades sem converter ou tratar ausência como zero',()=>{
  const r=resposta();conhecido(r,'calcioMg',0);conhecido(r,'selenioMcg',1);
  const a=lerAnaliseMicronutrientesFactual(r,entrada);
  assert.deepEqual(filtrarMicronutrientesFactuais(a.linhas,{grupo:'todos',cobertura:'todas',ordem:'quantidade'}).slice(0,2).map(x=>[x.codigo,x.valor]),[['selenioMcg',1],['calcioMg',0]]);
});
