import { QueryRunner } from 'typeorm';
import { ExpandirCategoriaArquivosMidia1720000001045 } from './1720000001045-ExpandirCategoriaArquivosMidia';

describe('ExpandirCategoriaArquivosMidia1720000001045', () => {
  async function executar() {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new ExpandirCategoriaArquivosMidia1720000001045();

    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    return { sqlUp, sqlDown };
  }

  it('amplia o CHECK para aceitar temporario, exportacao e administrativo, sem perder as quatro existentes', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toMatch(
      /check \(categoria in \('exame', 'documento', 'foto', 'diario', 'temporario', 'exportacao', 'administrativo'\)\)/
    );
  });

  it('e reversivel: down restringe de volta as quatro categorias assistenciais originais', async () => {
    const { sqlDown } = await executar();

    expect(sqlDown).toMatch(/check \(categoria in \('exame', 'documento', 'foto', 'diario'\)\)/);
  });
});
