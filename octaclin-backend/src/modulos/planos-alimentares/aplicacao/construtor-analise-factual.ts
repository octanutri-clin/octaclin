import { calcularNutrientesParciaisDaPorcao } from '../dominio/calculo-nutricional';
import { createHash } from 'node:crypto';
import { CODIGOS_MICRONUTRIENTES,MAPEAMENTO_MICRONUTRIENTES,decimalComoRazao,decimalParaEscala8,LimitePrecisaoNutricionalError,criarSnapshotMicronutrientes } from '../dominio/micronutrientes';
import { validarVersaoFactualResolvida,type VersaoFactualResolvida,type IdentidadeVersaoFactual } from '../dominio/comparacao-versoes-factuais';
import { resolverContextoDietetico,type EntradaContextoDietetico,type ContextoDieteticoResolvido } from '../dominio/contexto-dietetico';
import { calcularNutrientesCombinados,type ResultadoCalculoCombinado } from '../dominio/calculo-combinado';
import { analisarCoberturaDietetica,type CoberturaDietetica } from '../dominio/cobertura-dietetica';
/** Contrato interno do carregador autorizado, nunca body HTTP ou totais do cliente. */
export interface EntradaConstrutorAnaliseFactual {
 escopo:VersaoFactualResolvida['escopo'];origem:IdentidadeVersaoFactual;
 ativo:boolean;selecionado:boolean;
 refeicoes:{identidadeId:string;ativa:boolean;selecionada:boolean;itens:{porcaoGramas?:number|string;snapshot:unknown}[]}[];
 contexto?:EntradaContextoDietetico;
}
export interface RegistroAnaliseFactual {
 schemaVersao:1;motorVersao:'food06-registro-factual-v1';
 versao:VersaoFactualResolvida;
 analise:{calculo:ResultadoCalculoCombinado;cobertura:CoberturaDietetica};
 contexto?:{dataAnalise:string;resolvido:ContextoDieteticoResolvido};
 referencias:{estado:'indisponivel';motivo:'referencias_nao_habilitadas'};
 avisos:string[];
}
export class AnaliseFactualInvalidaError extends Error {
 constructor(){super('Não foi possível registrar os dados factuais desta versão.');this.name='AnaliseFactualInvalidaError';}
}
const MACROS=['energiaKcal','proteinasG','carboidratosG','gordurasG','fibrasG','sodioMg'];
function objeto(v:unknown):Record<string,unknown> {
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length||
  Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!d.enumerable||!Object.hasOwn(d,'value')))throw new AnaliseFactualInvalidaError();
 return v as Record<string,unknown>;
}
function lista(v:unknown,maximo:number):void {
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>maximo||Object.getOwnPropertySymbols(v).length)throw new AnaliseFactualInvalidaError();
 const ds=Object.getOwnPropertyDescriptors(v);
 if(Object.keys(ds).length!==v.length+1||Object.entries(ds).some(([k,d])=>k!=='length'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=v.length||!d.enumerable||!Object.hasOwn(d,'value'))))throw new AnaliseFactualInvalidaError();
}
function positivo(v:unknown):number {const n=numero(v);if(!n)throw new AnaliseFactualInvalidaError();return n;}
function texto(v:unknown):string|undefined {if(v===undefined)return; if(typeof v!=='string'||v.length>256)throw new AnaliseFactualInvalidaError();return v.normalize('NFC').trim();}
function razao(v:unknown,positivo=false):string[] {
 decimalParaEscala8(v);const {numerador,denominador}=decimalComoRazao(v);
 if(positivo&&!numerador)throw new AnaliseFactualInvalidaError();
 const mdc=(a:bigint,b:bigint):bigint=>b?mdc(b,a%b):a;
 const divisor=mdc(numerador,denominador);return [(numerador/divisor).toString(),(denominador/divisor).toString()];
}
function numero(v:unknown):number {if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw new AnaliseFactualInvalidaError();decimalParaEscala8(v);return v;}
function nutrientes(v:unknown):Record<string,number>|undefined {
 if(v===undefined)return;const o=objeto(v);
 return Object.fromEntries(MACROS.filter(c=>o[c]!==undefined).map(c=>[c,numero(o[c])]));
}
function projetarSnapshot(v:unknown):Record<string,unknown>|null {
 if(v===null||v===undefined)return null;
 const o=objeto(v),r:Record<string,unknown>={};
 for(const c of ['origem','alimentoComposicaoId','codigoOrigem','preparacao'])if(o[c]!==undefined)Object.defineProperty(r,c,{value:texto(o[c]),enumerable:true,writable:true,configurable:true});
 if(r.origem!==undefined&&!['catalogo','manual','custom'].includes(r.origem as string))throw new AnaliseFactualInvalidaError();
 if(o.nutrientesPor100g!==undefined)r.nutrientesPor100g=nutrientes(o.nutrientesPor100g);
 if(o.nutrientesPorcao!==undefined)r.nutrientesPorcao=nutrientes(o.nutrientesPorcao);
 if(o.fonte!==undefined){
  const f=objeto(o.fonte);r.fonte=Object.fromEntries(['codigo','versao','baseCodigo','hashConteudo','esquemaVersao'].filter(c=>f[c]!==undefined).map(c=>[c,c==='hashConteudo'?texto(f[c])?.toLowerCase():texto(f[c])]));
 }
 if(o.composicaoInformada!==undefined){
  const ci=objeto(o.composicaoInformada),micros=objeto(ci.micronutrientes);
  if(!numero(ci.baseGramas)||!texto(ci.normalizacaoVersao))throw new AnaliseFactualInvalidaError();
  r.composicaoInformada={baseGramas:numero(ci.baseGramas),normalizacaoVersao:texto(ci.normalizacaoVersao),
   nutrientes:nutrientes(ci.nutrientes),micronutrientes:Object.fromEntries(CODIGOS_MICRONUTRIENTES.filter(c=>micros[c]!==undefined).map(c=>[c,numero(micros[c])]))};
 }
 if(o.micronutrientes!==undefined){
  const m=objeto(o.micronutrientes);
  // Um registro não pode declarar reprodutível um esquema que não sabe ler.
  // A análise factual existente continua independente desta operação de registro.
  if(m.schemaVersao!==1||m.mapeamentoVersao!==MAPEAMENTO_MICRONUTRIENTES)throw new AnaliseFactualInvalidaError();
  const ns=objeto(m.nutrientes);
  r.micronutrientes={schemaVersao:1,mapeamentoVersao:MAPEAMENTO_MICRONUTRIENTES,baseGramasOrigem:positivo(m.baseGramasOrigem),porcaoGramas:positivo(m.porcaoGramas),
   nutrientes:Object.fromEntries(CODIGOS_MICRONUTRIENTES.filter(c=>ns[c]!==undefined).map(c=>{
    const n=objeto(ns[c]);const estado=texto(n.estado);
    if(!['conhecido','ausente','traco','nao_analisado','em_reavaliacao','abaixo_loq','unidade_incompativel','duplicado','invalido','definicao_incompativel'].includes(estado??''))throw new AnaliseFactualInvalidaError();
    return [c,{estado,...Object.fromEntries(['valorOrigem','por100g','porcao'].filter(k=>n[k]!==undefined).map(k=>[k,numero(n[k])]))}];
   }))};
 }
 return r;
}
function canonicalizar(v:unknown):unknown {
 if(typeof v==='number')return {decimal:razao(v)};
 if(Array.isArray(v))return v.map(canonicalizar);
 if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonicalizar((v as Record<string,unknown>)[k])]));
 return v;
}
function serializar(v:unknown):string{return JSON.stringify(canonicalizar(v));}
function marcador(v:unknown){return {esquemaVersao:'food06-bases-v1',conteudoHash:createHash('sha256').update(serializar(v)).digest('hex')};}
function congelar(v:unknown):void {if(v&&typeof v==='object'){for(const x of Object.values(v))congelar(x);Object.freeze(v);}}
/** Só produz envelope em memória. Não autoriza, persiste, consulta fonte ou ativa DRI. */
export function construirAnaliseFactual(entrada:EntradaConstrutorAnaliseFactual):RegistroAnaliseFactual {
 try {
  const e=objeto(entrada);const avisos=new Set<string>();const compostos=new Set<string>();let planejamentoDocumentado=true,composicaoDocumentada=true;
  lista(e.refeicoes,50);if(typeof e.ativo!=='boolean'||typeof e.selecionado!=='boolean')throw new AnaliseFactualInvalidaError();
  let quantidade=0;
  const grupos:unknown[]=[];
  const refeicoes=entrada.refeicoes.map(ref=>{
   objeto(ref);lista(ref.itens,10000);if(typeof ref.ativa!=='boolean'||typeof ref.selecionada!=='boolean')throw new AnaliseFactualInvalidaError();
   const incluida=e.ativo&&e.selecionado&&ref.ativa&&ref.selecionada;
   const planejamentoItens:unknown[]=[];
   const itens=incluida?ref.itens.map(item=>{
    if(++quantidade>10000)throw new AnaliseFactualInvalidaError();objeto(item);
    const s=projetarSnapshot(item.snapshot);
    const porcao=item.porcaoGramas===undefined?undefined:razao(item.porcaoGramas,true);
    if(!s){planejamentoDocumentado=false;composicaoDocumentada=false;return null;}
    const preparo=typeof s.preparacao==='string'?s.preparacao.toLocaleLowerCase('pt-BR').replace(/\s+/g,' '):undefined;
    const fonte=s.fonte as Record<string,unknown>|undefined,m=s.micronutrientes as Record<string,unknown>|undefined;
    if(porcao&&m&&serializar(razao(m.porcaoGramas))!==serializar(porcao)){avisos.add('porcao_divergente');planejamentoDocumentado=false;}
    const ns=s.nutrientesPor100g as Record<string,unknown>|undefined;
    const naPorcao=s.nutrientesPorcao as Record<string,unknown>|undefined;
    if(!s.origem||!ns||MACROS.some(c=>naPorcao?.[c]!==undefined&&ns[c]===undefined))composicaoDocumentada=false;
    if(s.origem==='catalogo'&&(!fonte?.codigo||!fonte.versao||!fonte.baseCodigo||typeof fonte.hashConteudo!=='string'||! /^[a-f0-9]{64}$/.test(fonte.hashConteudo)))composicaoDocumentada=false;
    if(s.origem==='custom'&&!s.composicaoInformada)composicaoDocumentada=false;
    const divergencia=()=>{avisos.add('porcao_divergente');planejamentoDocumentado=false;composicaoDocumentada=false;};
    if(porcao&&ns&&naPorcao){
     const esperados=calcularNutrientesParciaisDaPorcao(ns,Number(item.porcaoGramas)) as Record<string,number|undefined>;
     if(MACROS.some(c=>naPorcao[c]!==undefined&&esperados[c]!==undefined&&decimalParaEscala8(naPorcao[c])!==decimalParaEscala8(esperados[c])))divergencia();
    }
    if(m){
     const valores=m.nutrientes as Record<string,Record<string,unknown>>;
     const origens=Object.fromEntries(Object.entries(valores).map(([c,n])=>[c,{estado:n.estado,valor:n.valorOrigem}]));
     const esperados=criarSnapshotMicronutrientes(origens as Parameters<typeof criarSnapshotMicronutrientes>[0],m.baseGramasOrigem as number,m.porcaoGramas as number);
     for(const c of CODIGOS_MICRONUTRIENTES){
      const n=valores[c];if(n?.estado!=='conhecido')continue;
      if(n.por100g===undefined||n.valorOrigem===undefined||n.porcao===undefined){composicaoDocumentada=false;continue;}
      const esperado=esperados.nutrientes[c];
      if(esperado.estado!=='conhecido'||decimalParaEscala8(n.porcao)!==decimalParaEscala8(esperado.porcao)||decimalParaEscala8(n.por100g)!==decimalParaEscala8(esperado.por100g))divergencia();
     }
    }
    const identidade=s.origem==='catalogo'&&fonte?.baseCodigo&&s.codigoOrigem?{base:fonte.baseCodigo,codigo:s.codigoOrigem,preparacao:preparo}:undefined;
    if(!identidade||!porcao)planejamentoDocumentado=false;
    planejamentoItens.push({identidade,porcao});
    const micros=m?{schemaVersao:m.schemaVersao,mapeamentoVersao:m.mapeamentoVersao,baseGramasOrigem:m.baseGramasOrigem,
      nutrientes:Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(c=>{const n=(m.nutrientes as Record<string,Record<string,unknown>>)[c];return [c,n?{estado:n.estado,valorOrigem:n.valorOrigem,por100g:n.por100g}:{estado:'ausente'}];}))}:undefined;
    compostos.add(serializar({origem:s.origem,preparacao:preparo,codigoOrigem:s.codigoOrigem,fonte,nutrientesPor100g:s.nutrientesPor100g,micronutrientes:micros,composicaoInformada:s.composicaoInformada}));
    if(porcao)s.porcaoRegistroGramas=porcao;
    return s;
   }):[];
   grupos.push({ativa:ref.ativa,selecionada:ref.selecionada,itens:planejamentoItens.map(serializar).sort()});
   return {identidadeId:ref.identidadeId,ativa:ref.ativa,selecionada:ref.selecionada,itens};
  });
  const origemEntrada=objeto(e.origem),escopoEntrada=objeto(e.escopo);
  const versao:VersaoFactualResolvida={escopo:{tenantId:escopoEntrada.tenantId as string,pacienteId:escopoEntrada.pacienteId as string},origem:entrada.origem,
   estado:{planoId:origemEntrada.planoId as string,ativo:entrada.ativo,selecionado:entrada.selecionado,refeicoes},bases:{}};
  const validada=validarVersaoFactualResolvida(versao);versao.origem=validada.origem;
  if(planejamentoDocumentado)versao.bases!.planejamento=marcador({ativo:e.ativo,selecionado:e.selecionado,grupos:grupos.map(serializar).sort()});
  else avisos.add('planejamento_nao_documentado');
  if(composicaoDocumentada)versao.bases!.composicao_fonte=marcador([...compostos].sort());
  else avisos.add('composicao_nao_documentada');
  let contexto:RegistroAnaliseFactual['contexto'];
  if(e.contexto!==undefined){
   objeto(e.contexto);const resolvido=resolverContextoDietetico(entrada.contexto!);
   // Data civil inválida não vira um contexto aparentemente documentado.
   if(resolvido.motivos.includes('data_invalida'))throw new AnaliseFactualInvalidaError();
   contexto={dataAnalise:entrada.contexto!.dataAnalise,resolvido};versao.bases!.contexto=marcador(contexto);
  }
  const r:RegistroAnaliseFactual={schemaVersao:1,motorVersao:'food06-registro-factual-v1',versao,
   analise:{calculo:calcularNutrientesCombinados([versao.estado]),cobertura:analisarCoberturaDietetica([versao.estado])},
   ...(contexto?{contexto}:{}),referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},avisos:[...avisos].sort()};
  congelar(r);return r;
 }catch(erro){if(erro instanceof LimitePrecisaoNutricionalError)throw erro;throw new AnaliseFactualInvalidaError();}
}
