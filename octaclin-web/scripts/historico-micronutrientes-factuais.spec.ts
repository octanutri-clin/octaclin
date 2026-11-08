import assert from 'node:assert/strict';
import test from 'node:test';
import { obterHistoricoMicronutrientesFactual } from '../lib/calculo-combinado-planos-api';
import { lerPaginaHistoricoMicronutrientesFactual } from '../lib/historico-micronutrientes-factuais';
import { CAMPOS_MICRONUTRIENTES_PLANO } from '../lib/micronutrientes-plano';

const cursor={id:'00000000-0000-4000-8000-000000000010',criadoEm:'2026-11-05T12:00:00.123456Z'};
const comparar=()=>({planejamento:'IGUAL',composicaoFonte:'DIFERENTE',referencia:'NAO_COMPARAVEL',contexto:'IGUAL',cobertura:Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,'IGUAL']))});
function linha(codigo:string,unidade:string,estado:'COMPLETO'|'PARCIAL'|'DESCONHECIDO',valor?:number){
 const incluidos=2,conhecidos=estado==='COMPLETO'?2:estado==='PARCIAL'?1:0;
 return {codigo,unidade,estado,contagens:{incluidos,conhecidos,semComposicao:incluidos-conhecidos,incompativeis:0,naoResolvidos:0},causas:conhecidos<incluidos?[{codigo:'ausente',quantidade:incluidos-conhecidos}]:[],...(estado==='COMPLETO'&&valor!==undefined?{total:valor}:estado==='PARCIAL'&&valor!==undefined?{quantidadeConhecida:valor}:{})};
}
function pagina(overrides:Record<string,unknown>={}){
 const nutrientes=Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,linha(c.codigo,c.unidade,'DESCONHECIDO')]));
 Object.assign(nutrientes.calcioMg,linha('calcioMg','mg','COMPLETO',0));
 Object.assign(nutrientes.ferroMg,linha('ferroMg','mg','PARCIAL',1.25));
 const item={schemaVersao:1,registro:{id:cursor.id,criadoEm:'2026-11-05T12:00:00.123Z'},origem:{planoId:'plano-a',versaoId:'versao-a',numero:2,status:'publicada',registradaEm:'2026-11-05T11:59:00.000Z'},comparacaoAnterior:comparar(),motorVersao:'food06-v1',nutrientes,referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},bases:{planejamentoDocumentado:true,composicaoDocumentada:false,contextoDocumentado:true}};
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
 ['comparação desconhecida',(p:ReturnType<typeof pagina>)=>{p.itens[0].comparacaoAnterior.composicaoFonte='ALTERADA';}],
 ['chave clínica inesperada na comparação',(p:ReturnType<typeof pagina>)=>{p.itens[0].comparacaoAnterior.cobertura.pacienteId='IGUAL';}],
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

test('contexto registrado tem data civil estrita e projeção mínima sem inferir população ou tabagismo',async()=>{
 const {lerContextoRegistradoFactual}=await import('../lib/contexto-registrado-factual');
 const c={schemaVersao:1,dataAnalise:'2026-11-06',idadeAnos:36,populacaoReferencia:'feminina',mesmoDiaPlanejado:false,tabagismo:'nao_informado',motivos:[]};
 assert.deepEqual(lerContextoRegistradoFactual(c),c);
 for(const alterado of [{dataAnalise:'2026-02-30'},{schemaVersao:2},{idadeAnos:-1},{populacaoReferencia:'não informada'},{tabagismo:null},{nascimento:'1990-01-01'},{motivos:['texto livre']},{motivos:['idade_fora_do_escopo','idade_fora_do_escopo']}])assert.throws(()=>lerContextoRegistradoFactual({...c,...alterado}));
});

test('histórico só admite resumo quando solicitado, sem completar registro antigo',()=>{
 const entrada=pagina();const resumo={schemaVersao:1,dataAnalise:'2026-11-06',idadeAnos:36,mesmoDiaPlanejado:false,tabagismo:'nao_informado',motivos:[]};Object.assign(entrada.itens[0],{contextoConfirmado:resumo});
 assert.throws(()=>lerPaginaHistoricoMicronutrientesFactual(entrada));assert.equal(lerPaginaHistoricoMicronutrientesFactual(entrada,true).itens[0].contextoConfirmado?.idadeAnos,36);
 entrada.itens[0].bases.contextoDocumentado=false;assert.throws(()=>lerPaginaHistoricoMicronutrientesFactual(entrada,true));
 assert.equal(lerPaginaHistoricoMicronutrientesFactual(pagina(),true).itens[0].contextoConfirmado,undefined);
});
test('consulta de contexto preserva a flag no body e não usa parâmetros clínicos em URL',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async(url,init)=>{assert.ok(!String(url).includes('?'));assert.equal(init?.cache,'no-store');assert.deepEqual(JSON.parse(String(init?.body)),{limite:10,incluirContexto:true});return Response.json(pagina({temMais:false,proximoCursor:undefined}));};await obterHistoricoMicronutrientesFactual('paciente',undefined,new AbortController().signal,true);}finally{globalThis.fetch=original;}
});

/* FOOD06 M01 — o histórico também carrega a origem por nutriente (aditivo). */
type PontoComOrigem={nutrientes:Record<string,{origem?:{contribuintes:number;fontes:{tipo:string;quantidade:number}[]}}>};
function fontesDoHistorico(pag:{itens:{nutrientes:Record<string,{contagens:{conhecidos:number}}>}[]}){
 const n=pag.itens[0]!.nutrientes;
 return {schemaVersao:1,vinculo:'origem_do_registro_de_composicao',nutrientes:Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>{
  const k=n[c.codigo]!.contagens.conhecidos;
  return [c.codigo,{contribuintes:k,fontes:k?[{tipo:'manual',quantidade:k}]:[],semOrigemDocumentada:0,fontesNaoDetalhadas:0}];
 }))};
}
test('M01 histórico aceita a origem por nutriente e a anexa sem mudar valor, estado ou contagens',()=>{
 const base=pagina() as {itens:Record<string,unknown>[]};
 const sem=lerPaginaHistoricoMicronutrientesFactual(JSON.parse(JSON.stringify(base)));
 base.itens[0]!.fontesPorNutriente=fontesDoHistorico(base as never);
 const a=lerPaginaHistoricoMicronutrientesFactual(base);
 const p=a.itens[0] as unknown as PontoComOrigem;
 assert.deepEqual(p.nutrientes.ferroMg!.origem,{contribuintes:1,fontes:[{tipo:'manual',quantidade:1}],semOrigemDocumentada:0,fontesNaoDetalhadas:0});
 assert.equal(p.nutrientes.selenioMcg!.origem?.contribuintes,0);
 assert.equal(a.itens[0]!.nutrientes.calcioMg.valor,sem.itens[0]!.nutrientes.calcioMg.valor);
 assert.equal(a.itens[0]!.nutrientes.ferroMg.valor,1.25);
 assert.ok(sem.itens[0] && Object.values((sem.itens[0] as unknown as PontoComOrigem).nutrientes).every(x=>x.origem===undefined));
});
test('M01 histórico recusa origem inconsistente com a cobertura do mesmo ponto',()=>{
 const base=pagina() as {itens:Record<string,unknown>[]};
 const f=fontesDoHistorico(base as never) as {nutrientes:Record<string,{contribuintes:number}>};
 f.nutrientes.ferroMg!.contribuintes=2;
 base.itens[0]!.fontesPorNutriente=f;
 assert.throws(()=>lerPaginaHistoricoMicronutrientesFactual(base),/interpretar|histórico|conferir/i);
});
