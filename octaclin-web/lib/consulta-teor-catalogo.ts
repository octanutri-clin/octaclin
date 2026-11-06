import { CAMPOS_MICRONUTRIENTES_PLANO } from './micronutrientes-plano';
import type { CodigoMicronutrienteApi } from './plano-alimentar-api';
export interface EntradaConsultaTeor {codigo:CodigoMicronutrienteApi;porcaoGramas:number;busca:string;pagina:number;limite:number;fonteCodigo?:string;versao?:string;baseCodigo?:string}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ESTADOS=['conhecido','ausente','traco','nao_analisado','em_reavaliacao','abaixo_loq','unidade_incompativel','duplicado','invalido','definicao_incompativel'] as const;
const QUALIFICADORES:Partial<Record<CodigoMicronutrienteApi,string>>={vitaminaAReMcg:'RE',vitaminaARaeMcg:'RAE',niacinaNeMg:'NE',folatoDfeMcg:'DFE'};
function falhar():never{throw new Error('Consulta factual indisponível.');}
function objeto(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length||Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!d.enumerable||!Object.hasOwn(d,'value')))return falhar();return v as Record<string,unknown>;}
function texto(v:unknown,max:number):string{if(typeof v!=='string'||!v.trim()||v.length>max)return falhar();return v;}
function numero(v:unknown,min=0,max=Number.MAX_VALUE):number{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)return falhar();return v;}
function inteiro(v:unknown,min:number,max:number):number{const n=numero(v,min,max);if(!Number.isInteger(n))return falhar();return n;}
function uuid(v:unknown):string{const s=texto(v,36);if(!UUID.test(s))return falhar();return s.toLowerCase();}
function booleano(v:unknown):boolean{if(typeof v!=='boolean')return falhar();return v;}
export function lerEntradaConsultaTeor(valor:unknown):EntradaConsultaTeor{
 const q=objeto(valor),permitidos=['codigo','porcaoGramas','busca','pagina','limite','fonteCodigo','versao','baseCodigo'];
 if(Object.keys(q).some(k=>!permitidos.includes(k)))return falhar();
 const campo=CAMPOS_MICRONUTRIENTES_PLANO.find(c=>c.codigo===q.codigo);if(!campo)return falhar();
 const porcaoGramas=numero(q.porcaoGramas,0.001,10000);if(!/^\d+(?:\.\d{1,3})?$/.test(String(porcaoGramas)))return falhar();
 const busca=texto(q.busca,120);if(busca.trim().length<2)return falhar();
 const filtros:Pick<EntradaConsultaTeor,'fonteCodigo'|'versao'|'baseCodigo'>={};
 for(const k of ['fonteCodigo','versao','baseCodigo'] as const)if(q[k]!==undefined)filtros[k]=texto(q[k],80);
 return {codigo:campo.codigo,porcaoGramas,busca,pagina:inteiro(q.pagina,1,10000),limite:inteiro(q.limite,1,100),...filtros};
}
/** Projeção de contrato; não calcula composição nem decide adequação clínica. */
export function projetarConsultaTeor(valor:unknown,entrada:EntradaConsultaTeor){
 const r=objeto(valor),q=lerEntradaConsultaTeor(entrada),campo=CAMPOS_MICRONUTRIENTES_PLANO.find(c=>c.codigo===q.codigo)!;
 if(r.schemaVersao!==1||r.motorVersao!=='food06-consulta-teor-v1'||r.codigo!==q.codigo||r.porcaoGramas!==q.porcaoGramas||!Array.isArray(r.itens)||r.itens.length>q.limite)return falhar();
 const p=objeto(r.paginacao),ordem=objeto(r.ordenacao),individual=objeto(r.individualizacao);
 if(p.pagina!==q.pagina||p.limite!==q.limite||p.ordemSelecao!=='nome_identificador'||p.ordenacaoTeor!=='somente_pagina'||p.visao!=='catalogo_atual_sem_snapshot'||ordem.escopo!=='lote_consultado'||ordem.criterio!=='teor_apresentado_na_porcao_decrescente'||ordem.precisaoDecimal!==8||ordem.desempate!=='identificador_ascendente'||ordem.desconhecidos!=='ao_final'||individual.estado!=='bloqueada'||individual.motivo!=='contrato_restricoes_nao_validado')return falhar();
 const ids=new Set<string>();
 const itens=r.itens.map((v:unknown)=>{
  const i=objeto(v),a=objeto(i.alimento),f=objeto(i.fonte),n=objeto(i.nutriente),id=uuid(a.id);
  if(ids.has(id)||i.porcaoGramas!==q.porcaoGramas||n.codigo!==q.codigo||n.unidade!==campo.unidade||n.qualificador!==QUALIFICADORES[q.codigo]||!ESTADOS.includes(n.estado as typeof ESTADOS[number]))return falhar();ids.add(id);
  const estado=n.estado as typeof ESTADOS[number];
  let valores:{valorPor100g?:number;valorPorcao?:number;arredondadoParaZero?:{por100g:boolean;porcao:boolean}}={};
  if(estado==='conhecido'){
   const valorPor100g=numero(n.valorPor100g),valorPorcao=numero(n.valorPorcao),flags=objeto(n.arredondadoParaZero);
   const por100g=booleano(flags.por100g),porcao=booleano(flags.porcao);
   if(por100g&&valorPor100g!==0||porcao&&valorPorcao!==0)return falhar();
   valores={valorPor100g,valorPorcao,arredondadoParaZero:{por100g,porcao}};
  }else if(n.valorPor100g!==undefined||n.valorPorcao!==undefined||n.arredondadoParaZero!==undefined)return falhar();
  return {alimento:{id,nome:texto(a.nome,300),...(a.preparacao===undefined?{}:{preparacao:texto(a.preparacao,180)})},
   fonte:{id:uuid(f.id),codigo:texto(f.codigo,80),versao:texto(f.versao,80),baseCodigo:texto(f.baseCodigo,80),esquemaVersao:texto(f.esquemaVersao,40)},
   baseGramas:numero(i.baseGramas,Number.MIN_VALUE),porcaoGramas:q.porcaoGramas,
   nutriente:{codigo:q.codigo,rotulo:campo.rotulo,unidade:campo.unidade,...(QUALIFICADORES[q.codigo]?{qualificador:QUALIFICADORES[q.codigo]}:{}),estado,...valores}};
 });
 const c=objeto(r.cobertura),e=objeto(r.exclusoes);
 const cobertura={recebidos:inteiro(c.recebidos,0,q.limite),considerados:inteiro(c.considerados,0,q.limite),comValor:inteiro(c.comValor,0,q.limite),semValor:inteiro(c.semValor,0,q.limite)};
 const exclusoes={fonteInativa:inteiro(e.fonteInativa,0,q.limite),direitoNaoAprovado:inteiro(e.direitoNaoAprovado,0,q.limite),dadosInvalidos:inteiro(e.dadosInvalidos,0,q.limite)};
 if(cobertura.considerados!==itens.length||cobertura.comValor!==itens.filter(i=>i.nutriente.estado==='conhecido').length||cobertura.comValor+cobertura.semValor!==itens.length||cobertura.recebidos!==itens.length+exclusoes.fonteInativa+exclusoes.direitoNaoAprovado+exclusoes.dadosInvalidos)return falhar();
 return {schemaVersao:1 as const,motorVersao:'food06-consulta-teor-v1' as const,codigo:q.codigo,porcaoGramas:q.porcaoGramas,itens,cobertura,exclusoes,
  ordenacao:{escopo:'lote_consultado' as const,criterio:'teor_apresentado_na_porcao_decrescente' as const,precisaoDecimal:8 as const,desempate:'identificador_ascendente' as const,desconhecidos:'ao_final' as const},
  individualizacao:{estado:'bloqueada' as const,motivo:'contrato_restricoes_nao_validado' as const},
  paginacao:{pagina:q.pagina,limite:q.limite,temProxima:booleano(p.temProxima),ordemSelecao:'nome_identificador' as const,ordenacaoTeor:'somente_pagina' as const,visao:'catalogo_atual_sem_snapshot' as const}};
}
export type ResultadoConsultaTeor=ReturnType<typeof projetarConsultaTeor>;
