import { calcularNutrientesDaPorcaoDecimal } from './calculo-nutricional';
import { razaoDecimal, somarRazoes, subtrairRazoes, formatarRazao, RazaoNutricional } from './decimal-nutricional';
import { FatosComposicaoEquivalencia, NutrienteEquivalencia, NUTRIENTES_EQUIVALENCIA } from './equivalencia-nutriente';
export interface FatosItemRefeicao { chaveCliente:string;porcaoGramas:string;composicao:FatosComposicaoEquivalencia }
export interface ImpactoRefeicao { estado:'completo'|'incompleto';antes:Partial<Record<NutrienteEquivalencia,string>>;depois:Partial<Record<NutrienteEquivalencia,string>>;diferencas:Partial<Record<NutrienteEquivalencia,string>> }
function totais(itens:FatosItemRefeicao[]):Partial<Record<NutrienteEquivalencia,string>> {
 const r:Partial<Record<NutrienteEquivalencia,string>>={};
 for(const n of NUTRIENTES_EQUIVALENCIA){let soma:RazaoNutricional=razaoDecimal('0'),completo=true;
  for(const i of itens){try{const valor=calcularNutrientesDaPorcaoDecimal(i.composicao.nutrientes,i.composicao.baseGramas,i.porcaoGramas)[n];if(valor===undefined){completo=false;break;}soma=somarRazoes(soma,razaoDecimal(valor));}catch{completo=false;break;}}
  if(completo)r[n]=formatarRazao(soma,4);
 }return r;
}
export function simularTrocaNaRefeicao(itens:FatosItemRefeicao[],chavePrincipal:string,alternativa:FatosItemRefeicao):ImpactoRefeicao {
 if(itens.filter(i=>i.chaveCliente===chavePrincipal).length!==1)throw new Error('Principal da simulação inválido.');
 const antes=totais(itens),depois=totais(itens.map(i=>i.chaveCliente===chavePrincipal?alternativa:i)),diferencas:Partial<Record<NutrienteEquivalencia,string>>={};
 for(const n of NUTRIENTES_EQUIVALENCIA)if(antes[n]!==undefined&&depois[n]!==undefined)diferencas[n]=formatarRazao(subtrairRazoes(razaoDecimal(depois[n]),razaoDecimal(antes[n])),4);
 return {estado:NUTRIENTES_EQUIVALENCIA.every(n=>antes[n]!==undefined&&depois[n]!==undefined)?'completo':'incompleto',antes,depois,diferencas};
}
