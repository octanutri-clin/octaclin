import {lerContextoRegistradoFactual,type ContextoRegistradoFactual} from './contexto-registrado-factual';
import { lerLinhaMicronutrienteFactual, lerFontesPorNutrienteFactual, type LinhaMicronutrienteFactual } from './micronutrientes-factuais';
import type { CodigoMicronutrienteApi } from './plano-alimentar-api';
import { lerReferenciasFactuais } from './referencias-dieteticas-factuais';
/** FOOD06 NUX-15: só se o registro tem referências gravadas. Sem números: o histórico não mostra percentuais nem tendência. */
export type IndicadorReferenciasHistorico={estado:'registrada';versao:string;modificadaEm:string}|{estado:'indisponivel';motivo:'registro_sem_referencias'|'versao_referencias_indisponivel'};
import { CAMPOS_MICRONUTRIENTES_PLANO } from './micronutrientes-plano';

export interface PontoHistoricoMicronutrienteFactual {
  contextoConfirmado?:ContextoRegistradoFactual;
  registro: { id: string; criadoEm: string };
  origem: { planoId: string; versaoId: string; numero: number; status: 'publicada' | 'rascunho'; registradaEm: string; rascunhoRevisao?: number };
  comparacaoAnterior: {
    planejamento: EstadoComparacaoHistorica;
    composicaoFonte: EstadoComparacaoHistorica;
    referencia: EstadoComparacaoHistorica;
    contexto: EstadoComparacaoHistorica;
    cobertura: Record<CodigoMicronutrienteApi,EstadoComparacaoHistorica>;
  };
  motorVersao: string;
  nutrientes: Record<CodigoMicronutrienteApi,LinhaMicronutrienteFactual>;
  referencias: { estado: 'indisponivel'; motivo: 'referencias_nao_habilitadas' };
  /** Só quando o indicador foi pedido. */
  indicadorReferencias?: IndicadorReferenciasHistorico;
  bases: { planejamentoDocumentado: boolean; composicaoDocumentada: boolean; contextoDocumentado: boolean };
}
export type EstadoComparacaoHistorica='IGUAL'|'DIFERENTE'|'NAO_COMPARAVEL'|'SEM_REGISTRO_ANTERIOR';
export interface PaginaHistoricoMicronutrientesFactual {
  itens: PontoHistoricoMicronutrienteFactual[];
  temMais: boolean;
  proximoCursor?: { id: string; criadoEm: string };
}
export interface CursorHistoricoMicronutrientesFactual { id: string; criadoEm: string }

