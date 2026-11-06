import assert from 'node:assert/strict';
import test from 'node:test';
import { lerPaginaContribuicoes, mesmaCoberturaFactual } from '../lib/contribuicoes-micronutrientes';
const pedido={selecoes:[{planoId:'p1',versaoIdEsperada:'v1',ativacaoRevisaoEsperada:1,identidadesRefeicoes:['r1']}],codigo:'ferroMg' as const,pagina:1,limite:1};
const cobertura=(valor=2,n=1)=>({codigo:'ferroMg',unidade:'mg',estado:'COMPLETO',total:valor,contagens:{incluidos:n,conhecidos:n,semComposicao:0,incompativeis:0,naoResolvidos:0},causas:[]});
function resposta(){return {schemaVersao:1,motorVersao:'food06-contribuicoes-v1',codigo:'ferroMg',pagina:1,limite:1,total:2,calculadoEm:'2026-10-31T12:00:00Z',publicacoes:[{planoId:'p1',versaoId:'v1',ativacaoRevisao:1}],comparacoes:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},cobertura:cobertura(4,2),refeicoes:[{planoId:'p1',identidadeRefeicao:'r1',nome:'Almoço sintético',cobertura:cobertura(4,2),itens:[{itemId:'10000000-0000-4000-8000-000000000001',descricao:'Feijão sintético',quantidade:'1.000',unidade:'porção',porcaoGramas:'100.000',cobertura:cobertura(),contextoInterno:'canario'}]}]};}
test('FOOD06 detalhe projeta página mantendo denominador integral e descartando campos internos',()=>{
 const r=lerPaginaContribuicoes(resposta(),pedido);assert.equal(r.total,2);assert.equal(r.cobertura.valor,4);assert.equal(r.refeicoes[0].itens[0].cobertura.valor,2);assert.equal(r.refeicoes[0].itens[0].gramas,'100.000');assert.ok(!JSON.stringify(r).includes('canario'));
});
test('FOOD06 detalhe rejeita página, código, revisão, identidade, contagens ou quantidades incoerentes',()=>{
 const casos=[(r:ReturnType<typeof resposta>)=>r.pagina=2,(r:ReturnType<typeof resposta>)=>r.codigo='calcioMg',(r:ReturnType<typeof resposta>)=>r.publicacoes[0].ativacaoRevisao=2,(r:ReturnType<typeof resposta>)=>r.refeicoes[0].identidadeRefeicao='alheia',(r:ReturnType<typeof resposta>)=>r.total=1,(r:ReturnType<typeof resposta>)=>r.refeicoes[0].itens[0].porcaoGramas='NaN',(r:ReturnType<typeof resposta>)=>r.refeicoes[0].itens=[]];
 for(const adulterar of casos){const r=resposta();adulterar(r);assert.throws(()=>lerPaginaContribuicoes(r,pedido));}
});
test('FOOD06 detalhe distingue ausência de zero e aceita fim da paginação',()=>{
 const r=resposta();Object.assign(r.cobertura,{estado:'PARCIAL',total:undefined,quantidadeConhecida:0,contagens:{incluidos:2,conhecidos:1,semComposicao:1,incompativeis:0,naoResolvidos:0},causas:[{codigo:'ausente',quantidade:1}]});
 r.refeicoes=[];r.pagina=3;const p=lerPaginaContribuicoes(r,{...pedido,pagina:3});assert.equal(p.cobertura.valor,0);assert.equal(p.refeicoes.length,0);
});

test('FOOD06 rejeita parcelas maiores que seus agregados e contagens contraditórias',()=>{
 for(const alterar of [
  (r:ReturnType<typeof resposta>)=>{r.cobertura.total=0;},
  (r:ReturnType<typeof resposta>)=>{r.refeicoes[0].itens[0].cobertura.total=100;},
  (r:ReturnType<typeof resposta>)=>{r.refeicoes[0].cobertura.total=5;},
 ]) { const r=resposta();alterar(r);assert.throws(()=>lerPaginaContribuicoes(r,pedido)); }
});

test('FOOD06 reconcilia refeição inteiramente exibida e categorias conhecidas/ausentes',()=>{
 const r=resposta();Object.assign(r.refeicoes[0].cobertura,{contagens:{incluidos:1,conhecidos:1,semComposicao:0,incompativeis:0,naoResolvidos:0}});assert.throws(()=>lerPaginaContribuicoes(r,pedido));
 const s=resposta();Object.assign(s.cobertura,{estado:'PARCIAL',total:undefined,quantidadeConhecida:2,contagens:{incluidos:2,conhecidos:1,semComposicao:1,incompativeis:0,naoResolvidos:0},causas:[{codigo:'ausente',quantidade:1}]});assert.throws(()=>lerPaginaContribuicoes(s,pedido));
 Object.assign(s.refeicoes[0].cobertura,s.cobertura);assert.equal(lerPaginaContribuicoes(s,pedido).cobertura.valor,2);
});

