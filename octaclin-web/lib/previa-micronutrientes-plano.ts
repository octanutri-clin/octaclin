import {lerAjudaDietetica,type AjudaDietetica} from './ajuda-dietetica';
import { ErroApiPlanoAlimentar } from './plano-alimentar-api';
import { CAMPOS_MICRONUTRIENTES_PLANO,lerLinhaMicronutrienteFactual } from './micronutrientes-factuais';
import type { LinhaMicronutrienteFactual } from './micronutrientes-factuais';
export interface PedidoPreviaMicronutrientes {
 rascunhoIdEsperado:string;rascunhoRevisaoEsperada:number;ativacaoRevisaoEsperada:number;
 operacao:{tipo:'definir_porcao_manual'|'substituir_catalogo';refeicaoChave:string;itemChave:string;quantidade:number;unidade:string;porcaoGramas:number;alimentoComposicaoId?:string};
}
export interface PedidoPreviaReceita extends Omit<PedidoPreviaMicronutrientes,'operacao'> {
 operacao:{tipo:'inserir_receita';refeicaoChave:string;receitaId:string;receitaVersaoEsperada:number;porcoesDesejadas:number};
}
export type PedidoOperacaoPrevia = PedidoPreviaMicronutrientes | PedidoPreviaReceita;
export interface ValorPrevia {estado:LinhaMicronutrienteFactual['estado'];valor?:number}
export interface LinhaPrevia {codigo:string;rotulo:string;unidade:string;antes:ValorPrevia;depois:ValorPrevia;delta?:{valor:number;percentual?:number}}
export interface PreviaMicronutrientes {ajuda?:AjudaDietetica|null;fingerprint:string;linhas:LinhaPrevia[]}
const MACROS = [{codigo:'energiaKcal',rotulo:'Energia',unidade:'kcal'},{codigo:'proteinasG',rotulo:'Proteínas',unidade:'g'},{codigo:'carboidratosG',rotulo:'Carboidratos',unidade:'g'},{codigo:'gordurasG',rotulo:'Gorduras totais',unidade:'g'}];
function falhar():never {throw new Error('A prévia não pôde ser conferida. Refaça a simulação.');}
function obj(v:unknown):Record<string,unknown> {if(!v||typeof v!=='object'||Array.isArray(v))return falhar();return v as Record<string,unknown>;}
function numero(v:unknown):v is number {return typeof v==='number'&&Number.isFinite(v);}
function valorMacro(v:unknown,codigo:string,unidade:string):ValorPrevia {
 const n=obj(v);
 if(n.codigo!==codigo||n.unidade!==unidade||!['completo','parcial','indisponivel'].includes(String(n.estado))||!Number.isSafeInteger(n.itensIncluidos)||Number(n.itensIncluidos)<0||Number(n.itensIncluidos)>10000||!Number.isSafeInteger(n.itensComValor)||Number(n.itensComValor)<0||Number(n.itensComValor)>Number(n.itensIncluidos))return falhar();
 const vConhecido=n.estado==='completo'?n.total:n.quantidadeConhecida;
 if(n.estado!=='completo'&&n.total!==undefined)return falhar();
 if(vConhecido!==undefined&&(!numero(vConhecido)||vConhecido<0))return falhar();
 if(n.estado==='completo'&&(vConhecido===undefined||n.itensComValor!==n.itensIncluidos||n.itensIncluidos===0))return falhar();
 if(n.estado==='parcial'&&(vConhecido===undefined||Number(n.itensComValor)<=0||n.itensComValor===n.itensIncluidos))return falhar();
 if(n.estado==='indisponivel'&&(vConhecido!==undefined||n.itensComValor!==0))return falhar();
 return {estado:n.estado==='completo'?'COMPLETO':n.estado==='parcial'?'PARCIAL':'DESCONHECIDO',...(vConhecido!==undefined?{valor:vConhecido as number}:{})};
}
/** Allowlist de exibição. Verifica coerência; não calcula composição ou referências. */
export function lerPreviaMicronutrientes(valor:unknown,pedido:PedidoOperacaoPrevia):PreviaMicronutrientes {
 const r=obj(valor),c=obj(r.comparacao),ref=obj(c.referencias);
 if(r.schemaVersao!==1||r.motorVersao!=='food06-previa-api-v1'||r.escopo!=='rascunho_refeicoes_ativas'||r.rascunhoId!==pedido.rascunhoIdEsperado||r.rascunhoRevisao!==pedido.rascunhoRevisaoEsperada||r.ativacaoRevisao!==pedido.ativacaoRevisaoEsperada||typeof r.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(r.fingerprint)||c.schemaVersao!==1||c.motorVersao!=='food06-previa-factual-v1'||ref.estado!=='indisponivel'||ref.motivo!=='referencias_nao_habilitadas')return falhar();
 return {fingerprint:r.fingerprint,linhas:lerLinhasComparacaoFactual(c),...(r.ajuda!==undefined?{ajuda:lerAjudaDietetica(r.ajuda)}:{})};
}
/** Valida a mesma comparação factual usada em prévias e registros históricos. */
export function lerLinhasComparacaoFactual(valor:unknown):LinhaPrevia[] {
 const c=obj(valor);
 if(c.schemaVersao!==1||c.motorVersao!=='food06-previa-factual-v1')return falhar();
 const antes=obj(c.antes),depois=obj(c.depois),dif=obj(c.diferencas);
 const linha=(campo:{codigo:string;rotulo:string;unidade:string},a:ValorPrevia,b:ValorPrevia):LinhaPrevia=>{
  const d=obj(dif[campo.codigo]),delta=obj(d.delta),completos=a.estado==='COMPLETO'&&b.estado==='COMPLETO';
  if(d.codigo!==campo.codigo||d.unidade!==campo.unidade)return falhar();
  let diferenca:LinhaPrevia['delta'];
  if(completos){
   if(delta.estado!=='calculavel'||!numero(delta.diferenca))return falhar();
   // Apenas detecção de resposta contraditória, abaixo da escala de apresentação.
   const esperado=b.valor!-a.valor!,margem=1e-8+Number.EPSILON*Math.max(a.valor!,b.valor!)*4;
   if(Math.abs(esperado-delta.diferenca)>margem)return falhar();
   const percentual=obj(delta.percentual);let p:number|undefined;
   if(percentual.estado==='calculavel'){
    if(a.valor===0||!numero(percentual.valor)||typeof percentual.arredondado!=='boolean')return falhar();
    const e=delta.diferenca/a.valor!*100;
    if(!Number.isFinite(e)||Math.abs(e-percentual.valor)>1e-8+Number.EPSILON*Math.abs(e)*4)return falhar();
    p=percentual.valor;
   }else if(percentual.estado!=='indisponivel'||(a.valor===0?percentual.motivo!=='base_zero':percentual.motivo!=='limite_precisao'))return falhar();
   diferenca={valor:delta.diferenca,...(p!==undefined?{percentual:p}:{})};
  }else if(delta.estado!=='indisponivel'||delta.motivo!=='composicao_incompleta')return falhar();
  return {...campo,antes:a,depois:b,...(diferenca?{delta:diferenca}:{})};
 };
 const macros=(e:Record<string,unknown>)=>obj(obj(e.calculo).nutrientes);
 const micros=(e:Record<string,unknown>)=>{const cobertura=obj(e.cobertura);if(cobertura.schemaVersao!==1)return falhar();return obj(cobertura.nutrientes);};
 const ma=macros(antes),mb=macros(depois),ca=micros(antes),cb=micros(depois);
 const linhas=MACROS.map(m=>linha(m,valorMacro(ma[m.codigo],m.codigo,m.unidade),valorMacro(mb[m.codigo],m.codigo,m.unidade)));
 for(const m of CAMPOS_MICRONUTRIENTES_PLANO){const a=lerLinhaMicronutrienteFactual(ca[m.codigo],m.codigo),b=lerLinhaMicronutrienteFactual(cb[m.codigo],m.codigo);linhas.push(linha(m,{estado:a.estado,...(a.valor!==undefined?{valor:a.valor}:{})},{estado:b.estado,...(b.valor!==undefined?{valor:b.valor}:{})}));}
 return linhas;
}
export function lerAckPrevia(valor:unknown,pedido:PedidoOperacaoPrevia):{id:string;rascunhoRevisao:number} {
 const r=obj(valor);
 if(r.id!==pedido.rascunhoIdEsperado||r.rascunhoRevisao!==pedido.rascunhoRevisaoEsperada+1||r.edicaoEstado!=='materializada')return falhar();
 return {id:r.id as string,rascunhoRevisao:r.rascunhoRevisao as number};
}
function corpoPedido(p:PedidoOperacaoPrevia){const o=p.operacao;return {rascunhoIdEsperado:p.rascunhoIdEsperado,rascunhoRevisaoEsperada:p.rascunhoRevisaoEsperada,ativacaoRevisaoEsperada:p.ativacaoRevisaoEsperada,operacao:o.tipo==='inserir_receita'?{tipo:o.tipo,refeicaoChave:o.refeicaoChave,receitaId:o.receitaId,receitaVersaoEsperada:o.receitaVersaoEsperada,porcoesDesejadas:o.porcoesDesejadas}:{tipo:o.tipo,refeicaoChave:o.refeicaoChave,itemChave:o.itemChave,quantidade:o.quantidade,unidade:o.unidade,porcaoGramas:o.porcaoGramas,...(o.tipo==='substituir_catalogo'?{alimentoComposicaoId:o.alimentoComposicaoId}:{})}};}

