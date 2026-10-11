import type { QueryRunner } from 'typeorm';
import { ProtegerRetencaoAvaliacoes1720000001069 } from './1720000001069-ProtegerRetencaoAvaliacoes';
describe('1069: retenção de snapshots confirmados sem alterar 1068', () => {
  it('adiciona proteção física sem backfill, nova coluna clínica ou mudar RLS', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new ProtegerRetencaoAvaliacoes1720000001069().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([s]) => s).join('\n');
    expect(sql).toContain('before delete on avaliacoes_antropometricas');
    expect(sql).toContain('old.chave_criacao is not null');
    expect(sql).not.toContain('update pacientes'); expect(sql).not.toContain('disable row level security');
  });
  it('rollback recusa enfraquecer retenção quando há snapshots confirmados', async () => {
    const query = jest.fn(async (sql: string) => sql.startsWith('select') ? [{ existe: true }] : undefined);
    await expect(new ProtegerRetencaoAvaliacoes1720000001069().down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query).toHaveBeenCalledTimes(2);
  });
});
