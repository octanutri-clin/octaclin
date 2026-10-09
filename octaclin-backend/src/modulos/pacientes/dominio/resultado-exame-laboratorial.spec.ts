import { numeroDecimal, situacaoFaixa, type ResultadoMarcador } from './resultado-exame-laboratorial';

describe('faixa de um resultado laboratorial', () => {
  const base: ResultadoMarcador = {
    nome: 'Marcador sintético',
    valor: '25',
    unidade: 'mg/dL',
    limiteInferior: '20',
    limiteSuperior: '50'
  };

  it.each([
    ['abaixo do limite inferior', '19,9', 'fora_da_faixa'],
    ['no limite inferior', '20', 'dentro_da_faixa'],
    ['dentro da faixa', '25', 'dentro_da_faixa'],
    ['no limite superior', '50', 'dentro_da_faixa'],
    ['acima do limite superior', '50.1', 'fora_da_faixa']
  ] as const)('classifica valor %s', (_caso, valor, esperado) => {
    expect(situacaoFaixa({ ...base, valor })).toBe(esperado);
  });

  it('aceita faixa unilateral numérica', () => {
    expect(situacaoFaixa({ ...base, valor: '19', limiteSuperior: undefined })).toBe('fora_da_faixa');
    expect(situacaoFaixa({ ...base, valor: '20', limiteSuperior: undefined })).toBe('dentro_da_faixa');
    expect(situacaoFaixa({ ...base, valor: '51', limiteInferior: undefined })).toBe('fora_da_faixa');
  });

  it.each([
    ['sem unidade', { unidade: undefined }],
    ['resultado textual', { valor: '<5' }],
    ['sem limites', { limiteInferior: undefined, limiteSuperior: undefined }],
    ['limite inferior inválido', { limiteInferior: 'aprox. 20' }],
    ['limite superior inválido', { limiteSuperior: 'até 50' }],
    ['limites invertidos', { limiteInferior: '60', limiteSuperior: '50' }]
  ] as const)('não classifica %s', (_caso, alteracao) => {
    expect(situacaoFaixa({ ...base, ...alteracao })).toBeUndefined();
  });

  it('interpreta decimais com vírgula e sinal sem aceitar conteúdo parcial', () => {
    expect(numeroDecimal('-0,25')).toBe(-0.25);
    expect(numeroDecimal('1.5')).toBe(1.5);
    expect(numeroDecimal('1,000.5')).toBeUndefined();
    expect(numeroDecimal('5 mg')).toBeUndefined();
    expect(numeroDecimal('Infinity')).toBeUndefined();
  });
});
