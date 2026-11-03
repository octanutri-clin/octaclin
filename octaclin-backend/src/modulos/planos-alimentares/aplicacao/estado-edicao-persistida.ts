import type { PlanoAlimentarVersaoOrm } from '../infraestrutura/plano-alimentar-versao.orm';
import type { DocumentoEdicaoPlano } from '../dominio/edicao-plano';
import { lerSnapshotEdicaoGrupos } from './snapshot-edicao-grupos';
/** Mesma regra editorial usada pelo editor; não materializa nem consulta fontes. */
export function lerEstadoEdicaoPersistida(
 versao:Pick<PlanoAlimentarVersaoOrm,'edicaoSnapshotCriptografado'|'edicaoProtegida'|'edicaoMaterializadaRevisao'|'rascunhoRevisao'>,
 decifrar:(valor:Buffer)=>string
):{edicaoEstado:'legado'|'pendente'|'materializada'|'indisponivel';documentoEdicao?:DocumentoEdicaoPlano}{
 if(!versao.edicaoSnapshotCriptografado)return {edicaoEstado:versao.edicaoProtegida&&versao.edicaoMaterializadaRevisao!==versao.rascunhoRevisao?'indisponivel':'legado'};
 try{
  const documentoEdicao=lerSnapshotEdicaoGrupos(JSON.parse(decifrar(versao.edicaoSnapshotCriptografado))).documento;
  return {documentoEdicao,edicaoEstado:versao.edicaoMaterializadaRevisao===versao.rascunhoRevisao?'materializada':'pendente'};
 }catch{return {edicaoEstado:'indisponivel'};}
}
