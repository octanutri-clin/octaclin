import { randomUUID } from 'crypto';
import { AlternativaEdicao, DocumentoEdicaoPlano, ItemEdicao, numeroEdicao } from '../dominio/edicao-plano';
import { FatosComposicaoEquivalencia, ComandoEquivalencia, PoliticaEquivalencia, NutrienteEquivalencia, ResultadoEquivalencia, validarIntencaoEquivalencia, validarPoliticaEquivalencia, nutrienteEquivalenciaValido } from '../dominio/equivalencia-nutriente';
import { fingerprintEquivalencia, fatosSemanticosEquivalencia } from '../dominio/fingerprint-equivalencia';
import { UUID_GRUPO, objetoGrupo } from '../dominio/grupos-substituicoes';
import { lerRazaoSnapshot } from '../dominio/decimal-nutricional';
import type { SnapshotComposicao } from './servico-planos-alimentares';
export type EstadoEquivalencia='calculada_revisada'|'revisao_pendente'|'desvinculada_manualmente';
export interface ContextoEquivalencia {
 schemaVersao:1;algoritmo:'equivalencia-nutriente-v1';aplicacaoId:string;itemChave:string;alternativaChave:string;
 nutriente:NutrienteEquivalencia;politica:PoliticaEquivalencia;principal:FatosComposicaoEquivalencia;alternativa:FatosComposicaoEquivalencia;
 porcaoPrincipalGramas:string;porcaoEfetivaGramas:string;resultado:Extract<ResultadoEquivalencia,{estado:'calculavel'}>;
 estado:EstadoEquivalencia;ator:{usuarioId:string;profissionalId:string};comandoHash:string;dependenciasHash:string;fingerprintResolucao:string;
 snapshotPrincipal?:SnapshotComposicao;snapshotAlternativa?:SnapshotComposicao;
 aplicados?:{principal:FatosComposicaoEquivalencia;alternativa:FatosComposicaoEquivalencia;snapshotPrincipal?:SnapshotComposicao;snapshotAlternativa?:SnapshotComposicao};
 resolucao?:{aplicacaoId:string;comandoHash:string;ator:ContextoEquivalencia['ator']};
 copiaOrigem?:{pacienteId:string;planoId:string;versaoId:string;aplicacaoId:string;itemChave:string;alternativaChave:string;copiadaPor:ContextoEquivalencia['ator'];copiadaEm:string;origemInicial?:{pacienteId:string;planoId:string;versaoId:string;aplicacaoId:string;itemChave:string;alternativaChave:string}};
}
export type ContextosEquivalencias=Record<string,ContextoEquivalencia>;
export class ConflitoEquivalenciaEdicao extends Error { constructor(){super('A equivalência mudou ou perdeu sua referência. Confira a prévia novamente.');} }
interface PreviaConfiavel {
 fingerprint:string;principal:FatosComposicaoEquivalencia;alternativa:FatosComposicaoEquivalencia;resultado:ResultadoEquivalencia;
 snapshotPrincipal?:SnapshotComposicao;snapshotAlternativa?:SnapshotComposicao;
}
export interface CallbacksEquivalencias {
 ator?:ContextoEquivalencia['ator'];
 prever:(documento:DocumentoEdicaoPlano,item:ItemEdicao,a:AlternativaEdicao,c:ComandoEquivalencia)=>Promise<PreviaConfiavel>;
 dependencias:(item:ItemEdicao,a:AlternativaEdicao,c:ContextoEquivalencia)=>Promise<string>;
}
const copia=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const hashValido=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function dadosMedida(a:ItemEdicao|AlternativaEdicao){return a.medidaCaseira?{id:a.medidaCaseira.id,revisao:a.medidaCaseira.revisao,quantidade:numeroEdicao(a.quantidade)}:undefined;}
export function assinaturaDependenciasEquivalencia(i:ItemEdicao,a:AlternativaEdicao,p:FatosComposicaoEquivalencia,f:FatosComposicaoEquivalencia,nutriente:NutrienteEquivalencia,politica:PoliticaEquivalencia):string {
 return fingerprintEquivalencia({principal:fatosSemanticosEquivalencia(p),alternativa:fatosSemanticosEquivalencia(f),porcaoPrincipal:numeroEdicao(i.porcaoGramas),porcaoAlternativa:numeroEdicao(a.porcaoGramas),medidaPrincipal:dadosMedida(i),medidaAlternativa:dadosMedida(a),nutriente,politica});
}
function hashComando(c:ComandoEquivalencia):string {return fingerprintEquivalencia({...c,...(c.porcaoEfetiva!==undefined?{porcaoEfetiva:Number(c.porcaoEfetiva)}:{})});}
function fingerprintResolucao(c:ContextoEquivalencia,atual:string):string {return fingerprintEquivalencia({aplicacaoId:c.aplicacaoId,itemChave:c.itemChave,alternativaChave:c.alternativaChave,estado:c.estado,dependencias:atual});}
export function clonarContextoEquivalenciaParaCopia(
 contexto:ContextoEquivalencia,
 origem:{pacienteId:string;planoId:string;versaoId:string},
 destino:{pacienteId:string;planoId:string;versaoId:string;itemChave:string;alternativaChave:string},
 copiadaPor:ContextoEquivalencia['ator'],
 copiadaEm:string
):ContextoEquivalencia {
 const original=validarContextosEquivalencias({[contexto.alternativaChave]:contexto})[contexto.alternativaChave];
 if(original.estado==='desvinculada_manualmente')throw new ConflitoEquivalenciaEdicao();
 const ids=[origem.pacienteId,origem.planoId,origem.versaoId,destino.pacienteId,destino.planoId,destino.versaoId];
 if(!ids.every(x=>typeof x==='string'&&UUID_GRUPO.test(x))||!destino.itemChave||destino.itemChave.length>100||!destino.alternativaChave||destino.alternativaChave.length>100||![copiadaPor.usuarioId,copiadaPor.profissionalId].every(x=>typeof x==='string'&&UUID_GRUPO.test(x))||typeof copiadaEm!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(copiadaEm)||Number.isNaN(Date.parse(copiadaEm)))throw new ConflitoEquivalenciaEdicao();
 const origemInicial=original.copiaOrigem?.origemInicial??{
  pacienteId:original.copiaOrigem?.origemInicial?.pacienteId??origem.pacienteId,
  planoId:original.copiaOrigem?.origemInicial?.planoId??origem.planoId,
  versaoId:original.copiaOrigem?.origemInicial?.versaoId??origem.versaoId,
  aplicacaoId:original.copiaOrigem?.aplicacaoId??original.aplicacaoId,
  itemChave:original.copiaOrigem?.itemChave??original.itemChave,
  alternativaChave:original.copiaOrigem?.alternativaChave??original.alternativaChave
 };
 const copia:ContextoEquivalencia={...copiaJson(original),aplicacaoId:randomUUID(),itemChave:destino.itemChave,alternativaChave:destino.alternativaChave,
  copiaOrigem:{...origem,aplicacaoId:original.aplicacaoId,itemChave:original.itemChave,alternativaChave:original.alternativaChave,copiadaPor:{...copiadaPor},copiadaEm,origemInicial:copiaJson(origemInicial)}};
 copia.fingerprintResolucao=fingerprintResolucao(copia,copia.dependenciasHash);
 return validarContextosEquivalencias({[copia.alternativaChave]:copia})[copia.alternativaChave];
}
const copiaJson=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
export function validarContextosEquivalencias(v:unknown):ContextosEquivalencias {
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.keys(v).length>10000||Buffer.byteLength(JSON.stringify(v),'utf8')>2*1024*1024)throw new ConflitoEquivalenciaEdicao();
 const campos=['schemaVersao','algoritmo','aplicacaoId','itemChave','alternativaChave','nutriente','politica','principal','alternativa','porcaoPrincipalGramas','porcaoEfetivaGramas','resultado','estado','ator','comandoHash','dependenciasHash','fingerprintResolucao','snapshotPrincipal','snapshotAlternativa','aplicados','resolucao','copiaOrigem'];
 const ids=new Set<string>();
 for(const [chave,valor]of Object.entries(v)){
  const c=objetoGrupo(valor,campos) as unknown as ContextoEquivalencia;
  if(c.schemaVersao!==1||c.algoritmo!=='equivalencia-nutriente-v1'||typeof c.aplicacaoId!=='string'||!UUID_GRUPO.test(c.aplicacaoId)||ids.has(c.aplicacaoId)||c.alternativaChave!==chave||typeof c.itemChave!=='string'||!c.itemChave||c.itemChave.length>100||!nutrienteEquivalenciaValido(c.nutriente)||!['calculada_revisada','revisao_pendente','desvinculada_manualmente'].includes(c.estado)||![c.comandoHash,c.dependenciasHash,c.fingerprintResolucao].every(hashValido)||Buffer.byteLength(JSON.stringify(c),'utf8')>16*1024)throw new ConflitoEquivalenciaEdicao();
  ids.add(c.aplicacaoId);validarPoliticaEquivalencia(c.politica);
  const ator=objetoGrupo(c.ator,['usuarioId','profissionalId']);if(![ator.usuarioId,ator.profissionalId].every(x=>typeof x==='string'&&UUID_GRUPO.test(x)))throw new ConflitoEquivalenciaEdicao();
  fatosSemanticosEquivalencia(c.principal);fatosSemanticosEquivalencia(c.alternativa);
  if(c.aplicados){const a=objetoGrupo(c.aplicados,['principal','alternativa','snapshotPrincipal','snapshotAlternativa']);fatosSemanticosEquivalencia(a.principal as FatosComposicaoEquivalencia);fatosSemanticosEquivalencia(a.alternativa as FatosComposicaoEquivalencia);}
  if(c.resultado?.estado!=='calculavel'||c.resultado.nutriente!==c.nutriente||typeof c.porcaoEfetivaGramas!=='string'||typeof c.porcaoPrincipalGramas!=='string')throw new ConflitoEquivalenciaEdicao();
  lerRazaoSnapshot(c.resultado.porcaoMatematica);for(const r of Object.values(c.resultado.exatos??{}))lerRazaoSnapshot(r);
  if(!c.resultado.exatos?.alvo||!c.resultado.exatos?.obtido||!c.resultado.exatos?.delta||!c.resultado.exatos?.percentual)throw new ConflitoEquivalenciaEdicao();
  if(c.resolucao){const r=objetoGrupo(c.resolucao,['aplicacaoId','comandoHash','ator']);if(typeof r.aplicacaoId!=='string'||!UUID_GRUPO.test(r.aplicacaoId)||!hashValido(r.comandoHash)||ids.has(r.aplicacaoId))throw new ConflitoEquivalenciaEdicao();const autor=objetoGrupo(r.ator,['usuarioId','profissionalId']);if(![autor.usuarioId,autor.profissionalId].every(x=>typeof x==='string'&&UUID_GRUPO.test(x)))throw new ConflitoEquivalenciaEdicao();ids.add(r.aplicacaoId);}
  if(c.copiaOrigem){const x=objetoGrupo(c.copiaOrigem,['pacienteId','planoId','versaoId','aplicacaoId','itemChave','alternativaChave','copiadaPor','copiadaEm','origemInicial']);if(![x.pacienteId,x.planoId,x.versaoId,x.aplicacaoId].every(id=>typeof id==='string'&&UUID_GRUPO.test(id))||typeof x.itemChave!=='string'||!x.itemChave||x.itemChave.length>100||typeof x.alternativaChave!=='string'||!x.alternativaChave||x.alternativaChave.length>100||typeof x.copiadaEm!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x.copiadaEm)||Number.isNaN(Date.parse(x.copiadaEm)))throw new ConflitoEquivalenciaEdicao();const autor=objetoGrupo(x.copiadaPor,['usuarioId','profissionalId']);if(![autor.usuarioId,autor.profissionalId].every(id=>typeof id==='string'&&UUID_GRUPO.test(id)))throw new ConflitoEquivalenciaEdicao();if(x.origemInicial){const o=objetoGrupo(x.origemInicial,['pacienteId','planoId','versaoId','aplicacaoId','itemChave','alternativaChave']);if(![o.pacienteId,o.planoId,o.versaoId,o.aplicacaoId].every(id=>typeof id==='string'&&UUID_GRUPO.test(id))||typeof o.itemChave!=='string'||!o.itemChave||o.itemChave.length>100||typeof o.alternativaChave!=='string'||!o.alternativaChave||o.alternativaChave.length>100)throw new ConflitoEquivalenciaEdicao();}}
 }
 return copia(v) as ContextosEquivalencias;
}
/** Única mutação é normalizar intenção na cópia editorial que o save já possui. */
export async function resolverEquivalenciasDocumento(documento:DocumentoEdicaoPlano,anteriores:ContextosEquivalencias,cb:CallbacksEquivalencias):Promise<ContextosEquivalencias>{
 const velhos=validarContextosEquivalencias(anteriores),atuais:ContextosEquivalencias=Object.create(null);
 const identidades=new Map<string,string>();
 for(const [chave,c] of Object.entries(velhos)){identidades.set(c.aplicacaoId,chave);if(c.resolucao)identidades.set(c.resolucao.aplicacaoId,chave);}
 for(const refeicao of documento.refeicoes)for(const item of refeicao.itens)for(const a of item.substituicoes??[]){
  const anterior=velhos[a.chaveCliente];if(anterior&&(anterior.itemChave!==item.chaveCliente||anterior.alternativaChave!==a.chaveCliente))throw new ConflitoEquivalenciaEdicao();
  const intencao=a.equivalencia;
  if(intencao===undefined||intencao===null){
   if(!anterior)continue;
   if(anterior.estado==='desvinculada_manualmente'){atuais[a.chaveCliente]=anterior;delete a.equivalencia;continue;}
   if(intencao===null)throw new ConflitoEquivalenciaEdicao();
   a.equivalencia={aplicacaoId:anterior.aplicacaoId};
  }
  const e=validarIntencaoEquivalencia(a.equivalencia);
  if(identidades.has(e.aplicacaoId)&&identidades.get(e.aplicacaoId)!==a.chaveCliente)throw new ConflitoEquivalenciaEdicao();
  if(!('acao'in e)){
   if(!anterior||anterior.aplicacaoId!==e.aplicacaoId||anterior.estado==='desvinculada_manualmente')throw new ConflitoEquivalenciaEdicao();
   const dep=await cb.dependencias(item,a,anterior);
   const c=copia(anterior);if(c.estado==='revisao_pendente'||dep!==c.dependenciasHash)c.estado='revisao_pendente';c.fingerprintResolucao=fingerprintResolucao(c,dep);atuais[a.chaveCliente]=c;continue;
  }
  const ch=hashComando(e);
  if(e.acao==='desvincular'){
   if(!cb.ator)throw new ConflitoEquivalenciaEdicao();
   if(anterior?.estado==='desvinculada_manualmente'&&anterior.resolucao?.aplicacaoId===e.aplicacaoId&&anterior.resolucao.comandoHash===ch){atuais[a.chaveCliente]=anterior;delete a.equivalencia;continue;}
   if(!anterior||anterior.estado==='desvinculada_manualmente'||e.anteriorAplicacaoId!==anterior.aplicacaoId||e.fingerprintEsperado!==anterior.fingerprintResolucao)throw new ConflitoEquivalenciaEdicao();
   if(identidades.has(e.aplicacaoId))throw new ConflitoEquivalenciaEdicao();
   identidades.set(e.aplicacaoId,a.chaveCliente);
   const c=copia(anterior);c.estado='desvinculada_manualmente';c.resolucao={aplicacaoId:e.aplicacaoId,comandoHash:ch,ator:{...cb.ator}};atuais[a.chaveCliente]=c;delete a.equivalencia;continue;
  }
  if(anterior?.aplicacaoId===e.aplicacaoId){
   if(anterior.comandoHash!==ch||anterior.estado!=='calculada_revisada'||await cb.dependencias(item,a,anterior)!==anterior.dependenciasHash)throw new ConflitoEquivalenciaEdicao();
   atuais[a.chaveCliente]=anterior;a.equivalencia={aplicacaoId:anterior.aplicacaoId};continue;
  }
  if(identidades.has(e.aplicacaoId))throw new ConflitoEquivalenciaEdicao();
  const ativo=anterior&&anterior.estado!=='desvinculada_manualmente';
  if((e.acao==='calcular'&&ativo)||(e.acao==='recalcular'&&(!ativo||e.anteriorAplicacaoId!==anterior.aplicacaoId)))throw new ConflitoEquivalenciaEdicao();
  if(!cb.ator)throw new ConflitoEquivalenciaEdicao();
  const previa=await cb.prever(documento,item,a,e);
  if(previa.fingerprint!==e.fingerprintEsperado||previa.resultado.estado!=='calculavel'||!previa.resultado.aplicavel||Number(e.porcaoEfetiva)!==Number(previa.resultado.porcaoEfetivaGramas)||Number(numeroEdicao(a.porcaoGramas))!==Number(previa.resultado.porcaoEfetivaGramas))throw new ConflitoEquivalenciaEdicao();
  const dep=assinaturaDependenciasEquivalencia(item,a,previa.principal,previa.alternativa,e.nutriente!,e.politica!);
  const c:ContextoEquivalencia={schemaVersao:1,algoritmo:'equivalencia-nutriente-v1',aplicacaoId:e.aplicacaoId,itemChave:item.chaveCliente,alternativaChave:a.chaveCliente,nutriente:e.nutriente!,politica:e.politica!,principal:copia(previa.principal),alternativa:copia(previa.alternativa),porcaoPrincipalGramas:String(numeroEdicao(item.porcaoGramas)),porcaoEfetivaGramas:previa.resultado.porcaoEfetivaGramas,resultado:copia(previa.resultado),estado:'calculada_revisada',ator:{...cb.ator},comandoHash:ch,dependenciasHash:dep,fingerprintResolucao:'',...(previa.snapshotPrincipal?{snapshotPrincipal:copia(previa.snapshotPrincipal)}:{}),...(previa.snapshotAlternativa?{snapshotAlternativa:copia(previa.snapshotAlternativa)}:{})};
  c.fingerprintResolucao=fingerprintResolucao(c,dep);atuais[a.chaveCliente]=c;identidades.set(c.aplicacaoId,a.chaveCliente);a.equivalencia={aplicacaoId:c.aplicacaoId};
 }
 return validarContextosEquivalencias(atuais);
}
