import {lerContextoRegistradoFactual,type ContextoRegistradoFactual} from './contexto-registrado-factual';
import {CAMPOS_MACRO_FACTUAL,lerValorMacroFactual} from './previa-micronutrientes-plano';
import {lerLinhaMicronutrienteFactual,lerFontesPorNutrienteFactual,versaoFonteFactualValida} from './micronutrientes-factuais';
import {CAMPOS_MICRONUTRIENTES_PLANO} from './micronutrientes-plano';
import {ErroApiPlanoAlimentar} from './plano-alimentar-api';
function falhar():never{throw new Error('Não foi possível conferir o relatório.');}
function obj(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))return falhar();return v as Record<string,unknown>;}
function texto(v:unknown):string{if(typeof v!=='string'||!v.length||v.length>128)return falhar();return v;}
function data(v:unknown):string{const s=texto(v);if(!Number.isFinite(Date.parse(s))||new Date(s).toISOString()!==s)return falhar();return s;}
const LIMITES=['alimentacao_planejada_nao_consumo_real','ausencia_nao_equivale_a_zero','sem_diagnostico_ou_recomendacao','composicao_congelada_sem_catalogo_atual'];
export function lerRelatorioFactual(valor:unknown,registroId:string){
 const r=obj(valor),registro=obj(r.registro),o=obj(r.origem),ref=obj(r.referencias),analise=obj(r.analise),cobertura=obj(analise.cobertura),nutrientes=obj(cobertura.nutrientes);
 if(!registroId||registro.id!==registroId||!((r.schemaVersao===1&&r.motorVersao==='food06-relatorio-factual-v1')||(r.schemaVersao===2&&r.motorVersao==='food06-relatorio-factual-v2'))||ref.estado!=='indisponivel'||ref.motivo!=='referencias_nao_habilitadas'||!['nao_projetadas_neste_contrato','resumo_documentado'].includes(String(obj(r.fontesComposicao).estado))||cobertura.schemaVersao!==1)return falhar();
 const c=obj(r.contextoClinico);let contextoRegistrado:ContextoRegistradoFactual|undefined;
 if(r.schemaVersao===1){if(c.estado!=='nao_documentado_no_relatorio'||Object.keys(c).some(k=>k!=='estado'))return falhar();}
 else if(c.estado==='resumo_documentado'){if(Object.keys(c).some(k=>!['estado','resumo'].includes(k)))return falhar();contextoRegistrado=lerContextoRegistradoFactual(c.resumo);}
 else if(c.estado!=='nao_registrado'||Object.keys(c).some(k=>k!=='estado'))return falhar();
 if(!Number.isSafeInteger(o.numero)||Number(o.numero)<1||!['publicada','rascunho'].includes(String(o.status))||(o.status==='rascunho'? !Number.isSafeInteger(o.rascunhoRevisao)||Number(o.rascunhoRevisao)<1:o.rascunhoRevisao!==undefined))return falhar();
 if(!Array.isArray(r.limites)||r.limites.length!==LIMITES.length||new Set(r.limites).size!==LIMITES.length||LIMITES.some(l=>!(r.limites as unknown[]).includes(l)))return falhar();
 if(!Array.isArray(r.avisos)||r.avisos.some(a=>!['porcao_divergente','planejamento_nao_documentado','composicao_nao_documentada'].includes(String(a)))||new Set(r.avisos).size!==r.avisos.length)return falhar();
 const linhas=CAMPOS_MICRONUTRIENTES_PLANO.map(c=>lerLinhaMicronutrienteFactual(nutrientes[c.codigo],c.codigo));if(new Set(linhas.map(l=>l.contagens.incluidos)).size!==1)return falhar();
 if(r.schemaVersao===1&&r.fontesPorNutriente!==undefined)return falhar();
 if(r.schemaVersao===2&&r.fontesPorNutriente!==undefined){const origens=lerFontesPorNutrienteFactual(r.fontesPorNutriente,linhas);for(const l of linhas)l.origem=origens[l.codigo];}
 const f=obj(r.fontesComposicao);let fontes: {tipo:string;codigo?:string;versao?:string;quantidade:number}[]|undefined;let semReferencia=0,fontesNaoDetalhadas=0;
 if(f.estado==='resumo_documentado'){
  const inteiro=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=10000;
  if(!inteiro(f.itensIncluidos)||f.itensIncluidos!==linhas[0]?.contagens.incluidos||!inteiro(f.semReferencia)||!inteiro(f.fontesNaoDetalhadas)||!Array.isArray(f.fontes)||f.fontes.length>50)return falhar();
  fontes=f.fontes.map(v=>{const n=obj(v);if(!['TACO','USDA','IBGE','manual','custom'].includes(String(n.tipo))||!inteiro(n.quantidade)||!Number(n.quantidade)||(n.codigo!==undefined&&(typeof n.codigo!=='string'||!/^[A-Za-z0-9_.-]{1,80}$/.test(n.codigo)))||(n.versao!==undefined&&!versaoFonteFactualValida(n.versao)))return falhar();return {tipo:String(n.tipo),...(n.codigo!==undefined?{codigo:n.codigo as string}:{}),...(n.versao!==undefined?{versao:n.versao as string}:{}),quantidade:n.quantidade as number};});
  semReferencia=f.semReferencia as number;fontesNaoDetalhadas=f.fontesNaoDetalhadas as number;
  if(new Set(fontes.map(n=>JSON.stringify([n.tipo,n.codigo,n.versao]))).size!==fontes.length||fontes.reduce((n,x)=>n+x.quantidade,0)+semReferencia+fontesNaoDetalhadas!==f.itensIncluidos)return falhar();
 }
 const selecao=obj(r.selecao);if(typeof selecao.planoAtivo!=='boolean'||typeof selecao.planoSelecionado!=='boolean'||!Array.isArray(selecao.refeicoes)||selecao.refeicoes.length>50)return falhar();
 const refeicoes=selecao.refeicoes.map(v=>{const f=obj(v);if(typeof f.ativa!=='boolean'||typeof f.selecionada!=='boolean')return falhar();return {identidadeId:texto(f.identidadeId),ativa:f.ativa,selecionada:f.selecionada};});if(new Set(refeicoes.map(f=>f.identidadeId)).size!==refeicoes.length)return falhar();
 const nutrientesMacro=obj(obj(analise.calculo).nutrientes);const macros=CAMPOS_MACRO_FACTUAL.map(c=>{const n=obj(nutrientesMacro[c.codigo]);if(n.itensIncluidos!==linhas[0]?.contagens.incluidos)return falhar();return {...c,...lerValorMacroFactual(n,c.codigo,c.unidade)};});
 return {motorVersao:r.schemaVersao===2?'food06-relatorio-factual-v2' as const:'food06-relatorio-factual-v1' as const,contextoRegistrado,geradoEm:data(r.geradoEm),registro:{id:texto(registro.id),criadoEm:data(registro.criadoEm)},origem:{planoId:texto(o.planoId),versaoId:texto(o.versaoId),numero:o.numero as number,status:o.status as 'publicada'|'rascunho',registradaEm:data(o.registradaEm),...(o.status==='rascunho'?{rascunhoRevisao:o.rascunhoRevisao as number}:{})},selecao:{planoAtivo:selecao.planoAtivo,planoSelecionado:selecao.planoSelecionado,refeicoes},fontes,semReferencia,fontesNaoDetalhadas,macros,linhas,avisos:r.avisos.map(String)};
}
export type RelatorioFactual=ReturnType<typeof lerRelatorioFactual>;
export async function obterRelatorioFactual(pacienteId:string,registroId:string,signal:AbortSignal,versaoRelatorio:1|2=1,incluirOrigem=false):Promise<RelatorioFactual>{
 const resposta=await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/analises-factuais/relatorio`,{method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({registroId,...(versaoRelatorio===2?{versaoRelatorio:2}:{}),...(versaoRelatorio===2&&incluirOrigem?{incluirOrigem:true}:{})})});
 if(!resposta.ok)throw new ErroApiPlanoAlimentar(resposta.status,'Não foi possível preparar o relatório autorizado.');
 try{const r=lerRelatorioFactual(await resposta.json(),registroId);if(r.motorVersao!==`food06-relatorio-factual-v${versaoRelatorio}`)throw new Error();return r;}catch{throw new ErroApiPlanoAlimentar(502,'Não foi possível conferir o relatório.');}
}
