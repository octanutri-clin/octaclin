import {ajudaSintetica} from '../../../scripts/fixtures/ajuda-dietetica.ts';
import { prepararConsole,pacienteId,planoIds } from './console-pa06.mjs';
export const planoId=planoIds[0];
const micros=['calcioMg','magnesioMg','manganesMg','fosforoMg','ferroMg','potassioMg','cobreMg','zincoMg','selenioMcg','retinolMcg','vitaminaAReMcg','vitaminaARaeMcg','tiaminaMg','riboflavinaMg','vitaminaB6Mg','niacinaMg','niacinaNeMg','vitaminaB12Mcg','folatoDfeMcg','vitaminaDMcg','vitaminaEAlfaTocoferolMg','vitaminaCMg'];
export function previaFactual(pedido){
 const gramas=pedido.operacao.porcaoGramas;
 const estado=g=>({calculo:{nutrientes:Object.fromEntries(['energiaKcal','proteinasG','carboidratosG','gordurasG'].map(c=>[c,{codigo:c,unidade:c==='energiaKcal'?'kcal':'g',estado:'completo',total:g,itensComValor:1,itensIncluidos:1}]))},cobertura:{schemaVersao:1,nutrientes:Object.fromEntries(micros.map(c=>[c,{codigo:c,unidade:c.endsWith('Mcg')?'mcg':'mg',estado:c==='ferroMg'?'COMPLETO':'DESCONHECIDO',...(c==='ferroMg'?{total:g/50}:{}),contagens:{incluidos:1,conhecidos:c==='ferroMg'?1:0,semComposicao:c==='ferroMg'?0:1,incompativeis:0,naoResolvidos:0},causas:c==='ferroMg'?[]:[{codigo:'ausente',quantidade:1}]}]))}});
 const codigos=['energiaKcal','proteinasG','carboidratosG','gordurasG',...micros];
 return {ajuda:ajudaSintetica(),schemaVersao:1,motorVersao:'food06-previa-api-v1',escopo:'rascunho_refeicoes_ativas',rascunhoId:pedido.rascunhoIdEsperado,rascunhoRevisao:pedido.rascunhoRevisaoEsperada,ativacaoRevisao:pedido.ativacaoRevisaoEsperada,fingerprint:'a'.repeat(64),avisos:['fontes_resolvidas_como_no_salvamento'],comparacao:{schemaVersao:1,motorVersao:'food06-previa-factual-v1',referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},antes:estado(100),depois:estado(gramas),diferencas:Object.fromEntries(codigos.map(c=>[c,{codigo:c,unidade:c==='energiaKcal'?'kcal':c.endsWith('Mcg')?'mcg':c.endsWith('Mg')?'mg':'g',delta:micros.includes(c)&&c!=='ferroMg'?{estado:'indisponivel',motivo:'composicao_incompleta'}:{estado:'calculavel',diferenca:c==='ferroMg'?(gramas-100)/50:gramas-100,percentual:{estado:'calculavel',valor:gramas-100,arredondado:false}}}]))}};
}
export async function prepararPrevia(page,compartilhado){
 await prepararConsole(page);
 const documento={schemaVersao:1,avaliacaoAntropometricaId:'av-sintetica',formula:'mifflin_st_jeor_1990',fatorAtividade:1.4,carboidratosBasisPoints:5000,proteinasBasisPoints:2000,gordurasBasisPoints:3000,possuiCondicaoEspecial:false,aplicabilidadeFormulaConfirmada:true,objetivos:'Planejamento sintético',refeicoes:[{chaveCliente:'r-sintetica',nome:'Almoço sintético',itens:[{chaveCliente:'i-sintetico',descricao:'Alimento sintético',quantidade:1,unidade:'porção',porcaoGramas:100,nutrientesPor100g:{energiaKcal:100,proteinasG:10,carboidratosG:20,gordurasG:2},micronutrientesPor100g:{ferroMg:2},substituicoes:[]}]}]};
 const d=compartilhado?.detalhe??{id:planoId,pacienteId,titulo:'Plano A sintético',profissionalId:'profissional-sintetico',ativoParaPaciente:true,ativacaoRevisao:1,historico:[],draft:{id:'draft-sintetico',numero:2,status:'rascunho',rascunhoRevisao:1,edicaoEstado:'materializada',documentoEdicao:documento,apresentacaoEstado:'padrao',ativoParaPaciente:true,ativacaoRevisao:1,ativacaoEdicao:[{chaveCliente:'r-sintetica',identidadeId:'r-id',ativa:true}],refeicoes:[]}};
 compartilhado?.ajustarDetalhe?.(d);
 const pedidos=[],confirmacoes=[],saves=[];let falha=0;
 await page.route(u=>[planoId,d.id].some(id=>u.pathname===`/api/pacientes/${pacienteId}/planos-alimentares/${id}`),r=>r.fulfill({status:200,json:d}));
 await page.route(u=>u.pathname.endsWith('/rascunho/edicao'),r=>{const p=r.request().postDataJSON();saves.push(p);d.draft.rascunhoRevisao++;d.draft.documentoEdicao=p.documento;return r.fulfill({status:200,json:d.draft});});
 await page.route(u=>u.pathname.includes('/rascunho/previa-micronutrientes'),async r=>{
  const p=r.request().postDataJSON();
  if(r.request().url().endsWith('/confirmar')){
   confirmacoes.push(p);if(falha)return r.fulfill({status:falha,json:{message:'CANARIO_PRIVADO'}});
   d.draft.documentoEdicao.refeicoes[0].itens[0].porcaoGramas=p.operacao.porcaoGramas;d.draft.documentoEdicao.refeicoes[0].itens[0].quantidade=p.operacao.quantidade;d.draft.rascunhoRevisao++;
   return r.fulfill({status:200,json:d.draft});
  }
  pedidos.push(p);return r.fulfill({status:200,json:previaFactual(p)});
 });
 await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/Expandir refeição/}).first().click();
 return {pedidos,confirmacoes,saves,falhar:status=>{falha=status;},detalhe:d};
}
