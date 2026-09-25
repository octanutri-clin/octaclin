import { QueryRunner } from 'typeorm';
import { AdicionarIndicesPerfilPacientes1720000001055 } from './1720000001055-AdicionarIndicesPerfilPacientes';

describe('AdicionarIndicesPerfilPacientes1720000001055', () => {
  it('adiciona indice cego sem coluna em texto puro nem alterar a politica RLS', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new AdicionarIndicesPerfilPacientes1720000001055().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([comando]) => comando.toLowerCase()).join('\n');
    expect(sql).toContain('perfil_filtros_hashes text[] not null');
    expect(sql).toContain('using gin (perfil_filtros_hashes)');
    expect(sql).not.toMatch(/categoria\s+(?:text|varchar)|origem\s+(?:text|varchar)|tags\s+text/);
  });
});