function falhar(): never { throw new Error('Não foi possível validar o histórico factual. Atualize e tente novamente.'); }
function objeto(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return falhar();return v as Record<string,unknown>;}
function string(v:unknown,max=160):v is string{return typeof v==='string'&&v.length>0&&v.length<=max;}
function iso(v:unknown,precisao:'ms'|'us'):v is string{return string(v,40)&&Number.isFinite(Date.parse(v))&&(precisao==='ms'?/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/).test(v);}
function validarOrigem(valor:unknown):PontoHistoricoMicronutrienteFactual['origem']{
 const o=objeto(valor),permitidos=['planoId','versaoId','numero','status','registradaEm','rascunhoRevisao'];
 if(Object.keys(o).some(k=>!permitidos.includes(k))||!string(o.planoId,80)||!string(o.versaoId,80)||!Number.isSafeInteger(o.numero)||(o.numero as number)<1||
  !['publicada','rascunho'].includes(String(o.status))||!iso(o.registradaEm,'ms')||
  (o.status==='rascunho'?(!Number.isSafeInteger(o.rascunhoRevisao)||(o.rascunhoRevisao as number)<1):o.rascunhoRevisao!==undefined))return falhar();
 return {planoId:o.planoId,versaoId:o.versaoId,numero:o.numero as number,status:o.status as 'publicada'|'rascunho',registradaEm:o.registradaEm,...(o.status==='rascunho'?{rascunhoRevisao:o.rascunhoRevisao as number}:{})};
}
function validarComparacaoAnterior(valor:unknown):PontoHistoricoMicronutrienteFactual['comparacaoAnterior']{
 const c=objeto(valor),permitidos=['planejamento','composicaoFonte','referencia','contexto','cobertura'];
 if(Object.keys(c).length!==permitidos.length||Object.keys(c).some(k=>!permitidos.includes(k)))return falhar();
 const estados=['IGUAL','DIFERENTE','NAO_COMPARAVEL','SEM_REGISTRO_ANTERIOR'];
 for(const k of ['planejamento','composicaoFonte','referencia','contexto'])if(!estados.includes(String(c[k])))return falhar();
 const cobertura=objeto(c.cobertura),codigos=CAMPOS_MICRONUTRIENTES_PLANO.map(x=>x.codigo);
 if(Object.keys(cobertura).length!==codigos.length||Object.keys(cobertura).some(k=>!codigos.includes(k as CodigoMicronutrienteApi))||codigos.some(k=>!estados.includes(String(cobertura[k]))))return falhar();
 return {planejamento:c.planejamento as EstadoComparacaoHistorica,composicaoFonte:c.composicaoFonte as EstadoComparacaoHistorica,
  referencia:c.referencia as EstadoComparacaoHistorica,contexto:c.contexto as EstadoComparacaoHistorica,
  cobertura:Object.fromEntries(codigos.map(k=>[k,cobertura[k]])) as PontoHistoricoMicronutrienteFactual['comparacaoAnterior']['cobertura']};
}
function validarPonto(valor:unknown,incluirContexto=false,incluirOrigem=false,incluirReferencias=false):PontoHistoricoMicronutrienteFactual{
 const r=objeto(valor),reg=objeto(r.registro),n=objeto(r.nutrientes),ref=objeto(r.referencias),bases=objeto(r.bases);
 if((r.contextoConfirmado!==undefined&&bases.contextoDocumentado!==true)||r.schemaVersao!==1||Object.keys(r).some(k=>!['schemaVersao','registro','origem','comparacaoAnterior','motorVersao','nutrientes','referencias','bases',...(incluirOrigem?['fontesPorNutriente']:[]),...(incluirContexto?['contextoConfirmado']:[])].includes(k))||
  Object.keys(reg).some(k=>!['id','criadoEm'].includes(k))||!string(reg.id,80)||!iso(reg.criadoEm,'ms')||!string(r.motorVersao,100)||
  (incluirReferencias?false:ref.estado!=='indisponivel'||ref.motivo!=='referencias_nao_habilitadas'||Object.keys(ref).some(k=>!['estado','motivo'].includes(k)))||
  Object.keys(bases).some(k=>!['planejamentoDocumentado','composicaoDocumentada','contextoDocumentado'].includes(k))||
  ['planejamentoDocumentado','composicaoDocumentada','contextoDocumentado'].some(k=>typeof bases[k]!=='boolean')||
  Object.keys(n).length!==CAMPOS_MICRONUTRIENTES_PLANO.length)return falhar();
 const nutrientes=Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,lerLinhaMicronutrienteFactual(n[c.codigo],c.codigo)])) as PontoHistoricoMicronutrienteFactual['nutrientes'];
 if(r.fontesPorNutriente!==undefined){const origens=lerFontesPorNutrienteFactual(r.fontesPorNutriente,Object.values(nutrientes));for(const l of Object.values(nutrientes))l.origem=origens[l.codigo];}
 let indicadorReferencias:IndicadorReferenciasHistorico|undefined;
 if(incluirReferencias){
  if(ref.estado==='calculado'){const dados=lerReferenciasFactuais(ref,Object.values(nutrientes));indicadorReferencias={estado:'registrada',versao:dados.versao,modificadaEm:dados.fonte.modificadaEm};}
  else if(ref.estado==='indisponivel'&&Object.keys(ref).length===2&&(ref.motivo==='registro_sem_referencias'||ref.motivo==='versao_referencias_indisponivel'))indicadorReferencias={estado:'indisponivel',motivo:ref.motivo};
  else return falhar();
 }
 return {...(indicadorReferencias?{indicadorReferencias}:{}),...(r.contextoConfirmado===undefined?{}:{contextoConfirmado:lerContextoRegistradoFactual(r.contextoConfirmado)}),registro:{id:reg.id,criadoEm:reg.criadoEm},origem:validarOrigem(r.origem),comparacaoAnterior:validarComparacaoAnterior(r.comparacaoAnterior),motorVersao:r.motorVersao,nutrientes,referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},bases:{
  planejamentoDocumentado:bases.planejamentoDocumentado as boolean,composicaoDocumentada:bases.composicaoDocumentada as boolean,contextoDocumentado:bases.contextoDocumentado as boolean}};
}
/** `incluirOrigem` espelha o opt-in do backend: a chave só é aceita quando foi pedida, como `contextoConfirmado`. */
export function lerPaginaHistoricoMicronutrientesFactual(valor:unknown,incluirContexto=false,incluirOrigem=false,incluirReferencias=false):PaginaHistoricoMicronutrientesFactual{
 const p=objeto(valor),permitidos=['schemaVersao','itens','temMais','proximoCursor'];
 if(p.schemaVersao!==1||Object.keys(p).some(k=>!permitidos.includes(k))||!Array.isArray(p.itens)||p.itens.length>10||typeof p.temMais!=='boolean')return falhar();
 const itens=p.itens.map(v=>validarPonto(v,incluirContexto,incluirOrigem,incluirReferencias));
 for(let i=1;i<itens.length;i++)if(Date.parse(itens[i-1].registro.criadoEm)<Date.parse(itens[i].registro.criadoEm))return falhar();
 if(new Set(itens.map(x=>x.registro.id)).size!==itens.length)return falhar();
 if(p.temMais){const c=objeto(p.proximoCursor);if(Object.keys(c).some(k=>!['id','criadoEm'].includes(k))||!string(c.id,80)||!iso(c.criadoEm,'us')||!itens.length||c.id!==itens.at(-1)!.registro.id)return falhar();return {itens,temMais:true,proximoCursor:{id:c.id,criadoEm:c.criadoEm}};}
 if(p.proximoCursor!==undefined)return falhar();return {itens,temMais:false};
}
