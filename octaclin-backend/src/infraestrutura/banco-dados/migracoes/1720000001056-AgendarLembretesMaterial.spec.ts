import { QueryRunner } from 'typeorm';
import { AgendarLembretesMaterial1720000001056 } from './1720000001056-AgendarLembretesMaterial';

describe('AgendarLembretesMaterial1720000001056', () => {
  it('cria agenda e índice parcial sem atualizar envios anteriores', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new AgendarLembretesMaterial1720000001056().up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => comando.toLowerCase()).join('\n');
    expect(sql).toContain('alter table envios_material_paciente add column if not exists proximo_lembrete_em timestamptz null');
    expect(sql).toContain('create index if not exists idx_envios_material_paciente_proximo_lembrete');
    expect(sql).toContain('where proximo_lembrete_em is not null');
    expect(sql).not.toMatch(/update\s+envios_material_paciente/);
  });
});
