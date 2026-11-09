import { calcularNutrientesCombinados, type EntradaPlanoCombinado, type ResultadoCalculoCombinado, type CodigoNutrienteCombinado } from './calculo-combinado';
import { analisarCoberturaDietetica, type CoberturaDietetica } from './cobertura-dietetica';
import { MICRONUTRIENTES, decimalParaEscala8, numeroDaEscala8, LimitePrecisaoNutricionalError, type CodigoMicronutriente } from './micronutrientes';
export type DeltaFactual = {estado:'indisponivel';motivo:'composicao_incompleta'} | {
 estado:'calculavel';diferenca:number;
 percentual:{estado:'calculavel';valor:number;arredondado:boolean}|{estado:'indisponivel';motivo:'base_zero'|'limite_precisao'};
};
export interface PreviaDieteticaFactual {
 schemaVersao:1;motorVersao:'food06-previa-factual-v1';
 antes:{calculo:ResultadoCalculoCombinado;cobertura:CoberturaDietetica};
 depois:{calculo:ResultadoCalculoCombinado;cobertura:CoberturaDietetica};
 diferencas:Record<CodigoNutrienteCombinado,{codigo:CodigoNutrienteCombinado;unidade:string;delta:DeltaFactual}>;
 referencias:{estado:'indisponivel';motivo:'referencias_nao_habilitadas'};
}
const ESCALA=100_000_000n;
function numeroComSinal(v:bigint):number {return v<0n?-numeroDaEscala8(-v):numeroDaEscala8(v);}
/** Diferenças dos totais já quantizados pela PA06, nunca aritmética da fonte nutricional. */
function calcularDelta(antes:number,depois:number):DeltaFactual {
 const base=decimalParaEscala8(antes),d=decimalParaEscala8(depois)-base;
 const diferenca=numeroComSinal(d);
 if(base===0n)return {estado:'calculavel',diferenca,percentual:{estado:'indisponivel',motivo:'base_zero'}};
 const numerador=(d<0n?-d:d)*100n*ESCALA;
 const arredondado=(numerador*2n+base)/(2n*base);
 try {
  return {estado:'calculavel',diferenca,percentual:{estado:'calculavel',valor:numeroComSinal(d<0n?-arredondado:arredondado),arredondado:numerador%base!==0n}};
 } catch(erro){
  if(!(erro instanceof LimitePrecisaoNutricionalError))throw erro;
  return {estado:'calculavel',diferenca,percentual:{estado:'indisponivel',motivo:'limite_precisao'}};
 }
}
/**
 * Núcleo interno para comparar estados resolvidos na mesma base factual.
 * Não resolve alimentos, paciente, revisão, direitos ou autorização, não é DTO
 * HTTP e não aplica alterações. API futura deve autorizar e montar os estados
 * server-side a partir de fontes/versões exatas, nunca de totais do navegador.
 */
export function compararCenariosFactuais(estadoAntes:EntradaPlanoCombinado[],estadoDepois:EntradaPlanoCombinado[]):PreviaDieteticaFactual {
 const analisar=(p:EntradaPlanoCombinado[])=>({calculo:calcularNutrientesCombinados(p),cobertura:analisarCoberturaDietetica(p)});
 const antes=analisar(estadoAntes),depois=analisar(estadoDepois);
 const diferencas=Object.fromEntries((Object.keys(antes.calculo.nutrientes) as CodigoNutrienteCombinado[]).map(codigo=>{
  const a=antes.calculo.nutrientes[codigo],b=depois.calculo.nutrientes[codigo];
  const completos=Object.hasOwn(MICRONUTRIENTES,codigo)
   ? antes.cobertura.nutrientes[codigo as CodigoMicronutriente].estado==='COMPLETO'&&depois.cobertura.nutrientes[codigo as CodigoMicronutriente].estado==='COMPLETO'
   : a.estado==='completo'&&b.estado==='completo';
  const delta:DeltaFactual=completos&&a.total!==undefined&&b.total!==undefined
   ? calcularDelta(a.total,b.total):{estado:'indisponivel',motivo:'composicao_incompleta'};
  return [codigo,{codigo,unidade:a.unidade,delta}];
 })) as PreviaDieteticaFactual['diferencas'];
 return {schemaVersao:1,motorVersao:'food06-previa-factual-v1',antes,depois,diferencas,referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'}};
}
