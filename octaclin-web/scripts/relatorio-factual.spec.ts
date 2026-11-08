import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lerRelatorioFactual} from '../lib/relatorio-factual';
import {CAMPOS_MICRONUTRIENTES_PLANO} from '../lib/micronutrientes-plano';
function fixture(){return {schemaVersao:1,motorVersao:'food06-relatorio-factual-v1',geradoEm:'2026-11-05T14:00:00.000Z',registro:{id:'registro',criadoEm:'2026-11-05T12:00:00.000Z'},origem:{planoId:'plano',versaoId:'versao',numero:2,status:'rascunho',rascunhoRevisao:3,registradaEm:'2026-11-04T12:00:00.000Z'},referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},contextoClinico:{estado:'nao_documentado_no_relatorio'},fontesComposicao:{estado:'nao_projetadas_neste_contrato'},avisos:[],limites:['alimentacao_planejada_nao_consumo_real','ausencia_nao_equivale_a_zero','sem_diagnostico_ou_recomendacao','composicao_congelada_sem_catalogo_atual'],selecao:{planoAtivo:true,planoSelecionado:true,refeicoes:[{identidadeId:'refeicao',ativa:true,selecionada:true}]},analise:{calculo:{nutrientes:Object.fromEntries(['energiaKcal','proteinasG','carboidratosG','gordurasG'].map(c=>[c,{codigo:c,unidade:c==='energiaKcal'?'kcal':'g',estado:c==='energiaKcal'?'completo':'indisponivel',...(c==='energiaKcal'?{total:0}:{}),itensIncluidos:1,itensComValor:c==='energiaKcal'?1:0}]))},cobertura:{schemaVersao:1,nutrientes:Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,{codigo:c.codigo,unidade:c.unidade,estado:c.codigo==='ferroMg'?'COMPLETO':'DESCONHECIDO',...(c.codigo==='ferroMg'?{total:0}:{}),contagens:{incluidos:1,conhecidos:c.codigo==='ferroMg'?1:0,semComposicao:c.codigo==='ferroMg'?0:1,incompativeis:0,naoResolvidos:0},causas:c.codigo==='ferroMg'?[]:[{codigo:'ausente',quantidade:1}]}]))}}};}
test('relatório valida registro exato, zero e desconhecido e projeta somente dados de apresentação',()=>{const f={...fixture(),segredo:'CANARIO'};const r=lerRelatorioFactual(f,'registro');assert.equal(r.linhas.find(l=>l.codigo==='ferroMg')?.valor,0);assert.equal(r.linhas.find(l=>l.codigo==='selenioMcg')?.valor,undefined);assert.equal(r.origem.rascunhoRevisao,3);assert.ok(!JSON.stringify(r).includes('CANARIO'));});
test('recusa registro alheio, referências ativadas e revisão editorial inválida',()=>{assert.throws(()=>lerRelatorioFactual(fixture(),'alheio'));for(const mudanca of [{origem:{...fixture().origem,rascunhoRevisao:0}},{referencias:{estado:'habilitada'}},{geradoEm:'invalido'}])assert.throws(()=>lerRelatorioFactual({...fixture(),...mudanca},'registro'));});
test('consulta autenticada usa body mínimo e não retorna erros internos',async()=>{const {obterRelatorioFactual}=await import('../lib/relatorio-factual');const original=globalThis.fetch;const signal=new AbortController().signal;try{globalThis.fetch=async(_url,init)=>{assert.equal(init?.cache,'no-store');assert.equal(init?.signal,signal);assert.deepEqual(JSON.parse(String(init?.body)),{registroId:'registro'});return Response.json(fixture());};assert.equal((await obterRelatorioFactual('paciente','registro',signal)).registro.id,'registro');globalThis.fetch=async()=>new Response('CANARIO_PRIVADO',{status:403});await assert.rejects(()=>obterRelatorioFactual('paciente','registro',signal),(e:Error)=>!e.message.includes('CANARIO_PRIVADO'));}finally{globalThis.fetch=original;}});
test('relatório inclui energia, macros e seleção congelada sem tratar ausência como zero',()=>{const f=fixture();const r=lerRelatorioFactual(f,'registro') as unknown as {macros:{codigo:string;valor?:number}[];selecao:{planoAtivo:boolean}};assert.equal(r.macros.find(m=>m.codigo==='energiaKcal')?.valor,0);assert.equal(r.macros.find(m=>m.codigo==='proteinasG')?.valor,undefined);assert.equal(r.selecao.planoAtivo,true);});
test('recusa seleção duplicada ou malformada e contagens macro incompatíveis com cobertura',()=>{const f=fixture();assert.throws(()=>lerRelatorioFactual({...f,selecao:{...f.selecao,planoAtivo:'sim'}},'registro'));assert.throws(()=>lerRelatorioFactual({...f,selecao:{...f.selecao,refeicoes:[f.selecao.refeicoes[0],f.selecao.refeicoes[0]]}},'registro'));const invalida=fixture();invalida.analise.calculo.nutrientes.energiaKcal.itensIncluidos=2;assert.throws(()=>lerRelatorioFactual(invalida,'registro'));});
test('projeta fontes congeladas sem metadados livres e rejeita totais ou tipos inconsistentes',()=>{const fonte={estado:'resumo_documentado',itensIncluidos:1,semReferencia:0,fontesNaoDetalhadas:0,fontes:[{tipo:'TACO',versao:'1',quantidade:1,hashConteudo:'CANARIO'}]};const r=lerRelatorioFactual({...fixture(),fontesComposicao:fonte},'registro');assert.deepEqual(r.fontes,[{tipo:'TACO',versao:'1',quantidade:1}]);assert.ok(!JSON.stringify(r).includes('CANARIO'));for(const f of [{...fonte,itensIncluidos:2},{...fonte,fontes:[{tipo:'CANARIO',quantidade:1}]},{...fonte,fontes:[{tipo:'TACO',versao:'<script>x</script>',quantidade:1}]}])assert.throws(()=>lerRelatorioFactual({...fixture(),fontesComposicao:f},'registro'));});

