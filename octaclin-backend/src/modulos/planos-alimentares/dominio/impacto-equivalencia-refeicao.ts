import { calcularRazoesNutrientesDaPorcao } from './calculo-nutricional';
import { razaoDecimal, somarRazoes, subtrairRazoes, formatarRazao, RazaoNutricional } from './decimal-nutricional';
import { FatosComposicaoEquivalencia, NutrienteEquivalencia, NUTRIENTES_EQUIVALENCIA, formatarRazaoComparacao } from './equivalencia-nutriente';
export interface FatosItemRefeicao { chaveCliente:string;porcaoGramas:string;composicao:FatosComposicaoEquivalencia }
export interface ImpactoRefeicao { estado:'completo'|'incompleto';antes:Partial<Record<NutrienteEquivalencia,string>>;depois:Partial<Record<NutrienteEquivalencia,string>>;diferencas:Partial<Record<NutrienteEquivalencia,string>> }
function totais(itens:FatosItemRefeicao[]):Partial<Record<NutrienteEquivalencia,RazaoNutricional>> {
 const r:Partial<Record<NutrienteEquivalencia,RazaoNutricional>>={};
 for(const n of NUTRIENTES_EQUIVALENCIA){let soma:RazaoNutricional=razaoDecimal('0'),completo=true;
  for(const i of itens){try{const valor=calcularRazoesNutrientesDaPorcao(i.composicao.nutrientes,i.composicao.baseGramas,i.porcaoGramas)[n];if(valor===undefined){completo=false;break;}soma=somarRazoes(soma,valor);}catch{completo=false;break;}}
  if(completo)r[n]=soma;
 }return r;
}
export function simularTrocaNaRefeicao(itens:FatosItemRefeicao[],chavePrincipal:string,alternativa:FatosItemRefeicao):ImpactoRefeicao {
 if(itens.filter(i=>i.chaveCliente===chavePrincipal).length!==1)throw new Error('Principal da simulação inválido.');
 const antesExatos=totais(itens),depoisExatos=totais(itens.map(i=>i.chaveCliente===chavePrincipal?alternativa:i));
 const formatar=(n:Partial<Record<NutrienteEquivalencia,RazaoNutricional>>)=>Object.fromEntries(Object.entries(n).map(([k,v])=>[k,formatarRazao(v,4)]));
 const antes=formatar(antesExatos),depois=formatar(depoisExatos),diferencas:Partial<Record<NutrienteEquivalencia,string>>={};
 for(const n of NUTRIENTES_EQUIVALENCIA)if(antesExatos[n]!==undefined&&depoisExatos[n]!==undefined)diferencas[n]=formatarRazaoComparacao(subtrairRazoes(depoisExatos[n]!,antesExatos[n]!));
 return {estado:NUTRIENTES_EQUIVALENCIA.every(n=>antes[n]!==undefined&&depois[n]!==undefined)?'completo':'incompleto',antes,depois,diferencas};
}
