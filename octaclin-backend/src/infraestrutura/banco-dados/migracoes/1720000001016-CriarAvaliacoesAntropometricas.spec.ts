import { QueryRunner } from 'typeorm';
import { CriarAvaliacoesAntropometricas1720000001016 } from './1720000001016-CriarAvaliacoesAntropometricas';

describe('CriarAvaliacoesAntropometricas1720000001016', () => {
  it('cria a tabela com RLS por tenant, restricoes de dominio e indice da serie', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new CriarAvaliacoesAntropometricas1720000001016();

    await migration.up({ query } as unknown as QueryRunner);
    await migration.down({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    expect(sql).toContain('medidas_criptografadas bytea not null');
    expect(sql).toContain('resultado_criptografado bytea not null');
    // A formula fica em claro de proposito: descreve o metodo, nao o paciente.
    expect(sql).toContain('formula_aplicada text');
    expect(sql).toContain("check (protocolo in ('nenhum', 'pollock_3', 'pollock_7', 'faulkner', 'guedes'))");
    expect(sql).toContain("check (sexo is null or sexo in ('masculino', 'feminino'))");
    expect(sql).toContain('alter table avaliacoes_antropometricas force row level security');
    expect(sql).toContain('isolamento_tenant_avaliacoes_antropometricas');
    expect(sql).toContain('idx_avaliacoes_antropometricas_serie');
    expect(sql).toContain('where excluida_em is null');
    expect(sql).toContain('drop table if exists avaliacoes_antropometricas cascade');
  });
});