test('formato2 lê contexto congelado e diferencia legado sem registro',()=>{
 const f={...fixture(),schemaVersao:2,motorVersao:'food06-relatorio-factual-v2',contextoClinico:{estado:'resumo_documentado',resumo:{schemaVersao:1,dataAnalise:'2026-11-06',idadeAnos:36,populacaoReferencia:'feminina',mesmoDiaPlanejado:false,tabagismo:'nao_informado',motivos:[]}}};
 const r=lerRelatorioFactual(f,'registro') as unknown as {contextoRegistrado:{dataAnalise:string};motorVersao:string};assert.equal(r.contextoRegistrado.dataAnalise,'2026-11-06');assert.equal(r.motorVersao,'food06-relatorio-factual-v2');
 assert.doesNotThrow(()=>lerRelatorioFactual({...f,contextoClinico:{estado:'nao_registrado'}},'registro'));
 assert.throws(()=>lerRelatorioFactual({...f,contextoClinico:{estado:'resumo_documentado',resumo:{...f.contextoClinico.resumo,nascimento:'1990-01-01'}}},'registro'));
});

test('pedido explícito de formato2 exige a mesma versão na resposta',async()=>{
 const {obterRelatorioFactual}=await import('../lib/relatorio-factual');const original=globalThis.fetch;try{globalThis.fetch=async(_url,init)=>{assert.deepEqual(JSON.parse(String(init?.body)),{registroId:'registro',versaoRelatorio:2});return Response.json({...fixture(),schemaVersao:2,motorVersao:'food06-relatorio-factual-v2',contextoClinico:{estado:'nao_registrado'}});};assert.equal((await obterRelatorioFactual('paciente','registro',new AbortController().signal,2)).motorVersao,'food06-relatorio-factual-v2');globalThis.fetch=async()=>Response.json(fixture());await assert.rejects(()=>obterRelatorioFactual('paciente','registro',new AbortController().signal,2));}finally{globalThis.fetch=original;}
});

