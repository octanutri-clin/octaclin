export interface ReferenciaOrigemContribuicao {versaoId:string;versaoNumero:number;refeicaoId:string;itemId:string}
export interface OrigemContribuicao {nome:string;numero:number;itens:{id:string;descricao:string;quantidade:number;unidade:string;gramas:number}[]}
/** Somente a refeição publicada identificada; nenhuma observação/contexto clínico. */
export function lerOrigemContribuicao(valor:unknown,referencia:ReferenciaOrigemContribuicao):OrigemContribuicao {
 const falhar=():never=>{throw new Error('Origem publicada indisponível.');};
 const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:falhar();
 const texto=(v:unknown,max:number)=>typeof v==='string'&&v.trim()&&v.length<=max?v:falhar();
 const numero=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:falhar();
 const v=obj(valor);
 if(v.id!==referencia.versaoId||v.numero!==referencia.versaoNumero||v.status!=='publicada'||v.descartadaEm||typeof v.publicadaEm!=='string'||!Number.isFinite(Date.parse(v.publicadaEm))||!Array.isArray(v.refeicoes)||v.refeicoes.length>50)return falhar();
 const refeicoes=v.refeicoes.map(obj),m=refeicoes.filter(r=>r.id===referencia.refeicaoId);
 if(m.length!==1||!Array.isArray(m[0].itens)||!m[0].itens.length||m[0].itens.length>100)return falhar();
 const vistos=new Set<string>();
 const itens=m[0].itens.map(raw=>{
  const i=obj(raw),id=texto(i.id,64);
  if(vistos.has(id))return falhar();vistos.add(id);
  return {id,descricao:texto(i.descricao,1000),quantidade:numero(i.quantidade),unidade:texto(i.unidade,40),gramas:numero(i.porcaoGramas)};
 });
 if(!vistos.has(referencia.itemId))return falhar();
 return {nome:texto(m[0].nome,200),numero:referencia.versaoNumero,itens};
}
