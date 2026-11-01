import {prepararPrevia,previaFactual} from './food06-previa.mjs';
export const receitaId='10000000-0000-4000-8000-000000000081';
export async function prepararReceitaPrevia(page,compartilhado){
 const c=await prepararPrevia(page,compartilhado);
 c.detalhe.draft.documentoEdicao.refeicoes[0].itens[0].micronutrientesPor100g.calcioMg=0;
 const ingrediente={descricao:'Ingrediente da receita sintética',quantidade:3,unidade:'porção',porcaoGramas:300,nutrientesPor100g:{energiaKcal:100,proteinasG:10,carboidratosG:20,gordurasG:2},micronutrientesPor100g:{ferroMg:2},substituicoes:[]};
 const receita={id:receitaId,nome:'Receita sintética M04',origem:'pessoal',tipo:'receita',categoria:'Lanche',versaoAtual:3,totalItens:1,atualizadoEm:'2026-10-30T12:00:00Z',metadados:{schemaVersao:1,baseQuantidades:'receita_inteira',rendimentoPorcoes:3},instrucoes:'Preparação sintética',itens:[ingrediente],alimentosIndisponiveis:[]};
 let falha=0;const porcionamentos=[];
 await page.route(u=>u.pathname.startsWith('/api/planos-alimentares/receitas'),async r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/previa-porcionamento')){
   const p=r.request().postDataJSON();porcionamentos.push(p);const quantidade=p.porcoesDesejadas,g=quantidade*100;
   return r.fulfill({status:200,json:{receitaId,versao:3,estado:'calculavel',baseQuantidades:'receita_inteira',rendimentoOriginalPorcoes:3,porcoesDesejadas:quantidade,fatorExato:{numerador:String(quantidade),denominador:'3'},fingerprint:'b'.repeat(64),itens:[{...ingrediente,quantidade,porcaoGramas:g}],avisos:[],fontes:[],denominador:{porcoes:quantidade,descricao:'Total para as porções solicitadas'},totais:{energiaKcal:{estado:'conhecido',unidade:'kcal',valor:g},proteinasG:{estado:'conhecido',unidade:'g',valor:g/10},carboidratosG:{estado:'conhecido',unidade:'g',valor:g/5},gordurasG:{estado:'conhecido',unidade:'g',valor:g/50}}}});
  }
  return r.fulfill({status:200,json:path.endsWith(`/${receitaId}`)?receita:{itens:[receita],total:1,pagina:1,limite:25}});
 });
 await page.route(u=>u.pathname.includes('/rascunho/previa-micronutrientes'),async r=>{
  const p=r.request().postDataJSON();
  if(p.operacao.tipo!=='inserir_receita')return r.fallback();
  if(r.request().url().endsWith('/confirmar')){
   c.confirmacoes.push(p);if(falha)return r.fulfill({status:falha,json:{message:'CANARIO_PRIVADO'}});
   c.detalhe.draft.documentoEdicao.refeicoes[0].itens.push({...ingrediente,chaveCliente:'receita-aplicada',quantidade:p.operacao.porcoesDesejadas,porcaoGramas:p.operacao.porcoesDesejadas*100});c.detalhe.draft.rascunhoRevisao++;
   return r.fulfill({status:200,json:c.detalhe.draft});
  }
  c.pedidos.push(p);const resposta=previaFactual({...p,operacao:{porcaoGramas:100+100*p.operacao.porcoesDesejadas}});
  resposta.comparacao.antes.cobertura.nutrientes.calcioMg={codigo:'calcioMg',unidade:'mg',estado:'COMPLETO',total:0,contagens:{incluidos:1,conhecidos:1,semComposicao:0,incompativeis:0,naoResolvidos:0},causas:[]};
  resposta.comparacao.depois.cobertura.nutrientes.calcioMg={codigo:'calcioMg',unidade:'mg',estado:'PARCIAL',quantidadeConhecida:0,contagens:{incluidos:2,conhecidos:1,semComposicao:1,incompativeis:0,naoResolvidos:0},causas:[{codigo:'ausente',quantidade:1}]};
  return r.fulfill({status:200,json:resposta});
 });
 await page.reload({waitUntil:'domcontentloaded'});
 return {...c,porcionamentos,falhar:status=>{falha=status;}};
}
export async function abrirReceita(page){
 await page.getByRole('combobox',{name:'Biblioteca',exact:true}).selectOption({label:'Receita sintética M04 - Lanche - Receita - 1 item(ns)'});
 await page.getByLabel(/Porções para inserir/).fill('1.5');
 await page.getByRole('button',{name:'Inserir',exact:true}).click();
 return page.getByRole('dialog',{name:'Conferir inserção da receita'});
}
