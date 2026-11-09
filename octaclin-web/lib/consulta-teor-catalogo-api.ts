import { ErroApiPlanoAlimentar } from './plano-alimentar-api';
import { lerEntradaConsultaTeor, projetarConsultaTeor, type EntradaConsultaTeor } from './consulta-teor-catalogo';
export async function consultarTeorCatalogo(entrada:EntradaConsultaTeor,signal?:AbortSignal){
 const pedido=lerEntradaConsultaTeor(entrada);
 const resposta=await fetch('/api/planos-alimentares/catalogo/teor-micronutriente/consulta',{
  method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(pedido)
 });
 if(!resposta.ok)throw new ErroApiPlanoAlimentar(resposta.status,'Não foi possível consultar o catálogo.');
 return projetarConsultaTeor(await resposta.json(),pedido);
}
