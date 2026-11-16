import { linhasDeUpdateReturning } from './linhas-update-returning';

const id = '11111111-1111-4111-8111-111111111111';

describe('linhasDeUpdateReturning (formato real do TypeORM/pg para UPDATE ... RETURNING)', () => {
  it('devolve só as linhas do par [linhas, contagem]', () => {
    expect(linhasDeUpdateReturning([[{ id }], 1])).toEqual([{ id }]);
    expect(linhasDeUpdateReturning([[], 0])).toEqual([]);
  });
  it.each([
    ['lista crua (formato de SELECT/INSERT)', [{ id }]],
    ['contagem divergente', [[{ id }], 2]],
    ['contagem não inteira', [[{ id }], '1']],
    ['linha sem UUID', [[{ id: 'CANARIO' }], 1]],
    ['linha nula', [[null], 1]],
    ['não é lista', { rows: [{ id }] }]
  ])('%s: falha fechado sem eco', (_caso, entrada) => {
    expect(() => linhasDeUpdateReturning(entrada)).toThrow('Operação indisponível.');
  });
});
