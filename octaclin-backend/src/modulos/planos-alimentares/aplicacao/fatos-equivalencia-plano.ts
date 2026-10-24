import { EntityManager } from 'typeorm';
import { AlimentoEdicao, numeroEdicao } from '../dominio/edicao-plano';
import { FatosComposicaoEquivalencia, NUTRIENTES_EQUIVALENCIA, NutrienteEquivalencia } from '../dominio/equivalencia-nutriente';
import { FontesGruposSubstituicoes } from './fontes-grupos-substituicoes';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { ContextosAlimentosPersonalizados } from '../dominio/aplicacao-alimentos-personalizados';
import { ContextosCatalogoGrupo, mesmaOrigemGrupo } from './snapshot-edicao-grupos';
import type { SnapshotComposicao } from './servico-planos-alimentares';
import { ConflictException } from '@nestjs/common';
export interface FatosPreservadosEquivalencia { custom: ContextosAlimentosPersonalizados; catalogos: ContextosCatalogoGrupo; equivalencias?: Record<string,{identidade:string;fatos:FatosComposicaoEquivalencia}> }
export function identidadeFatoEquivalencia(a:AlimentoEdicao):string {
 return a.alimentoComposicaoId?'catalogo:'+a.alimentoComposicaoId.toLowerCase():a.alimentoPersonalizado?'custom:'+a.alimentoPersonalizado.id.toLowerCase()+':'+a.alimentoPersonalizado.revisao:'manual:'+a.chaveCliente;
}
function valores(n:Record<string,unknown>):Partial<Record<NutrienteEquivalencia,string>>{
 const r:Partial<Record<NutrienteEquivalencia,string>>={};for(const k of NUTRIENTES_EQUIVALENCIA){const v=n[k];if(v!==undefined&&v!==null&&v!==''){if(typeof v!=='number'&&typeof v!=='string')throw new Error('Composição inválida.');r[k]=String(v).trim().replace(',','.');}}return r;
}
export function fatosDeSnapshotEquivalencia(s:SnapshotComposicao,identidade:string):FatosComposicaoEquivalencia {
 const original=s.composicaoInformada;
 return {identidade,descricao:s.descricao,...(s.preparacao?{preparacao:s.preparacao}:{}),baseGramas:String(original?.baseGramas??100),nutrientes:valores(original?.nutrientes??s.nutrientesPor100g),...(s.fonte?{fonte:{codigo:s.fonte.codigo,versao:s.fonte.versao,hashConteudo:s.fonte.hashConteudo}}:{})};
}
/** Caller já autorizou paciente/plano; contextos só podem vir de cipher servidor. */
export async function resolverFatosEquivalencia(g:EntityManager,tenantId:string,profissionalId:string|undefined,a:AlimentoEdicao,fontes:FontesGruposSubstituicoes,preservados:FatosPreservadosEquivalencia,itemChave?:string):Promise<FatosComposicaoEquivalencia>{
 const identidade=identidadeFatoEquivalencia(a),congelado=preservados.equivalencias?.[a.chaveCliente];
 if(congelado&&congelado.identidade===identidade&&!identidade.startsWith('manual:'))return JSON.parse(JSON.stringify(congelado.fatos));
 const custom=preservados.custom[a.chaveCliente];
 if(a.alimentoPersonalizado&&custom&&custom.id===a.alimentoPersonalizado.id&&custom.revisao===a.alimentoPersonalizado.revisao&&custom.aplicacaoId===a.alimentoPersonalizado.aplicacaoId){
  const c=custom.composicao;return {identidade,descricao:c.nome,...(c.preparacao?{preparacao:c.preparacao}:{}),baseGramas:String(c.baseOrigem.pesoGramas),nutrientes:valores(c.composicaoOrigem.nutrientes),fonte:{codigo:'custom',revisao:custom.revisao}};
 }
 const grupo=preservados.catalogos[a.chaveCliente],ref=(a as {origemGrupo?:any}).origemGrupo;
 if(grupo&&a.alimentoComposicaoId===grupo.snapshot.alimentoComposicaoId&&grupo.itemChave===itemChave&&ref&&mesmaOrigemGrupo(grupo.origemGrupo,ref))return fatosDeSnapshotEquivalencia(grupo.snapshot,identidade);
 if(a.alimentoComposicaoId||a.alimentoPersonalizado){
  const origem=a.alimentoPersonalizado?'custom':'catalogo',id=a.alimentoPersonalizado?.id??a.alimentoComposicaoId!;
  const r=await fontes.resolver(g,tenantId,profissionalId,'pessoal',{id:a.chaveCliente,origem,alimentoId:id,...(a.alimentoPersonalizado?{revisao:a.alimentoPersonalizado.revisao}:{}),quantidade:1,unidade:'g',porcaoGramas:100});
  if(origem==='custom'){
   const c=r.composicao.composicaoCustom;if(!c)throw new ConflictException('Composição indisponível.');
   return {identidade,descricao:c.nome,...(c.preparacao?{preparacao:c.preparacao}:{}),baseGramas:String(c.baseOrigem.pesoGramas),nutrientes:valores(c.composicaoOrigem.nutrientes),fonte:{codigo:'custom',revisao:r.revisao}};
  }
  // O resolver acima segura locks/valida direitos. Ler a origem evita normalização4 intermediária.
  const c=await g.getRepository(AlimentoComposicaoOrm).findOne({where:{id},lock:{mode:'pessimistic_read'}});
  if(!c)throw new ConflictException('Composição indisponível.');
  return {identidade,descricao:c.nome,...(c.preparacao?{preparacao:c.preparacao}:{}),baseGramas:c.baseGramas,nutrientes:valores({energiaKcal:c.energiaKcal,proteinasG:c.proteinasG,carboidratosG:c.carboidratosG,gordurasG:c.lipidiosG}),fonte:r.composicao.fonte};
 }
 if(!a.descricao?.trim())throw new ConflictException('Identificação manual incompleta.');
 return {identidade,descricao:a.descricao,baseGramas:'100',nutrientes:valores(a.nutrientesPor100g??{})};
}
