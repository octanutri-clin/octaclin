export const MOTIVOS_CONTEXTO_REGISTRADO = {
 nascimento_nao_informado:'Nascimento não informado na captura.',nascimento_futuro:'Nascimento posterior à data da análise.',idade_fora_do_escopo:'Idade fora do escopo previsto.',populacao_nao_confirmada:'População de referência não confirmada.',gestacao_fora_do_escopo:'Gestação fora do escopo previsto.',lactacao_fora_do_escopo:'Lactação fora do escopo previsto.',fisiologia_nao_confirmada:'Gestação ou lactação não confirmadas.',aplicabilidade_nao_confirmada:'Aplicabilidade da população não confirmada.',confirmacao_invalida:'Confirmação inválida na captura.'
} as const;
export interface ContextoRegistradoFactual {schemaVersao:1;dataAnalise:string;idadeAnos?:number;populacaoReferencia?:'masculina'|'feminina';mesmoDiaPlanejado:boolean;tabagismo:'sim'|'nao'|'nao_informado';motivos:(keyof typeof MOTIVOS_CONTEXTO_REGISTRADO)[]}
export function lerContextoRegistradoFactual(valor:unknown):ContextoRegistradoFactual {
 const falhar=():never=>{throw new Error('Contexto indisponível.');};
 if(!valor||typeof valor!=='object'||Array.isArray(valor)||![Object.prototype,null].includes(Object.getPrototypeOf(valor)))return falhar();
 const campos=['schemaVersao','dataAnalise','idadeAnos','populacaoReferencia','mesmoDiaPlanejado','tabagismo','motivos'];
 const descritores=Object.getOwnPropertyDescriptors(valor);
 if(Reflect.ownKeys(valor).some(k=>typeof k!=='string'||!campos.includes(k))||Object.values(descritores).some(d=>!d.enumerable||!Object.hasOwn(d,'value')))return falhar();
 const c=valor as Record<string,unknown>;
 if(c.schemaVersao!==1||typeof c.dataAnalise!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(c.dataAnalise)||!Number.isFinite(Date.parse(c.dataAnalise+'T00:00:00.000Z'))||new Date(c.dataAnalise+'T00:00:00.000Z').toISOString().slice(0,10)!==c.dataAnalise||
  (c.idadeAnos!==undefined&&(!Number.isSafeInteger(c.idadeAnos)||Number(c.idadeAnos)<0||Number(c.idadeAnos)>9999))||
  (c.populacaoReferencia!==undefined&&!['masculina','feminina'].includes(c.populacaoReferencia as string))||typeof c.mesmoDiaPlanejado!=='boolean'||!['sim','nao','nao_informado'].includes(c.tabagismo as string)||!Array.isArray(c.motivos))return falhar();
 const motivos=c.motivos;
 if(Object.getPrototypeOf(motivos)!==Array.prototype||motivos.length>9||Object.getOwnPropertySymbols(motivos).length||Object.keys(motivos).length!==motivos.length||Object.entries(Object.getOwnPropertyDescriptors(motivos)).some(([k,d])=>k!=='length'&&(!Object.hasOwn(d,'value')||!d.enumerable))||new Set(motivos).size!==motivos.length||motivos.some(m=>typeof m!=='string'||!Object.hasOwn(MOTIVOS_CONTEXTO_REGISTRADO,m)))return falhar();
 return {schemaVersao:1,dataAnalise:c.dataAnalise,...(c.idadeAnos===undefined?{}:{idadeAnos:c.idadeAnos as number}),...(c.populacaoReferencia===undefined?{}:{populacaoReferencia:c.populacaoReferencia as 'masculina'|'feminina'}),mesmoDiaPlanejado:c.mesmoDiaPlanejado,tabagismo:c.tabagismo as ContextoRegistradoFactual['tabagismo'],motivos:[...motivos]};
}