async function solicitar(pacienteId:string,planoId:string,pedido:PedidoOperacaoPrevia,signal:AbortSignal,fingerprint?:string){
 const resposta=await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/${encodeURIComponent(planoId)}/rascunho/previa-micronutrientes${fingerprint===undefined?'':'/confirmar'}`,{method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({...corpoPedido(pedido),...(fingerprint!==undefined?{fingerprintEsperado:fingerprint}:{})})});
 if(!resposta.ok)throw new ErroApiPlanoAlimentar(resposta.status,resposta.status===409?'A versão ou os dados mudaram. Recarregue e confira o rascunho.':'Não foi possível concluir a simulação. Confira o acesso, o alimento e o rascunho.');
 return resposta.json() as Promise<unknown>;
}
export async function preverMicronutrientesPlano(pacienteId:string,planoId:string,pedido:PedidoOperacaoPrevia,signal:AbortSignal){
 const resposta=await solicitar(pacienteId,planoId,pedido,signal);
 try{return lerPreviaMicronutrientes(resposta,pedido);}catch{throw new ErroApiPlanoAlimentar(502,'A prévia não pôde ser conferida. Refaça a simulação.');}
}
export async function confirmarPreviaMicronutrientesPlano(pacienteId:string,planoId:string,pedido:PedidoOperacaoPrevia,fingerprint:string,signal:AbortSignal){
 const resposta=await solicitar(pacienteId,planoId,pedido,signal,fingerprint);
 try{return lerAckPrevia(resposta,pedido);}catch{throw new ErroApiPlanoAlimentar(502,'A confirmação não pôde ser conferida. Recarregue o rascunho antes de tentar novamente.');}
}
