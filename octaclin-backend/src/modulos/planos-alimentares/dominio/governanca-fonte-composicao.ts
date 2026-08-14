export const SITUACOES_FONTE_COMPOSICAO = ['em_validacao', 'ativa', 'suspensa', 'revogada'] as const;
export type SituacaoFonteComposicao = (typeof SITUACOES_FONTE_COMPOSICAO)[number];

export const STATUS_DIREITO_USO_FONTE = ['pendente', 'aprovado', 'negado', 'expirado'] as const;
export type StatusDireitoUsoFonte = (typeof STATUS_DIREITO_USO_FONTE)[number];

export interface MetadadosAtivacaoFonteComposicao {
  codigo: string;
  versao: string;
  baseCodigo: string;
  urlArtefato: string;
  checksumArquivo: string;
  hashConteudo: string;
  esquemaNutrientes: Record<string, unknown>;
  direitoUsoReferencia: string;
  responsavelAprovacao: string;
}

const SHA256 = /^[0-9a-f]{64}$/;

export function validarMetadadosAtivacaoFonte(
  entrada: MetadadosAtivacaoFonteComposicao
): MetadadosAtivacaoFonteComposicao {
  const textoObrigatorio = (valor: string, campo: string) => {
    const normalizado = valor.trim();
    if (!normalizado) throw new Error(`Fonte de composicao sem ${campo}.`);
    return normalizado;
  };
  const checksumArquivo = entrada.checksumArquivo.trim().toLowerCase();
  const hashConteudo = entrada.hashConteudo.trim().toLowerCase();
  if (!SHA256.test(checksumArquivo)) throw new Error('Fonte de composicao com checksum de artefato invalido.');
  if (!SHA256.test(hashConteudo)) throw new Error('Fonte de composicao com hash de conteudo invalido.');
  if (!entrada.esquemaNutrientes || !Object.keys(entrada.esquemaNutrientes).length) {
    throw new Error('Fonte de composicao sem esquema de nutrientes conhecido.');
  }

  return {
    codigo: textoObrigatorio(entrada.codigo, 'codigo'),
    versao: textoObrigatorio(entrada.versao, 'versao'),
    baseCodigo: textoObrigatorio(entrada.baseCodigo, 'base'),
    urlArtefato: textoObrigatorio(entrada.urlArtefato, 'URL do artefato'),
    checksumArquivo,
    hashConteudo,
    esquemaNutrientes: entrada.esquemaNutrientes,
    direitoUsoReferencia: textoObrigatorio(entrada.direitoUsoReferencia, 'referencia de direito de uso'),
    responsavelAprovacao: textoObrigatorio(entrada.responsavelAprovacao, 'responsavel de aprovacao')
  };
}
