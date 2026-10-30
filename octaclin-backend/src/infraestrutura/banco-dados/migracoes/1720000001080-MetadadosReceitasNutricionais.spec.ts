import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
import type { MigrationInterface, QueryRunner } from 'typeorm';

describe('FOOD07 — registro e contrato migration aditiva 1080', () => {
  function migracao(): MigrationInterface {
    const migrations = criarOpcoesTypeOrm().migrations as (new () => MigrationInterface)[];
    const alvo = migrations.find(m => m.name === 'MetadadosReceitasNutricionais1720000001080');
    expect(alvo).toEqual(expect.any(Function));
    if (!alvo) throw new Error('Migration ausente.');
    return new alvo();
  }
  it('registra a migration após 1078, sem importar a 1079 da PR446', async () => {
    const m = migracao();
    const query = jest.fn(async (_sql: string) => []);
    await m.up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(c => c[0]).join('\n');
    expect(sql).toContain('etiquetas_hashes');
    expect(sql).toContain('cardinality');
    expect(sql).toContain('using gin');
    expect(sql).not.toMatch(/drop table|disable row level|noforce|grant|update receitas_nutricionais/i);
  });
  it('recusa down destrutivo e preserva o histórico', async () => {
    await expect(migracao().down({} as QueryRunner)).rejects.toThrow(/Rollback recusado/);
  });
});
