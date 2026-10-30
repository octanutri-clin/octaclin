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
export function lerSnapshotEdicaoGrupos(valor: unknown): { documento: DocumentoEdicaoPlano; catalogos: ContextosCatalogoGrupo } {
  const bruto = valor as { schemaSnapshotEdicao?: unknown } | null;
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
    if (!n || [n.energiaKcal, n.proteinasG, n.carboidratosG, n.gordurasG, ...[n.fibrasG, n.sodioMg].filter(v => v !== undefined)].some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) throw new Error('Composicao de catalogo invalida.');
    catalogos[chave] = { itemChave: c.itemChave as string, origemGrupo, snapshot };
  }
  return { documento, catalogos };
}

export function serializarSnapshotEdicaoGrupos(documento: DocumentoEdicaoPlano, catalogos: ContextosCatalogoGrupo): string {
  return JSON.stringify(Object.keys(catalogos).length ? { schemaSnapshotEdicao: 2, documento, catalogosGrupos: catalogos } : documento);
}
