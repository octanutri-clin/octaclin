export interface AjudaDietetica {
 schemaVersao:1;conteudoVersao:'food06-ajuda-v1';autor:'OctaClin';comparacoesHabilitadas:false;
 fontes:{id:string;titulo:string;url:string;consultadaEm:string}[];
 topicos:{codigo:string;titulo:string;texto:string;detalhe?:string}[];
}
const CODIGOS=['RDA','AI','UL','planejado','parcial','indisponibilidade','limites'];
const FONTE='https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx';
function objeto(v:unknown):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length)throw new Error('objeto');
 if(Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!d.enumerable||!Object.hasOwn(d,'value')))throw new Error('objeto');
 return v as Record<string,unknown>;
}
function lista(v:unknown,n:number):unknown[]{
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length!==n||Object.getOwnPropertySymbols(v).length||Object.keys(v).length!==n)throw new Error('lista');
 if(Object.entries(Object.getOwnPropertyDescriptors(v)).some(([k,d])=>k!=='length'&&(!d.enumerable||!Object.hasOwn(d,'value')||!/^\d+$/.test(k))))throw new Error('lista');
 return v;
}
function texto(v:unknown,max:number):string{if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error('texto');return v;}
/** Metadados opcionais: inválido fica indisponível; nunca elimina fatos válidos. */
export function lerAjudaDietetica(v:unknown):AjudaDietetica|null{
 try{
  const a=objeto(v);
  if(a.schemaVersao!==1||a.conteudoVersao!=='food06-ajuda-v1'||a.autor!=='OctaClin'||a.comparacoesHabilitadas!==false)return null;
  const fontes=lista(a.fontes,1).map(v=>{
   const f=objeto(v),data=texto(f.consultadaEm,10);
   if(f.id!=='nih-ods-nutrient-recommendations'||f.url!==FONTE||!/^\d{4}-\d{2}-\d{2}$/.test(data)||new Date(data+'T00:00:00.000Z').toISOString().slice(0,10)!==data)throw new Error('fonte');
   return {id:f.id,titulo:texto(f.titulo,180),url:FONTE,consultadaEm:data};
  });
  const topicos=lista(a.topicos,7).map(v=>{
   const t=objeto(v),codigo=texto(t.codigo,40);
   if(!CODIGOS.includes(codigo))throw new Error('topico');
   return {codigo,titulo:texto(t.titulo,180),texto:texto(t.texto,1600),...(t.detalhe!==undefined?{detalhe:texto(t.detalhe,1600)}:{})};
  });
  if(new Set(topicos.map(t=>t.codigo)).size!==CODIGOS.length)return null;
  return {schemaVersao:1,conteudoVersao:'food06-ajuda-v1',autor:'OctaClin',comparacoesHabilitadas:false,fontes,topicos};
 }catch{return null;}
}
