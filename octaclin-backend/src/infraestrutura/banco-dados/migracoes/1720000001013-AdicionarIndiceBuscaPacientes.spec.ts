import { QueryRunner } from 'typeorm';
import { AdicionarIndiceBuscaPacientes1720000001013 } from './1720000001013-AdicionarIndiceBuscaPacientes';

describe('AdicionarIndiceBuscaPacientes1720000001013', () => {
  it('adiciona array de hashes e indice GIN reversivel', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new AdicionarIndiceBuscaPacientes1720000001013();

    await migration.up({ query } as unknown as QueryRunner);
    await migration.down({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    expect(sql).toContain('busca_hashes text[]');
    expect(sql).toContain('USING GIN (busca_hashes)');
    expect(sql).toContain('DROP INDEX IF EXISTS idx_pacientes_busca_hashes');
    expect(sql).toContain('DROP COLUMN IF EXISTS busca_hashes');
  });
});
