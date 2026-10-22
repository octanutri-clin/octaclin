import { ServiceUnavailableException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { DocumentoEdicaoPlano } from '../dominio/edicao-plano';
import { AlternativaAnteriorGrupo } from '../dominio/aplicacao-grupos-substituicoes';
import { ContextosAlimentosPersonalizados } from '../dominio/aplicacao-alimentos-personalizados';
import { normalizarComposicaoPersonalizada } from '../dominio/alimentos-personalizados';
import { UUID_GRUPO, validarIntencaoGrupo } from '../dominio/grupos-substituicoes';
import { PlanoAlimentarRefeicaoOrm } from '../infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarItemOrm } from '../infraestrutura/plano-alimentar-item.orm';
import { PlanoAlimentarSubstituicaoOrm } from '../infraestrutura/plano-alimentar-substituicao.orm';
import type { SnapshotComposicao } from './servico-planos-alimentares';

/** O PATCH legado não transporta a proveniência; nunca pode apagá-la implicitamente. */
export async function possuiGruposMaterializados(g: EntityManager, tenantId: string, versaoId: string, crypto: CriptografiaDadosSensiveis): Promise<boolean> {
  const refeicoes = await g.getRepository(PlanoAlimentarRefeicaoOrm).find({ where: { tenantId, versaoId }, select: { id: true }, take: 51 });
  if (refeicoes.length > 50) throw new ServiceUnavailableException('Origem de substituição indisponível.');
  if (!refeicoes.length) return false;
  const itens = await g.getRepository(PlanoAlimentarItemOrm).find({ where: { tenantId, refeicaoId: In(refeicoes.map(r => r.id)) }, select: { id: true }, take: 5001 });
  if (itens.length > 5000) throw new ServiceUnavailableException('Origem de substituição indisponível.');
  if (!itens.length) return false;
  const alternativas = await g.getRepository(PlanoAlimentarSubstituicaoOrm).find({ where: { tenantId, itemId: In(itens.map(i => i.id)) }, select: { composicaoSnapshotCriptografada: true }, take: 10001 });
  if (alternativas.length > 10000) throw new ServiceUnavailableException('Origem de substituição indisponível.');
  for (const alternativa of alternativas) {
    try {
      if (JSON.parse(crypto.descriptografar(alternativa.composicaoSnapshotCriptografada)).origemGrupo) return true;
    } catch { throw new ServiceUnavailableException('Origem de substituição indisponível.'); }
  }
  return false;
}

/** Primeiro save de uma versão clonada: somente filhos da versão já autorizada. */
export async function lerOrigensMaterializadas(g: EntityManager,tenantId: string,versaoId: string,d: DocumentoEdicaoPlano,crypto: CriptografiaDadosSensiveis) {
  const anteriores:Record<string,AlternativaAnteriorGrupo>=Object.create(null),custom:ContextosAlimentosPersonalizados=Object.create(null);
  const itemIds=d.refeicoes.flatMap(r=>r.itens.map(i=>i.chaveCliente)).filter(id=>UUID_GRUPO.test(id));
  const altIds=d.refeicoes.flatMap(r=>r.itens.flatMap(i=>(i.substituicoes??[]).map(a=>a.chaveCliente))).filter(id=>UUID_GRUPO.test(id));
  if(!itemIds.length||!altIds.length)return {anteriores,custom};
  const refeicoes=await g.getRepository(PlanoAlimentarRefeicaoOrm).find({where:{tenantId,versaoId},select:{id:true},take:51});
  if(refeicoes.length>50)throw new ServiceUnavailableException('Origem de substituição indisponível.');
  if(!refeicoes.length)return {anteriores,custom};
  const itens=await g.getRepository(PlanoAlimentarItemOrm).find({where:{tenantId,refeicaoId:In(refeicoes.map(r=>r.id)),id:In(itemIds)},select:{id:true},take:5001});
  if(itens.length>5000)throw new ServiceUnavailableException('Origem de substituição indisponível.');
  if(!itens.length)return {anteriores,custom};
  const alts=await g.getRepository(PlanoAlimentarSubstituicaoOrm).find({where:{tenantId,itemId:In(itens.map(i=>i.id)),id:In(altIds)},take:10001});
  if(alts.length>10000)throw new ServiceUnavailableException('Origem de substituição indisponível.');
  for(const a of alts) {
    try {
      const s=JSON.parse(crypto.descriptografar(a.composicaoSnapshotCriptografada)) as SnapshotComposicao;
      const o=s.origemGrupo;if(!o)continue;
      if(o.schemaVersao!==1)throw new Error();
      const ref=validarIntencaoGrupo({grupoId:o.grupoId,revisao:o.revisao,entradaId:o.entradaId,aplicacaoId:o.aplicacaoId,...(o.confirmarPorcaoDistinta!==undefined?{confirmarPorcaoDistinta:o.confirmarPorcaoDistinta}:{})});
      anteriores[a.id]={itemChave:a.itemId,alimento:{chaveCliente:a.id,alimentoComposicaoId:a.alimentoComposicaoId,descricao:s.descricao,nutrientesPor100g:s.nutrientesPor100g,quantidade:Number(a.quantidade),unidade:a.unidade,porcaoGramas:Number(a.porcaoGramas),origemGrupo:ref}};
      const c=s.composicaoInformada,r=o.referenciaAlimento;
      if(s.origem==='custom'&&c&&r?.origem==='custom'&&o.tipoBaseCustom) {
        if(!UUID_GRUPO.test(r.alimentoId)||!Number.isInteger(r.revisao)||r.revisao!<1)throw new Error();
        const composicao=normalizarComposicaoPersonalizada({nome:s.descricao,...(s.preparacao?{preparacao:s.preparacao}:{}),...(c.referencia?{referenciaComposicao:c.referencia}:{}),base:{tipo:o.tipoBaseCustom,pesoGramas:c.baseGramas},nutrientes:c.nutrientes,micronutrientes:c.micronutrientes});
        if(JSON.stringify(composicao.nutrientesPor100g)!==JSON.stringify(s.nutrientesPor100g))throw new Error();
        custom[a.id]={id:r.alimentoId,revisao:r.revisao!,aplicacaoId:ref.aplicacaoId,composicao,quantidade:Number(a.quantidade),unidade:a.unidade,porcaoGramas:Number(a.porcaoGramas)};
      }
    }catch{throw new ServiceUnavailableException('Origem de substituição indisponível.');}
  }
  return {anteriores,custom};
}
