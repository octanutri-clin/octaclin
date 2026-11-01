import type { CalcularCombinadoEntradaApi, CodigoMicronutrienteApi } from './plano-alimentar-api';
import { lerLinhaMicronutrienteFactual, validarPublicacoesFactuais, type LinhaMicronutrienteFactual } from './micronutrientes-factuais';
export interface ItemContribuicao { id:string; descricao:string; quantidade:string; unidade:string; gramas:string; cobertura:LinhaMicronutrienteFactual }
export interface PaginaContribuicoes { pagina:number; limite:number; total:number; cobertura:LinhaMicronutrienteFactual; refeicoes:{planoId:string;id:string;nome:string;cobertura:LinhaMicronutrienteFactual;itens:ItemContribuicao[]}[] }
export interface PedidoContribuicoes extends CalcularCombinadoEntradaApi { codigo:CodigoMicronutrienteApi; pagina:number;limite:number }
export function mesmaCoberturaFactual(a:LinhaMicronutrienteFactual,b:LinhaMicronutrienteFactual):boolean {
 const causas=(l:LinhaMicronutrienteFactual)=>JSON.stringify(l.causas.map(c=>[c.codigo,c.quantidade]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
 return a.codigo===b.codigo&&a.unidade===b.unidade&&a.estado===b.estado&&a.valor===b.valor&&
   (['incluidos','conhecidos','semComposicao','incompativeis','naoResolvidos'] as const).every(c=>a.contagens[c]===b.contagens[c])&&causas(a)===causas(b);
}
/** Verifica a resposta; não produz totais nutricionais novos para exibição. */
function verificarAgregado(pai:LinhaMicronutrienteFactual,filhos:LinhaMicronutrienteFactual[]):void {
  const falhar=()=>{throw new Error('Página de contribuições inválida.');};
  for(const campo of ['incluidos','conhecidos','semComposicao','incompativeis','naoResolvidos'] as const){
    const soma=filhos.reduce((n,f)=>n+f.contagens[campo],0);
    if(soma>pai.contagens[campo])falhar();
  }
  const soma=filhos.reduce((n,f)=>n+(f.valor??0),0);
  if(!Number.isFinite(soma))falhar();
  const conhecidos=filhos.reduce((n,f)=>n+f.contagens.conhecidos,0);
  if(conhecidos>0){
    if(pai.valor===undefined)falhar();
    const valor=pai.valor!;
    // Margem exclusiva da serialização/operação binária, abaixo da escala8
    // usual; nenhuma tolerância de adequação clínica é introduzida.
    const margem=1e-9+Number.EPSILON*Math.max(valor,soma)*(filhos.length+1)*2;
    if((valor===0&&soma!==0)||soma>valor+margem||(conhecidos===pai.contagens.conhecidos&&Math.abs(soma-valor)>margem))falhar();
  }
}
export function lerPaginaContribuicoes(valor:unknown,pedido:PedidoContribuicoes):PaginaContribuicoes {
  const falhar=():never=>{throw new Error('Página de contribuições inválida.');};
  const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))return falhar();return v as Record<string,unknown>;};
  const texto=(v:unknown,max:number):string=>{if(typeof v!=='string'||!v.trim()||v.length>max)return falhar();return v;};
  const quantidade=(v:unknown):string=>{const t=texto(v,24);if(!/^\d+(?:\.\d+)?$/.test(t)||!Number.isFinite(Number(t))||Number(t)<=0)return falhar();return t;};
  const r=obj(valor),c=obj(r.comparacoes);
  if(r.schemaVersao!==1||r.motorVersao!=='food06-contribuicoes-v1'||r.codigo!==pedido.codigo||r.pagina!==pedido.pagina||r.limite!==pedido.limite||!Number.isSafeInteger(r.total)||(r.total as number)<0||(r.total as number)>10000||typeof r.calculadoEm!=='string'||!Number.isFinite(Date.parse(r.calculadoEm))||c.estado!=='indisponivel'||c.motivo!=='referencias_nao_habilitadas')return falhar();
  validarPublicacoesFactuais(r.publicacoes,pedido);
  const cobertura=lerLinhaMicronutrienteFactual(r.cobertura,pedido.codigo),total=r.total as number;
  if(cobertura.contagens.incluidos!==total||!Array.isArray(r.refeicoes)||r.refeicoes.length>pedido.limite)return falhar();
  const ids=new Set<string>(),refeicoesVistas=new Set<string>();let incluidos=0;
  const refeicoes=r.refeicoes.map(v=>{
    const m=obj(v),planoId=texto(m.planoId,64),id=texto(m.identidadeRefeicao,64),chave=planoId.toLowerCase()+':'+id.toLowerCase();
    if(refeicoesVistas.has(chave)||!pedido.selecoes.some(s=>s.planoId.toLowerCase()===planoId.toLowerCase()&&s.identidadesRefeicoes.some(r=>r.toLowerCase()===id.toLowerCase())))return falhar();
    refeicoesVistas.add(chave);
    const coberturaRefeicao=lerLinhaMicronutrienteFactual(m.cobertura,pedido.codigo);
    if(!Array.isArray(m.itens)||!m.itens.length||m.itens.length>pedido.limite||coberturaRefeicao.contagens.incluidos<m.itens.length||coberturaRefeicao.contagens.incluidos>total)return falhar();
    const itens=m.itens.map(v=>{
      const i=obj(v),itemId=texto(i.itemId,64);
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)||ids.has(itemId.toLowerCase()))return falhar();
      ids.add(itemId.toLowerCase());incluidos++;
      const coberturaItem=lerLinhaMicronutrienteFactual(i.cobertura,pedido.codigo);
      if(coberturaItem.contagens.incluidos!==1)return falhar();
      return {id:itemId,descricao:texto(i.descricao,1000),quantidade:quantidade(i.quantidade),unidade:texto(i.unidade,40),gramas:quantidade(i.porcaoGramas),cobertura:coberturaItem};
    });
    verificarAgregado(coberturaRefeicao,itens.map(i=>i.cobertura));
    return {planoId,id,nome:texto(m.nome,200),cobertura:coberturaRefeicao,itens};
  });
  if(incluidos!==Math.min(pedido.limite,Math.max(0,total-(pedido.pagina-1)*pedido.limite)))return falhar();
  verificarAgregado(cobertura,refeicoes.map(r=>r.cobertura));
  return {pagina:pedido.pagina,limite:pedido.limite,total,cobertura,refeicoes};
}
