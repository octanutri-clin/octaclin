type AjudaTeste=ReturnType<typeof import('./fixtures/ajuda-dietetica').ajudaSintetica>;
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

test('FOOD06 não aceita números de alimentos diferentes entre nutrientes da mesma seleção',()=>{
 const r=resposta();conhecido(r,'calcioMg',0);r.cobertura.nutrientes.calcioMg.contagens.incluidos=3;r.cobertura.nutrientes.calcioMg.contagens.conhecidos=3;
 assert.throws(()=>lerAnaliseMicronutrientesFactual(r,entrada));
});
test('M09 tabela projeta ajuda profissional sem permitir dados livres ou habilitar referências',async()=>{
 const {ajudaSintetica}=await import('./fixtures/ajuda-dietetica');const r=resposta();Reflect.set(r,'ajuda',{...ajudaSintetica(),contextoPaciente:'CANARIO_PRIVADO'});
 const a=lerAnaliseMicronutrientesFactual(r,entrada);assert.equal(Reflect.get(a,'ajuda')?.conteudoVersao,'food06-ajuda-v1');assert.ok(!JSON.stringify(a).includes('CANARIO_PRIVADO'));
});
for(const [nome,mutar] of [
 ['href executável',(a:AjudaTeste)=>{a.fontes[0].url='javascript:alert(1)';}],
 ['domínio semelhante',(a:AjudaTeste)=>{a.fontes[0].url='https://ods.od.nih.gov.example.invalid/HealthInformation/nutrientrecommendations.aspx';}],
 ['query externa',(a:AjudaTeste)=>{a.fontes[0].url+='?paciente=CANARIO_PRIVADO';}],
 ['comparação habilitada',(a:AjudaTeste)=>{a.comparacoesHabilitadas=true;}],
 ['versão desconhecida',(a:AjudaTeste)=>{a.conteudoVersao='novo';}],
 ['data inválida',(a:AjudaTeste)=>{a.fontes[0].consultadaEm='2026-02-31';}],
 ['tópico duplicado',(a:AjudaTeste)=>{a.topicos[1].codigo='RDA';}],
 ['texto excessivo',(a:AjudaTeste)=>{a.topicos[0].texto='a'.repeat(4001);}],
 ['tópico ausente',(a:AjudaTeste)=>{a.topicos.pop();}]
] as const)test(`M09 ajuda inválida ${nome} não elimina o zero factual válido`,async()=>{
 const {ajudaSintetica}=await import('./fixtures/ajuda-dietetica');const a=ajudaSintetica(),r=resposta();mutar(a);Reflect.set(r,'ajuda',a);conhecido(r,'calcioMg',0);
 const p=lerAnaliseMicronutrientesFactual(r,entrada);assert.equal(Reflect.get(p,'ajuda'),null);assert.equal(p.linhas.find(l=>l.codigo==='calcioMg')?.valor,0);assert.ok(!JSON.stringify(p).includes('CANARIO_PRIVADO'));
});
test('M09 ajuda com getter não executa código e análise permanece disponível',async()=>{
 const {ajudaSintetica}=await import('./fixtures/ajuda-dietetica');const a=ajudaSintetica(),r=resposta();let executou=false;
 Object.defineProperty(a.topicos[0],'texto',{enumerable:true,get(){executou=true;return 'CANARIO_PRIVADO';}});Reflect.set(r,'ajuda',a);
 assert.equal(Reflect.get(lerAnaliseMicronutrientesFactual(r,entrada),'ajuda'),null);assert.equal(executou,false);
});

