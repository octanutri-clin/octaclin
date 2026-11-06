import type {PedidoPreviaReceita} from '../lib/previa-micronutrientes-plano';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPOS_MICRONUTRIENTES_PLANO } from '../lib/micronutrientes-plano';
import { lerPreviaMicronutrientes,lerAckPrevia, type PedidoPreviaMicronutrientes } from '../lib/previa-micronutrientes-plano';
const pedido:PedidoPreviaMicronutrientes={rascunhoIdEsperado:'draft-1',rascunhoRevisaoEsperada:2,ativacaoRevisaoEsperada:1,operacao:{tipo:'definir_porcao_manual',refeicaoChave:'r',itemChave:'i',quantidade:1.5,unidade:'porção',porcaoGramas:150}};
function resposta(){
 const estado=(depois:boolean)=>({calculo:{nutrientes:Object.fromEntries(['energiaKcal','proteinasG','carboidratosG','gordurasG'].map(c=>[c,{codigo:c,unidade:c==='energiaKcal'?'kcal':'g',estado:'completo',total:depois?150:100,itensComValor:1,itensIncluidos:1}]))},cobertura:{schemaVersao:1,nutrientes:Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,{codigo:c.codigo,unidade:c.unidade,estado:c.codigo==='ferroMg'?'COMPLETO':'DESCONHECIDO',...(c.codigo==='ferroMg'?{total:depois?3:2}:{}),contagens:{incluidos:1,conhecidos:c.codigo==='ferroMg'?1:0,semComposicao:c.codigo==='ferroMg'?0:1,incompativeis:0,naoResolvidos:0},causas:c.codigo==='ferroMg'?[]:[{codigo:'ausente',quantidade:1}]}]))}});
 const codigos=['energiaKcal','proteinasG','carboidratosG','gordurasG',...CAMPOS_MICRONUTRIENTES_PLANO.map(c=>c.codigo)];
 return {schemaVersao:1,motorVersao:'food06-previa-api-v1',escopo:'rascunho_refeicoes_ativas',rascunhoId:'draft-1',rascunhoRevisao:2,ativacaoRevisao:1,fingerprint:'a'.repeat(64),avisos:['fontes_resolvidas_como_no_salvamento'],comparacao:{schemaVersao:1,motorVersao:'food06-previa-factual-v1',antes:estado(false),depois:estado(true),referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},diferencas:Object.fromEntries(codigos.map(c=>[c,{codigo:c,unidade:c==='energiaKcal'?'kcal':c.endsWith('Mcg')?'mcg':c.endsWith('Mg')?'mg':'g',delta:c==='ferroMg'||!CAMPOS_MICRONUTRIENTES_PLANO.some(x=>x.codigo===c)?{estado:'calculavel',diferenca:c==='ferroMg'?1:50,percentual:{estado:'calculavel',valor:50,arredondado:false}}:{estado:'indisponivel',motivo:'composicao_incompleta'}}]))}};
}
test('M04 projeta antes/depois/resíduo sem levar campos sensíveis e conserva ausência',()=>{
 const r=resposta();Reflect.set(r,'contextoClinico','CANARIO_PRIVADO');const p=lerPreviaMicronutrientes(r,pedido);
 assert.equal(p.linhas.length,26);assert.deepEqual(p.linhas.find(l=>l.codigo==='ferroMg')?.delta,{valor:1,percentual:50});
 assert.equal(p.linhas.find(l=>l.codigo==='selenioMcg')?.antes.valor,undefined);assert.ok(!JSON.stringify(p).includes('CANARIO_PRIVADO'));
});
for(const [campo,valor] of [['rascunhoId','outro'],['rascunhoRevisao',3],['ativacaoRevisao',2],['fingerprint','x'],['motorVersao','novo'],['escopo','publicado']] as const)test(`M04 rejeita identidade/formato diferente ${campo}`,()=>{const r=resposta();Reflect.set(r,campo,valor);assert.throws(()=>lerPreviaMicronutrientes(r,pedido));});
test('M04 não apresenta delta incoerente ou percentual com base zero',()=>{
 const r=resposta();r.comparacao.diferencas.ferroMg.delta.diferenca=999;assert.throws(()=>lerPreviaMicronutrientes(r,pedido));
 const s=resposta();s.comparacao.antes.cobertura.nutrientes.ferroMg.total=0;s.comparacao.diferencas.ferroMg.delta.diferenca=3;assert.throws(()=>lerPreviaMicronutrientes(s,pedido));
});
test('M04 não aceita comparação DRI habilitada ou cobertura incompleta com delta',()=>{
 const r=resposta();r.comparacao.referencias.estado='comparavel';assert.throws(()=>lerPreviaMicronutrientes(r,pedido));
 const s=resposta();s.comparacao.depois.cobertura.nutrientes.ferroMg.estado='DESCONHECIDO';assert.throws(()=>lerPreviaMicronutrientes(s,pedido));
});
test('M04 ACK deve corresponder à próxima revisão materializada e projeta apenas identidade',()=>{
 const r={id:'draft-1',rascunhoRevisao:3,edicaoEstado:'materializada',documentoEdicao:{canario:'SEGREDO_SINTETICO'}};
 assert.deepEqual(lerAckPrevia(r,pedido),{id:'draft-1',rascunhoRevisao:3});
 for(const d of [{id:'outro'},{rascunhoRevisao:2},{rascunhoRevisao:4},{edicaoEstado:'pendente'}])assert.throws(()=>lerAckPrevia({...r,...d},pedido));
});
test('M04 HTTP usa POST/no-store, sinal, caminho codificado e allowlist; confirmação não devolve documento',async()=>{
 const api=await import('../lib/previa-micronutrientes-plano');const original=global.fetch;const controle=new AbortController();let url='',init:RequestInit|undefined;
 global.fetch=(async(u,o)=>{url=String(u);init=o;return Response.json(url.endsWith('/confirmar')?{id:'draft-1',rascunhoRevisao:3,edicaoEstado:'materializada',documentoEdicao:{canario:'PRIVADO'}}:resposta());}) as typeof global.fetch;
 try{
  const entrada={...pedido,tenantId:'privado'};
  await api.preverMicronutrientesPlano('paciente/1','plano/1',entrada,controle.signal);
  assert.ok(url.endsWith('/pacientes/paciente%2F1/planos-alimentares/plano%2F1/rascunho/previa-micronutrientes'));assert.equal(init?.method,'POST');assert.equal(init?.cache,'no-store');assert.equal(init?.signal,controle.signal);assert.ok(!String(init?.body).includes('privado'));
  const ack=await api.confirmarPreviaMicronutrientesPlano('p','a',pedido,'a'.repeat(64),controle.signal);assert.deepEqual(ack,{id:'draft-1',rascunhoRevisao:3});assert.ok(url.endsWith('/confirmar'));assert.equal(JSON.parse(String(init?.body)).fingerprintEsperado,'a'.repeat(64));
 }finally{global.fetch=original;}
});
test('M04 erros de acesso/conflito não expõem mensagens internas',async()=>{
 const api=await import('../lib/previa-micronutrientes-plano');const original=global.fetch;
 try{for(const status of [401,403,404,409,422,500]){
  global.fetch=(async()=>Response.json({message:'CANARIO_PRIVADO'},{status})) as typeof global.fetch;
  await assert.rejects(api.preverMicronutrientesPlano('p','a',pedido,new AbortController().signal),e=>{assert.equal(Reflect.get(e as object,'status'),status);assert.ok(!String(e).includes('CANARIO_PRIVADO'));return true;});
 }}finally{global.fetch=original;}
});
test('M04 HTTP receita usa identidade e porções e não envia ingredientes/composição',async()=>{
 const api=await import('../lib/previa-micronutrientes-plano');const original=global.fetch;let corpo:Record<string,unknown>={};
 const operacao={tipo:'inserir_receita',refeicaoChave:'r',receitaId:'receita-1',receitaVersaoEsperada:3,porcoesDesejadas:1.5};
 global.fetch=(async(_u,o)=>{corpo=JSON.parse(String(o?.body));return Response.json(resposta());}) as typeof global.fetch;
 try{
  await api.preverMicronutrientesPlano('p','a',{...pedido,operacao:{...operacao,itens:[{privado:true}]}} as PedidoPreviaReceita,new AbortController().signal);
  assert.deepEqual(corpo.operacao,operacao);
 }finally{global.fetch=original;}
});
test('M09 prévia projeta ajuda explicativa sem dados livres nem comparações habilitadas',async()=>{
 const {ajudaSintetica}=await import('./fixtures/ajuda-dietetica');const r=resposta();Reflect.set(r,'ajuda',{...ajudaSintetica(),contextoPaciente:'CANARIO_PRIVADO'});
 const p=lerPreviaMicronutrientes(r,pedido);
 assert.equal(Reflect.get(p,'ajuda')?.conteudoVersao,'food06-ajuda-v1');assert.ok(!JSON.stringify(p).includes('CANARIO_PRIVADO'));
});

test('M09 ajuda inválida na prévia não altera linhas nem fingerprint',async()=>{
 const {ajudaSintetica}=await import('./fixtures/ajuda-dietetica');const r=resposta(),antes=lerPreviaMicronutrientes(r,pedido);
 Reflect.set(r,'ajuda',{...ajudaSintetica(),comparacoesHabilitadas:true});const depois=lerPreviaMicronutrientes(r,pedido);
 assert.equal(Reflect.get(depois,'ajuda'),null);assert.equal(depois.fingerprint,antes.fingerprint);assert.deepEqual(depois.linhas,antes.linhas);
});
