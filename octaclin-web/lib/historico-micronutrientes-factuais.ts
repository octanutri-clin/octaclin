import { lerLinhaMicronutrienteFactual, type LinhaMicronutrienteFactual } from './micronutrientes-factuais';
import type { CodigoMicronutrienteApi } from './plano-alimentar-api';
import { CAMPOS_MICRONUTRIENTES_PLANO } from './micronutrientes-plano';

export interface PontoHistoricoMicronutrienteFactual {
  registro: { id: string; criadoEm: string };
  origem: { planoId: string; versaoId: string; numero: number; status: 'publicada' | 'rascunho'; registradaEm: string; rascunhoRevisao?: number };
  comparacaoBaseComposicao: 'IGUAL'|'DIFERENTE'|'NAO_COMPARAVEL'|'SEM_REGISTRO_ANTERIOR';
  motorVersao: string;
  nutrientes: Record<CodigoMicronutrienteApi,LinhaMicronutrienteFactual>;
  referencias: { estado: 'indisponivel'; motivo: 'referencias_nao_habilitadas' };
  bases: { planejamentoDocumentado: boolean; composicaoDocumentada: boolean; contextoDocumentado: boolean };
}
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
function validarPonto(valor:unknown):PontoHistoricoMicronutrienteFactual{
 const r=objeto(valor),reg=objeto(r.registro),n=objeto(r.nutrientes),ref=objeto(r.referencias),bases=objeto(r.bases);
 if(r.schemaVersao!==1||Object.keys(r).some(k=>!['schemaVersao','registro','origem','comparacaoBaseComposicao','motorVersao','nutrientes','referencias','bases'].includes(k))||
  Object.keys(reg).some(k=>!['id','criadoEm'].includes(k))||!string(reg.id,80)||!iso(reg.criadoEm,'ms')||!string(r.motorVersao,100)||
  ref.estado!=='indisponivel'||ref.motivo!=='referencias_nao_habilitadas'||Object.keys(ref).some(k=>!['estado','motivo'].includes(k))||
  Object.keys(bases).some(k=>!['planejamentoDocumentado','composicaoDocumentada','contextoDocumentado'].includes(k))||
  ['planejamentoDocumentado','composicaoDocumentada','contextoDocumentado'].some(k=>typeof bases[k]!=='boolean')||
  !['IGUAL','DIFERENTE','NAO_COMPARAVEL','SEM_REGISTRO_ANTERIOR'].includes(String(r.comparacaoBaseComposicao))||Object.keys(n).length!==CAMPOS_MICRONUTRIENTES_PLANO.length)return falhar();
 const nutrientes=Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,lerLinhaMicronutrienteFactual(n[c.codigo],c.codigo)])) as PontoHistoricoMicronutrienteFactual['nutrientes'];
 return {registro:{id:reg.id,criadoEm:reg.criadoEm},origem:validarOrigem(r.origem),comparacaoBaseComposicao:r.comparacaoBaseComposicao as PontoHistoricoMicronutrienteFactual['comparacaoBaseComposicao'],motorVersao:r.motorVersao,nutrientes,referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},bases:{
  planejamentoDocumentado:bases.planejamentoDocumentado as boolean,composicaoDocumentada:bases.composicaoDocumentada as boolean,contextoDocumentado:bases.contextoDocumentado as boolean}};
}
export function lerPaginaHistoricoMicronutrientesFactual(valor:unknown):PaginaHistoricoMicronutrientesFactual{
 const p=objeto(valor),permitidos=['schemaVersao','itens','temMais','proximoCursor'];
 if(p.schemaVersao!==1||Object.keys(p).some(k=>!permitidos.includes(k))||!Array.isArray(p.itens)||p.itens.length>10||typeof p.temMais!=='boolean')return falhar();
 const itens=p.itens.map(validarPonto);
 for(let i=1;i<itens.length;i++)if(Date.parse(itens[i-1].registro.criadoEm)<Date.parse(itens[i].registro.criadoEm))return falhar();
 if(new Set(itens.map(x=>x.registro.id)).size!==itens.length)return falhar();
 if(p.temMais){const c=objeto(p.proximoCursor);if(Object.keys(c).some(k=>!['id','criadoEm'].includes(k))||!string(c.id,80)||!iso(c.criadoEm,'us')||!itens.length||c.id!==itens.at(-1)!.registro.id)return falhar();return {itens,temMais:true,proximoCursor:{id:c.id,criadoEm:c.criadoEm}};}
 if(p.proximoCursor!==undefined)return falhar();return {itens,temMais:false};
}