/* FOOD06 M01 — origem por nutriente no relatório formato 2 (aditivo). */
function v2Com(fontes?:unknown){const f={...fixture(),schemaVersao:2,motorVersao:'food06-relatorio-factual-v2',contextoClinico:{estado:'nao_registrado'}};return fontes===undefined?f:{...f,fontesPorNutriente:fontes};}
function fontesPorNutrienteOk(){return {schemaVersao:1,vinculo:'origem_do_registro_de_composicao',nutrientes:Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,c.codigo==='ferroMg'?{contribuintes:1,fontes:[{tipo:'manual',quantidade:1}],semOrigemDocumentada:0,fontesNaoDetalhadas:0}:{contribuintes:0,fontes:[],semOrigemDocumentada:0,fontesNaoDetalhadas:0}]))};}
type LinhasRelatorio={linhas:{codigo:string;valor?:number;origem?:{contribuintes:number;fontes:{tipo:string;quantidade:number}[]}}[]};
test('formato2 anexa a origem registrada por nutriente sem alterar valor nem cobertura (zero conhecido preservado)',()=>{
 const r=lerRelatorioFactual(v2Com(fontesPorNutrienteOk()),'registro') as unknown as LinhasRelatorio;
 const ferro=r.linhas.find(l=>l.codigo==='ferroMg')!;
 assert.equal(ferro.valor,0);assert.deepEqual(ferro.origem,{contribuintes:1,fontes:[{tipo:'manual',quantidade:1}],semOrigemDocumentada:0,fontesNaoDetalhadas:0});
 assert.deepEqual(r.linhas.find(l=>l.codigo==='selenioMcg')!.origem,{contribuintes:0,fontes:[],semOrigemDocumentada:0,fontesNaoDetalhadas:0});
 assert.equal(r.linhas.find(l=>l.codigo==='selenioMcg')!.valor,undefined);
});
test('formato2 anterior, sem origem por nutriente, continua legível e não presume origem',()=>{
 const r=lerRelatorioFactual(v2Com(),'registro') as unknown as LinhasRelatorio;
 assert.ok(r.linhas.every(l=>l.origem===undefined));
});
test('formato1 não carrega origem por nutriente: campo presente é recusado',()=>{
 assert.throws(()=>lerRelatorioFactual({...fixture(),fontesPorNutriente:fontesPorNutrienteOk()},'registro'),/relatório/);
});
test('formato2 recusa origem por nutriente inconsistente com a cobertura do mesmo relatório',()=>{
 const f=fontesPorNutrienteOk();f.nutrientes.ferroMg.contribuintes=0;f.nutrientes.ferroMg.fontes=[] as never;
 assert.throws(()=>lerRelatorioFactual(v2Com(f),'registro'),/interpretar|conferir/);
 const g=fontesPorNutrienteOk();g.nutrientes.calcioMg.contribuintes=1;g.nutrientes.calcioMg.semOrigemDocumentada=1;
 assert.throws(()=>lerRelatorioFactual(v2Com(g),'registro'),/interpretar|conferir/);
 const h=fontesPorNutrienteOk();(h as {vinculo:string}).vinculo='medicao_por_nutriente';
 assert.throws(()=>lerRelatorioFactual(v2Com(h),'registro'),/interpretar|conferir/);
});
test('formato2 não replica campos extras de origem por nutriente',()=>{
 const f=fontesPorNutrienteOk();Object.assign(f,{segredo:'CANARIO_RAIZ'});Object.assign(f.nutrientes.ferroMg,{segredo:'CANARIO_NUT'});Object.assign(f.nutrientes.ferroMg.fontes[0],{hashConteudo:'CANARIO_HASH'});
 assert.ok(!/CANARIO/.test(JSON.stringify(lerRelatorioFactual(v2Com(f),'registro'))));
});

function fixtureComDoisItens(){
 const f=fixture() as unknown as {analise:{calculo:{nutrientes:Record<string,{itensIncluidos:number;itensComValor:number;estado:string}>};cobertura:{nutrientes:Record<string,{estado:string;total?:number;contagens:Record<string,number>;causas:unknown[]}>}}};
 for(const m of Object.values(f.analise.calculo.nutrientes)){m.itensIncluidos=2;if(m.estado==='completo')m.itensComValor=2;}
 for(const [codigo,n] of Object.entries(f.analise.cobertura.nutrientes)){
  const conhecidos=codigo==='ferroMg'?2:0;
  n.contagens={incluidos:2,conhecidos,semComposicao:2-conhecidos,incompativeis:0,naoResolvidos:0};
  n.causas=conhecidos===2?[]:[{codigo:'ausente',quantidade:2}];
 }
 return f as unknown as Record<string,unknown>;
}
test('M01 resumo global do relatório lê o código da fonte e separa fontes que só diferem por ele',()=>{
 const f=fixtureComDoisItens();
 const resumo=(fontes:unknown[],itens=2)=>({estado:'resumo_documentado',itensIncluidos:itens,semReferencia:0,fontesNaoDetalhadas:0,fontes});
 const ok=lerRelatorioFactual({...f,fontesComposicao:resumo([{tipo:'USDA',codigo:'usda_fdc_foundation',versao:'2025-10-30',quantidade:1},{tipo:'USDA',codigo:'usda_fdc_sr_legacy',versao:'2025-10-30',quantidade:1}])},'registro') as unknown as {fontes:{tipo:string;codigo?:string}[]};
 assert.deepEqual(ok.fontes.map(x=>x.codigo),['usda_fdc_foundation','usda_fdc_sr_legacy']);
 assert.throws(()=>lerRelatorioFactual({...f,fontesComposicao:resumo([{tipo:'USDA',codigo:'com espaço',versao:'1',quantidade:2}])},'registro'));
 assert.throws(()=>lerRelatorioFactual({...f,fontesComposicao:resumo([{tipo:'USDA',codigo:'usda_fdc_foundation',versao:'1',quantidade:1},{tipo:'USDA',codigo:'usda_fdc_foundation',versao:'1',quantidade:1}])},'registro'));
 assert.doesNotThrow(()=>lerRelatorioFactual({...f,fontesComposicao:resumo([{tipo:'TACO',versao:'taco-4a-cmvcol-taco3-v1',quantidade:2}])},'registro'));
});
