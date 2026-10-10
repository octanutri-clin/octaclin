import { QueryRunner } from 'typeorm';
import { AcompanhamentoGestacional1720000001068 } from './1720000001068-AcompanhamentoGestacional';
describe('AcompanhamentoGestacional1720000001068',() => {
  it('adiciona FKs compostas, FORCE RLS, indices e triggers sem backfill',async () => {
    const query = jest.fn(async (_s: string) => undefined);
    await new AcompanhamentoGestacional1720000001068().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([s]) => s).join('\n');
    for (const tabela of ['gestacoes_pacientes','referencias_gestacao','consentimentos_gestacao']) expect(sql).toContain(`alter table ${tabela} force row level security`);
    expect(sql).toContain('foreign key (tenant_id,paciente_id,gestacao_id)');expect(sql).toContain('trg_avaliacao_gestacional_imutavel');expect(sql).not.toContain('update pacientes');
  });
  it('recusa rollback com dados e consulta sem RLS ocultar linhas',async () => {
    const query = jest.fn(async (s: string) => s.startsWith('select') ? [{ existe: true }] : undefined);
    await expect(new AcompanhamentoGestacional1720000001068().down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query.mock.calls[0][0]).toBe('set local row_security = off');expect(query).toHaveBeenCalledTimes(2);
  });
  it('rollback vazio remove schema sem apagar historia',async () => {
    const query = jest.fn(async (s: string) => s.startsWith('select') ? [{ existe: false }] : undefined);
    await new AcompanhamentoGestacional1720000001068().down({ query } as unknown as QueryRunner);
    expect(query.mock.calls[2][0]).toContain('drop table referencias_gestacao');expect(query.mock.calls.map(([s]) => s).join(' ')).not.toContain('delete from');
  });
});
