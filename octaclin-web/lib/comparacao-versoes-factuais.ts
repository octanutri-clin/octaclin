import { lerLinhasComparacaoFactual, type LinhaPrevia } from './previa-micronutrientes-plano';
import { CAMPOS_MICRONUTRIENTES_PLANO } from './micronutrientes-plano';
import { ErroApiPlanoAlimentar, type CodigoMicronutrienteApi } from './plano-alimentar-api';
export interface PedidoComparacaoFactual { antesId:string; depoisId:string }
export type EstadoBaseFactual='igual'|'alterada'|'nao_documentada'|'incompativel';
export interface ComparacaoRegistrosFactual { linhas:LinhaPrevia[]; bases:Record<'planejamento'|'composicao_fonte'|'referencia'|'contexto',EstadoBaseFactual>; cobertura:Record<CodigoMicronutrienteApi,'igual'|'alterada'> }
function falhar():never{throw new Error('Comparação indisponível. Confira os registros e tente novamente.');}
function objeto(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return falhar();return v as Record<string,unknown>;}
export function lerComparacaoVersoesFactuais(valor:unknown,pedido:PedidoComparacaoFactual):ComparacaoRegistrosFactual{
 const r=objeto(valor),a=objeto(objeto(r.antes).registro),b=objeto(objeto(r.depois).registro),ref=objeto(r.referencias),bases=objeto(r.bases),cobertura=objeto(r.cobertura);
 if(!pedido.antesId||!pedido.depoisId||pedido.antesId===pedido.depoisId||r.schemaVersao!==1||r.motorVersao!=='food06-comparacao-api-v1'||r.escopoComparacao!=='total_de_cada_versao_separadamente'||a.id!==pedido.antesId||b.id!==pedido.depoisId||r.atribuicaoCausal!=='nao_estabelecida'||ref.estado!=='indisponivel'||ref.motivo!=='referencias_nao_habilitadas')return falhar();
 const dimensoes=['planejamento','composicao_fonte','referencia','contexto'] as const, estados=['igual','alterada','nao_documentada','incompativel'];
 if(Object.keys(bases).length!==dimensoes.length||dimensoes.some(k=>!estados.includes(String(bases[k]))))return falhar();
 const codigos=CAMPOS_MICRONUTRIENTES_PLANO.map(c=>c.codigo);
 if(Object.keys(cobertura).length!==codigos.length||codigos.some(c=>!['igual','alterada'].includes(String(cobertura[c]))))return falhar();
 return {linhas:lerLinhasComparacaoFactual(r.comparacao),bases:Object.fromEntries(dimensoes.map(k=>[k,bases[k]])) as ComparacaoRegistrosFactual['bases'],cobertura:Object.fromEntries(codigos.map(k=>[k,cobertura[k]])) as ComparacaoRegistrosFactual['cobertura']};
}
export async function compararRegistrosFactuais(pacienteId:string,pedido:PedidoComparacaoFactual,signal:AbortSignal):Promise<ComparacaoRegistrosFactual>{
 const resposta=await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/analises-factuais/comparar`,{method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({antesId:pedido.antesId,depoisId:pedido.depoisId})});
 if(!resposta.ok)throw new ErroApiPlanoAlimentar(resposta.status,'Não foi possível comparar os registros. Confira o acesso e tente novamente.');
 try{return lerComparacaoVersoesFactuais(await resposta.json(),pedido);}catch{throw new ErroApiPlanoAlimentar(502,'Não foi possível conferir a comparação. Tente novamente.');}
}
