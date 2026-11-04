import type { PreviaEquivalenciasDto } from './servico-equivalencias-plano';
import { projetarFatosEquivalencia } from './projecao-equivalencias-profissional';
import { ResultadoEquivalencia, NutrienteEquivalencia } from '../dominio/equivalencia-nutriente';
import type { ImpactoRefeicao } from '../dominio/impacto-equivalencia-refeicao';
function macros(n:Partial<Record<NutrienteEquivalencia,string>>){return {energiaKcal:n.energiaKcal,proteinasG:n.proteinasG,carboidratosG:n.carboidratosG,gordurasG:n.gordurasG};}
function impacto(i:ImpactoRefeicao){return {estado:i.estado,antes:macros(i.antes),depois:macros(i.depois),diferencas:macros(i.diferencas)};}
function resultado(r:ResultadoEquivalencia){
 if(r.estado==='indisponivel')return {estado:r.estado,motivo:r.motivo,nutriente:r.nutriente};
 return {estado:r.estado,nutriente:r.nutriente,aplicavel:r.aplicavel,motivosAplicacao:[...r.motivosAplicacao],
  porcaoMatematica:{numerador:r.porcaoMatematica.numerador,denominador:r.porcaoMatematica.denominador},porcaoMatematicaGramas:r.porcaoMatematicaGramas,porcaoMatematicaAproximada:r.porcaoMatematicaAproximada,
  porcaoSugeridaGramas:r.porcaoSugeridaGramas,porcaoEfetivaGramas:r.porcaoEfetivaGramas,nutrienteAlvo:r.nutrienteAlvo,obtido:r.obtido,delta:r.delta,diferencaAbsoluta:r.diferencaAbsoluta,deltaPercentual:r.deltaPercentual,
  nutrientesPorcao:macros(r.nutrientesPorcao),avisos:[...r.avisos]};
}
/** DTO HTTP explícito: fatos internos, ator e hashes de dependência não saem. */
export function projetarPreviaEquivalencias(p:PreviaEquivalenciasDto){return {
 fingerprint:p.fingerprint,rascunhoRevisao:p.rascunhoRevisao,nutriente:p.nutriente,principal:projetarFatosEquivalencia(p.principal),
 alternativas:p.alternativas.map(a=>({chaveCliente:a.chaveCliente,...(a.alimento?{alimento:projetarFatosEquivalencia(a.alimento)}:{}),resultado:resultado(a.resultado),
 ...(a.fingerprint?{fingerprint:a.fingerprint}:{}),...(a.comparacaoIndividual?{comparacaoIndividual:impacto(a.comparacaoIndividual)}:{}),...(a.impacto?{impacto:impacto(a.impacto)}:{}),
 ...(a.medidas?{medidas:{total:a.medidas.total,pagina:a.medidas.pagina,limite:a.medidas.limite,itens:a.medidas.itens.map(m=>({id:m.id,revisao:m.revisao,nome:m.nome,quantidade:m.quantidade,aproximada:m.aproximada,podeAplicarQuantidade:m.podeAplicarQuantidade,gramasAposMedida:m.gramasAposMedida,quantidadeReferencia:m.quantidadeReferencia,pesoReferenciaGramas:m.pesoReferenciaGramas}))}}:{})}))
};}
