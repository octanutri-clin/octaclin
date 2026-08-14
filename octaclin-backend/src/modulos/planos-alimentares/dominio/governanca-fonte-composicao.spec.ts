import { validarMetadadosAtivacaoFonte } from './governanca-fonte-composicao';

const entradaValida = {
  codigo: 'taco_nepa_unicamp',
  versao: 'taco-4a-cmvcol-taco3-v1',
  baseCodigo: 'cmvcol_taco3',
  urlArtefato: 'https://origem.example/catalogo.xlsx',
  checksumArquivo: 'a'.repeat(64),
  hashConteudo: 'b'.repeat(64),
  esquemaNutrientes: { baseGramas: 100, campos: { energiaKcal: 'kcal' } },
  direitoUsoReferencia: 'licenca-documentada',
  responsavelAprovacao: 'responsavel-clinico'
};

describe('validarMetadadosAtivacaoFonte', () => {
  it('normaliza metadados completos para ativacao', () => {
    expect(validarMetadadosAtivacaoFonte({ ...entradaValida, codigo: ' taco_nepa_unicamp ' })).toEqual({
      ...entradaValida,
      codigo: 'taco_nepa_unicamp'
    });
  });

  it.each([
    ['checksum de artefato', { checksumArquivo: 'invalido' }],
    ['hash de conteudo', { hashConteudo: 'invalido' }],
    ['esquema de nutrientes', { esquemaNutrientes: {} }],
    ['referencia de direito de uso', { direitoUsoReferencia: ' ' }],
    ['responsavel de aprovacao', { responsavelAprovacao: ' ' }]
  ])('recusa ativacao sem %s', (_campo, alteracao) => {
    expect(() => validarMetadadosAtivacaoFonte({ ...entradaValida, ...alteracao })).toThrow();
  });
});
