import { calcularPesoMedida } from './medidas-caseiras';
import { razaoDecimal, multiplicarRazoes, dividirRazoes, formatarRazao, compararRazoes } from './decimal-nutricional';
export function projetarMedidaEquivalente(porcaoGramas:string,ref:{nome:string;quantidadeReferencia:number;pesoReferenciaGramas:number}) {
 if(!ref.nome?.trim())throw new Error('Medida inválida.');
 calcularPesoMedida(ref.quantidadeReferencia,ref.pesoReferenciaGramas,ref.quantidadeReferencia);
 const quantidadeExata=dividirRazoes(multiplicarRazoes(razaoDecimal(porcaoGramas),razaoDecimal(ref.quantidadeReferencia)),razaoDecimal(ref.pesoReferenciaGramas));
 const quantidade=formatarRazao(quantidadeExata,3),aproximada=compararRazoes(quantidadeExata,razaoDecimal(quantidade))!==0;
 let gramasAposMedida:string|undefined;try{gramasAposMedida=String(calcularPesoMedida(Number(quantidade),ref.pesoReferenciaGramas,ref.quantidadeReferencia));}catch{/* Só gramas é aplicável; não inventar unidade positiva. */}
 return {nome:ref.nome,quantidade,aproximada,podeAplicarQuantidade:gramasAposMedida!==undefined,...(gramasAposMedida!==undefined?{gramasAposMedida}:{})};
}