test('FOOD06 compara a cobertura integral da tabela com detalhe, incluindo causas e contagens',()=>{
 const a=lerPaginaContribuicoes(resposta(),pedido).cobertura;
 a.estado='PARCIAL';a.valor=0;a.contagens={incluidos:3,conhecidos:1,semComposicao:2,incompativeis:0,naoResolvidos:0};a.causas=[{codigo:'ausente',quantidade:2}];
 const b=structuredClone(a);b.contagens.conhecidos=2;b.contagens.semComposicao=1;b.causas[0].quantidade=1;assert.equal(mesmaCoberturaFactual(a,b),false);
 const c=structuredClone(a);c.causas[0].codigo='traco';assert.equal(mesmaCoberturaFactual(a,c),false);
 a.causas=[{codigo:'ausente',quantidade:1},{codigo:'nao_analisado',quantidade:1}];const d=structuredClone(a);d.causas.reverse();assert.equal(mesmaCoberturaFactual(a,d),true);
});

test('FOOD06 detalhe projeta fonte/preparo e exige ordem, posições e origem exatas',()=>{
 const r=resposta();Object.assign(r,{ordem:'contribuicao'});
 Object.assign(r.refeicoes[0],{refeicaoId:'10000000-0000-4000-8000-000000000003',versaoNumero:1});
 Object.assign(r.refeicoes[0].itens[0],{posicaoSelecao:1,composicao:{origem:'catalogo',preparacao:'Cozido',fonte:{codigo:'TACO',nome:'Tabela sintética',versao:'v1',hash:'canario'},baseGramas:100,contexto:'canario'}});
 const pedidoOrdenado={...pedido,ordem:'contribuicao' as const};
 const p=lerPaginaContribuicoes(r,pedidoOrdenado);
 assert.match(JSON.stringify(p),/Cozido/);assert.ok(!JSON.stringify(p).includes('canario'));
 const errada=structuredClone(r);Object.assign(errada,{ordem:'plano'});assert.throws(()=>lerPaginaContribuicoes(errada,pedidoOrdenado));
 Object.assign(r.refeicoes[0].itens[0],{posicaoSelecao:2});assert.throws(()=>lerPaginaContribuicoes(r,pedidoOrdenado));
});

test('FOOD06 original exige versão publicada, refeição e item exatos e descarta contexto',async()=>{
 const {lerOrigemContribuicao}=await import('../lib/origem-contribuicao');
 const ref={versaoId:'v1',versaoNumero:1,refeicaoId:'r1',itemId:'i1'};
 const v={id:'v1',numero:1,status:'publicada',publicadaEm:'2026-10-31T12:00:00Z',objetivos:'CANARIO',refeicoes:[{id:'r1',nome:'Almoço',itens:[{id:'i1',descricao:'Alimento',quantidade:1.5,unidade:'porção',porcaoGramas:75,composicaoSnapshot:{contexto:'CANARIO'}}]}]};
 const r=lerOrigemContribuicao(v,ref);assert.equal(r.itens[0].gramas,75);assert.ok(!JSON.stringify(r).includes('CANARIO'));
 for(const mudar of [(x:typeof v)=>x.id='v2',(x:typeof v)=>x.status='rascunho',(x:typeof v)=>x.refeicoes[0].id='outra',(x:typeof v)=>x.refeicoes[0].itens[0].id='outro',(x:typeof v)=>x.refeicoes[0].itens[0].quantidade=NaN]){
  const x=structuredClone(v);mudar(x);assert.throws(()=>lerOrigemContribuicao(x,ref));
 }
});

test('FOOD06 ordem global recusa posições com quantidades conhecidas invertidas',()=>{
 const r=resposta();Object.assign(r,{ordem:'contribuicao',limite:2});
 const a=r.refeicoes[0].itens[0];a.cobertura.total=1;Object.assign(a,{posicaoSelecao:1});
 const b=structuredClone(a);b.itemId='10000000-0000-4000-8000-000000000002';b.cobertura.total=3;Object.assign(b,{posicaoSelecao:2});r.refeicoes[0].itens.push(b);
 assert.throws(()=>lerPaginaContribuicoes(r,{...pedido,limite:2,ordem:'contribuicao'}));
});

test('FOOD06 ordem global rejeita desconhecido antes de conhecido, sem converter ausência em zero',()=>{
 const r=resposta();Object.assign(r,{ordem:'contribuicao',limite:2});
 const parcial={codigo:'ferroMg',unidade:'mg',estado:'PARCIAL',quantidadeConhecida:3,contagens:{incluidos:2,conhecidos:1,semComposicao:1,incompativeis:0,naoResolvidos:0},causas:[{codigo:'ausente',quantidade:1}]};
 Object.assign(r.cobertura,parcial,{total:undefined});Object.assign(r.refeicoes[0].cobertura,parcial,{total:undefined});
 const a=r.refeicoes[0].itens[0];const b=structuredClone(a);b.itemId='10000000-0000-4000-8000-000000000002';b.cobertura.total=3;Object.assign(b,{posicaoSelecao:2});
 Object.assign(a,{posicaoSelecao:1});Object.assign(a.cobertura,{estado:'DESCONHECIDO',total:undefined,contagens:{incluidos:1,conhecidos:0,semComposicao:1,incompativeis:0,naoResolvidos:0},causas:[{codigo:'ausente',quantidade:1}]});r.refeicoes[0].itens.push(b);
 assert.throws(()=>lerPaginaContribuicoes(r,{...pedido,limite:2,ordem:'contribuicao'}));
});
