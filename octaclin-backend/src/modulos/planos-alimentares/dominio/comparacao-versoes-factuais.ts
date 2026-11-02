import type { EntradaPlanoCombinado } from './calculo-combinado';
import { CODIGOS_MICRONUTRIENTES,type CodigoMicronutriente } from './micronutrientes';
import { compararCenariosFactuais,type PreviaDieteticaFactual } from './previa-dietetica';
export const DIMENSOES_VERSAO = ['planejamento','composicao_fonte','referencia','contexto'] as const;
export type DimensaoVersao = typeof DIMENSOES_VERSAO[number];
export type EstadoBaseVersao = 'igual'|'alterada'|'nao_documentada'|'incompativel';
export interface IdentidadeVersaoFactual {
  planoId:string;versaoId:string;numero:number;status:'publicada'|'rascunho';
  rascunhoRevisao?:number;registradaEm:string;
}
/** Somente estados autorizados e congelados, montados pelo servidor; não é DTO HTTP. */
export interface VersaoFactualResolvida {
  escopo:{tenantId:string;pacienteId:string};origem:IdentidadeVersaoFactual;
  estado:EntradaPlanoCombinado;
  /** Marcadores de conteúdo por dimensão, produzidos por política canônica versionada.
   * Não são autorização, capability, diagnóstico ou prova de causa. Nunca projetar hashes. */
  bases?:Partial<Record<DimensaoVersao,unknown>>;
}
export interface ComparacaoVersoesFactuais {
  schemaVersao:1;motorVersao:'food06-versoes-factuais-v1';
  escopoComparacao:'total_de_cada_versao_separadamente';
  antes:IdentidadeVersaoFactual;depois:IdentidadeVersaoFactual;
  comparacao:PreviaDieteticaFactual;
  bases:Record<DimensaoVersao,EstadoBaseVersao>;
  cobertura:Record<CodigoMicronutriente,'igual'|'alterada'>;
  atribuicaoCausal:'nao_estabelecida';
}
export class ComparacaoVersoesInvalidaError extends Error {
  constructor(){super('Estados de versões indisponíveis para comparação.');this.name='ComparacaoVersoesInvalidaError';}
}
function objeto(v:unknown):Record<string,unknown>|undefined {
  if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length)return;
  if(Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!d.enumerable||!Object.hasOwn(d,'value')))return;
  return v as Record<string,unknown>;
}
function texto(v:unknown):v is string{return typeof v==='string'&&!!v.trim()&&v.length<=128;}
function inteiro(v:unknown):v is number{return typeof v==='number'&&Number.isSafeInteger(v)&&v>0;}
function identidade(v:unknown):IdentidadeVersaoFactual {
  const o=objeto(v);
  if(!o||!texto(o.planoId)||!texto(o.versaoId)||!inteiro(o.numero)||(o.status!=='publicada'&&o.status!=='rascunho')||
    typeof o.registradaEm!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(o.registradaEm))throw new ComparacaoVersoesInvalidaError();
  const instante=new Date(o.registradaEm);
  if(!Number.isFinite(instante.getTime())||instante.toISOString()!==o.registradaEm||
    (o.status==='rascunho'?!inteiro(o.rascunhoRevisao):o.rascunhoRevisao!==undefined))throw new ComparacaoVersoesInvalidaError();
  return {planoId:o.planoId,versaoId:o.versaoId,numero:o.numero,status:o.status as IdentidadeVersaoFactual['status'],
    registradaEm:o.registradaEm,...(o.status==='rascunho'?{rascunhoRevisao:o.rascunhoRevisao as number}:{})};
}
function validar(v:VersaoFactualResolvida) {
  const o=objeto(v),escopo=objeto(o?.escopo),estado=objeto(o?.estado);
  if(!o||!escopo||!texto(escopo.tenantId)||!texto(escopo.pacienteId)||!estado)throw new ComparacaoVersoesInvalidaError();
  const origem=identidade(o.origem);
  if(estado.planoId!==origem.planoId||typeof estado.ativo!=='boolean'||typeof estado.selecionado!=='boolean'||
    !Array.isArray(estado.refeicoes)||estado.refeicoes.length>50)throw new ComparacaoVersoesInvalidaError();
  const ids=new Set<string>();
  for(const r of estado.refeicoes){
    const refeicao=objeto(r);
    if(!refeicao||!texto(refeicao.identidadeId)||ids.has(refeicao.identidadeId)||typeof refeicao.ativa!=='boolean'||
      typeof refeicao.selecionada!=='boolean'||!Array.isArray(refeicao.itens))throw new ComparacaoVersoesInvalidaError();
    ids.add(refeicao.identidadeId);
  }
  return {origem,escopo,estado:v.estado,bases:objeto(o.bases)};
}
function marcador(v:unknown):{esquema:string;hash:string}|undefined {
  const o=objeto(v);
  if(!o||!texto(o.esquemaVersao)||typeof o.conteudoHash!=='string'||! /^[a-f0-9]{64}$/i.test(o.conteudoHash))return;
  return {esquema:o.esquemaVersao,hash:o.conteudoHash.toLowerCase()};
}
function compararBase(a:unknown,b:unknown):EstadoBaseVersao {
  const x=marcador(a),y=marcador(b);
  if(!x||!y)return 'nao_documentada';
  if(x.esquema!=='food06-bases-v1'||y.esquema!=='food06-bases-v1')return 'incompativel';
  return x.hash===y.hash?'igual':'alterada';
}
/**
 * Compara estados congelados já autorizados. Não consulta catálogo nem resolve
 * revisões/autorizações. Marcadores iguais significam documentação coincidente,
 * não prova de causalidade. Sem normalização temporal ou comparação diária DRI.
 */
export function compararVersoesFactuais(antes:VersaoFactualResolvida,depois:VersaoFactualResolvida):ComparacaoVersoesFactuais {
  const a=validar(antes),b=validar(depois);
  if(a.escopo.tenantId!==b.escopo.tenantId||a.escopo.pacienteId!==b.escopo.pacienteId)throw new ComparacaoVersoesInvalidaError();
  const comparacao=compararCenariosFactuais([a.estado],[b.estado]);
  const bases=Object.fromEntries(DIMENSOES_VERSAO.map(d=>[d,compararBase(a.bases?.[d],b.bases?.[d])])) as ComparacaoVersoesFactuais['bases'];
  const cobertura=Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(c=>{
    const x=comparacao.antes.cobertura.nutrientes[c],y=comparacao.depois.cobertura.nutrientes[c];
    const resumo=(n:typeof x)=>JSON.stringify([n.estado,n.contagens.incluidos,n.contagens.conhecidos,n.contagens.semComposicao,
      n.contagens.incompativeis,n.contagens.naoResolvidos,[...n.causas].sort((a,b)=>a.codigo<b.codigo?-1:a.codigo>b.codigo?1:0)]);
    return [c,resumo(x)===resumo(y)?'igual':'alterada'];
  })) as ComparacaoVersoesFactuais['cobertura'];
  return {schemaVersao:1,motorVersao:'food06-versoes-factuais-v1',escopoComparacao:'total_de_cada_versao_separadamente',
    antes:a.origem,depois:b.origem,comparacao,bases,cobertura,atribuicaoCausal:'nao_estabelecida'};
}
