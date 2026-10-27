import { ContextosEquivalencias, validarContextosEquivalencias } from './resolver-equivalencias-edicao';
import { DocumentoEdicaoPlano, validarDocumentoEdicaoPlano } from '../dominio/edicao-plano';
import { IntencaoGrupo, objetoGrupo, UUID_GRUPO, validarIntencaoGrupo } from '../dominio/grupos-substituicoes';
import type { SnapshotComposicao } from './servico-planos-alimentares';

export interface ContextoCatalogoGrupo {
  itemChave: string;
  origemGrupo: IntencaoGrupo;
  snapshot: SnapshotComposicao;
}
export type ContextosCatalogoGrupo = Record<string, ContextoCatalogoGrupo>;

export function mesmaOrigemGrupo(a: IntencaoGrupo, b: IntencaoGrupo): boolean {
  return a.grupoId === b.grupoId && a.revisao === b.revisao && a.entradaId === b.entradaId && a.aplicacaoId === b.aplicacaoId;
}

/** Envelope interno cifrado: nunca entra no DTO editorial nem na projecao. */
export function lerSnapshotEdicaoGrupos(valor: unknown, equivalenciasParaParcial?:ContextosEquivalencias): { documento: DocumentoEdicaoPlano; catalogos: ContextosCatalogoGrupo; equivalencias?: ContextosEquivalencias } {
  const bruto = valor as { schemaSnapshotEdicao?: unknown } | null;
  if(bruto?.schemaSnapshotEdicao===3){
    const e=objetoGrupo(valor,['schemaSnapshotEdicao','documento','catalogosGrupos','equivalencias']);
    const equivalencias=validarContextosEquivalencias(e.equivalencias);
    const base=lerSnapshotEdicaoGrupos({schemaSnapshotEdicao:2,documento:e.documento,catalogosGrupos:e.catalogosGrupos},equivalencias);
    for(const [chave,c]of Object.entries(equivalencias)){
      const pai=base.documento.refeicoes.flatMap(r=>r.itens).find(i=>i.chaveCliente===c.itemChave);
      const alternativa=pai?.substituicoes?.find(a=>a.chaveCliente===chave);
      if(!alternativa||(c.estado==='desvinculada_manualmente'?alternativa.equivalencia!=null:alternativa.equivalencia?.aplicacaoId!==c.aplicacaoId))throw new Error('Contexto de equivalência inválido.');
    }
    return {...base,equivalencias};
  }
  if (bruto?.schemaSnapshotEdicao !== 2) return { documento: validarDocumentoEdicaoPlano(valor), catalogos: Object.create(null) };
  const envelope = objetoGrupo(valor, ['schemaSnapshotEdicao', 'documento', 'catalogosGrupos']);
  const documento = validarDocumentoEdicaoPlano(envelope.documento);
  const contextos = envelope.catalogosGrupos;
  if (!contextos || typeof contextos !== 'object' || Array.isArray(contextos) || Object.keys(contextos).length > 10000) throw new Error('Snapshot de catalogo invalido.');
  const catalogos: ContextosCatalogoGrupo = Object.create(null);
  for (const [chave, valor] of Object.entries(contextos)) {
    const c = objetoGrupo(valor, ['itemChave', 'origemGrupo', 'snapshot']);
    const origemGrupo = validarIntencaoGrupo(c.origemGrupo);
    const snapshot = c.snapshot as SnapshotComposicao;
    const pai = documento.refeicoes.flatMap(r => r.itens).find(i => i.chaveCliente === c.itemChave);
    const alternativa = pai?.substituicoes?.find(a => a.chaveCliente === chave);
    if (!snapshot || snapshot.origem !== 'catalogo' || !UUID_GRUPO.test(snapshot.alimentoComposicaoId ?? '') ||
      !snapshot.fonte || typeof snapshot.descricao !== 'string' || !alternativa?.origemGrupo ||
      alternativa.alimentoComposicaoId !== snapshot.alimentoComposicaoId || !mesmaOrigemGrupo(origemGrupo, alternativa.origemGrupo)) throw new Error('Snapshot de catalogo invalido.');
    const n = snapshot.nutrientesPor100g;
    const nutrientesInvalidos=!n||Object.values(n).some(v=>v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<0));
    const nutrientesEssenciaisAusentes=!n||[n.energiaKcal,n.proteinasG,n.carboidratosG,n.gordurasG].some(v=>v===undefined);
    const contextoFood05=equivalenciasParaParcial?.[chave];
    const parcialAutorizado=Boolean(contextoFood05&&contextoFood05.estado!=='desvinculada_manualmente'&&contextoFood05.alternativa.identidade===`catalogo:${snapshot.alimentoComposicaoId!.toLowerCase()}`&&contextoFood05.alternativa.nutrientes[contextoFood05.nutriente]!==undefined);
    if (nutrientesInvalidos||(nutrientesEssenciaisAusentes&&!parcialAutorizado)) throw new Error('Composicao de catalogo invalida.');
    catalogos[chave] = { itemChave: c.itemChave as string, origemGrupo, snapshot };
  }
  return { documento, catalogos };
}

export function serializarSnapshotEdicaoGrupos(documento: DocumentoEdicaoPlano, catalogos: ContextosCatalogoGrupo, equivalencias: ContextosEquivalencias = {}): string {
  if(Object.keys(equivalencias).length)return JSON.stringify({schemaSnapshotEdicao:3,documento,catalogosGrupos:catalogos,equivalencias:validarContextosEquivalencias(equivalencias)});
  return JSON.stringify(Object.keys(catalogos).length ? { schemaSnapshotEdicao: 2, documento, catalogosGrupos: catalogos } : documento);
}