/* FOOD06 M01 — origem registrada por nutriente (campo aditivo `fontes`). */
const TACO_4_1={tipo:'TACO',codigo:'taco_nepa_unicamp',versao:'4.1',quantidade:2};
function comFontes(r:ReturnType<typeof resposta>,especificos:Record<string,object>={}) {
  const nutrientes=Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>{
    const n=r.cobertura.nutrientes[c.codigo].contagens.conhecidos;
    return [c.codigo,{contribuintes:n,fontes:[],semOrigemDocumentada:n,fontesNaoDetalhadas:0,...(especificos[c.codigo]??{})}];
  }));
  return Object.assign(r,{fontes:{schemaVersao:1,vinculo:'origem_do_registro_de_composicao',nutrientes}});
}
const origemDe=(a:ReturnType<typeof lerAnaliseMicronutrientesFactual>,codigo:string)=>Reflect.get(a.linhas.find(l=>l.codigo===codigo)!,'origem');
test('FOOD06 M01 resposta anterior sem `fontes` continua legível e não presume origem',()=>{
  const r=resposta();conhecido(r,'calcioMg',3);
  const a=lerAnaliseMicronutrientesFactual(r,entrada);
  assert.equal(origemDe(a,'calcioMg'),undefined);assert.equal(a.linhas.find(l=>l.codigo==='calcioMg')!.valor,3);
});
test('FOOD06 M01 anexa a origem registrada por nutriente sem tocar valor, estado ou contagens',()=>{
  const r=resposta();conhecido(r,'calcioMg',0);conhecido(r,'ferroMg',1.2,true);
  comFontes(r,{calcioMg:{fontes:[TACO_4_1],semOrigemDocumentada:0},ferroMg:{fontes:[{tipo:'manual',quantidade:1}],semOrigemDocumentada:0}});
  const sem=lerAnaliseMicronutrientesFactual(JSON.parse(JSON.stringify({...r,fontes:undefined})),entrada);
  const a=lerAnaliseMicronutrientesFactual(r,entrada);
  assert.deepEqual(origemDe(a,'calcioMg'),{contribuintes:2,fontes:[TACO_4_1],semOrigemDocumentada:0,fontesNaoDetalhadas:0});
  assert.deepEqual(origemDe(a,'ferroMg'),{contribuintes:1,fontes:[{tipo:'manual',quantidade:1}],semOrigemDocumentada:0,fontesNaoDetalhadas:0});
  assert.deepEqual(origemDe(a,'selenioMcg'),{contribuintes:0,fontes:[],semOrigemDocumentada:0,fontesNaoDetalhadas:0});
  for(const l of a.linhas){const b=sem.linhas.find(x=>x.codigo===l.codigo)!;assert.equal(l.valor,b.valor);assert.equal(l.estado,b.estado);assert.deepEqual(l.contagens,b.contagens);}
  assert.equal(a.linhas.find(l=>l.codigo==='calcioMg')!.valor,0);
});
test('FOOD06 M01 não replica campos extras de `fontes`',()=>{
  const r=resposta();conhecido(r,'calcioMg',3);
  const rf=comFontes(r,{calcioMg:{fontes:[{...TACO_4_1,hashConteudo:'CANARIO_HASH',nome:'CANARIO_NOME'}],semOrigemDocumentada:0,segredo:'CANARIO_NUT'}});
  Object.assign(rf.fontes,{segredo:'CANARIO_RAIZ'});
  const json=JSON.stringify(lerAnaliseMicronutrientesFactual(rf,entrada));
  assert.ok(!/CANARIO/.test(json));
});
const invalidas:[string,(r:ReturnType<typeof comFontes>)=>void][]=[
  ['contribuintes diferente dos conhecidos',r=>{r.fontes.nutrientes.calcioMg.contribuintes=1;}],
  ['soma não reconcilia',r=>{r.fontes.nutrientes.calcioMg.fontes=[{...TACO_4_1,quantidade:1}] as never;}],
  ['quantidade zero',r=>{r.fontes.nutrientes.calcioMg.fontes=[{...TACO_4_1,quantidade:0}] as never;r.fontes.nutrientes.calcioMg.semOrigemDocumentada=2;}],
  ['tipo fora da lista',r=>{r.fontes.nutrientes.calcioMg.fontes=[{...TACO_4_1,tipo:'OUTRA'}] as never;r.fontes.nutrientes.calcioMg.semOrigemDocumentada=0;}],
  ['versão malformada',r=>{r.fontes.nutrientes.calcioMg.fontes=[{...TACO_4_1,versao:'latest'}] as never;r.fontes.nutrientes.calcioMg.semOrigemDocumentada=0;}],
  ['código malformado',r=>{r.fontes.nutrientes.calcioMg.fontes=[{...TACO_4_1,codigo:'com espaço'}] as never;r.fontes.nutrientes.calcioMg.semOrigemDocumentada=0;}],
  ['grupos duplicados',r=>{r.fontes.nutrientes.calcioMg.fontes=[{...TACO_4_1,quantidade:1},{...TACO_4_1,quantidade:1}] as never;r.fontes.nutrientes.calcioMg.semOrigemDocumentada=0;}],
  ['vínculo diferente',r=>{(r.fontes as {vinculo:string}).vinculo='medicao_por_nutriente';}],
  ['esquema desconhecido',r=>{(r.fontes as {schemaVersao:number}).schemaVersao=2;}],
  ['nutriente ausente',r=>{delete (r.fontes.nutrientes as Record<string,unknown>).ferroMg;}],
  ['contagem negativa',r=>{r.fontes.nutrientes.calcioMg.semOrigemDocumentada=-1;}]
];
for(const [nome,mutar] of invalidas)test(`FOOD06 M01 recusa origem inconsistente: ${nome}`,()=>{
  const r=resposta();conhecido(r,'calcioMg',3);const rf=comFontes(r,{calcioMg:{fontes:[TACO_4_1],semOrigemDocumentada:0}});mutar(rf);
  assert.throws(()=>lerAnaliseMicronutrientesFactual(rf,entrada),/interpretar/);
});
test('FOOD06 M01 recusa mais de 50 grupos e aceita 50 com não detalhadas reconciliadas',()=>{
  const grupo=(i:number)=>({tipo:'USDA',codigo:'usda_fdc_foundation',versao:`2025.${i+1}`,quantidade:1});
  const montar=(n:number,naoDetalhadas:number)=>{const r=resposta();Object.assign(r.cobertura.nutrientes.calcioMg,{estado:'COMPLETO',contagens:{incluidos:n+naoDetalhadas,conhecidos:n+naoDetalhadas,semComposicao:0,incompativeis:0,naoResolvidos:0},causas:[],total:3});
    for(const k of CAMPOS_MICRONUTRIENTES_PLANO)if(k.codigo!=='calcioMg')Object.assign(r.cobertura.nutrientes[k.codigo].contagens,{incluidos:n+naoDetalhadas,semComposicao:n+naoDetalhadas});
    for(const k of CAMPOS_MICRONUTRIENTES_PLANO)if(k.codigo!=='calcioMg')r.cobertura.nutrientes[k.codigo].causas=[{codigo:'ausente',quantidade:n+naoDetalhadas}];
    return comFontes(r,{calcioMg:{contribuintes:n+naoDetalhadas,fontes:Array.from({length:n},(_,i)=>grupo(i)),semOrigemDocumentada:0,fontesNaoDetalhadas:naoDetalhadas}});};
  assert.doesNotThrow(()=>lerAnaliseMicronutrientesFactual(montar(50,10),{selecoes:entrada.selecoes}));
  assert.throws(()=>lerAnaliseMicronutrientesFactual(montar(51,0),{selecoes:entrada.selecoes}),/interpretar/);
});
