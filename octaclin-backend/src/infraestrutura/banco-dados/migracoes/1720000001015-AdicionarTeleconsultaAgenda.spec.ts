import { QueryRunner } from 'typeorm';
import { AdicionarTeleconsultaAgenda1720000001015 } from './1720000001015-AdicionarTeleconsultaAgenda';

describe('AdicionarTeleconsultaAgenda1720000001015', () => {
  it('adiciona modalidade e link com restricoes reversiveis', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new AdicionarTeleconsultaAgenda1720000001015();

    await migration.up({ query } as unknown as QueryRunner);
    await migration.down({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    expect(sql).toContain("modalidade varchar(20) NOT NULL DEFAULT 'presencial'");
    expect(sql).toContain('link_teleconsulta text');
    expect(sql).toContain("CHECK (modalidade IN ('presencial', 'online'))");
    // Trava no banco a mesma invariante do dominio: presencial nunca guarda sala de video.
    expect(sql).toContain("CHECK (modalidade = 'online' OR link_teleconsulta IS NULL)");
    expect(sql).toContain('DROP COLUMN IF EXISTS link_teleconsulta');
    expect(sql).toContain('DROP COLUMN IF EXISTS modalidade');
  });
});
