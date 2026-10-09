import { QueryRunner } from 'typeorm';
import { AutorizarCompartilhamentoProgressoPortal1720000001064 } from './1720000001064-AutorizarCompartilhamentoProgressoPortal';

describe('migration 1064 de compartilhamento do progresso no portal', () => {
  const migration = new AutorizarCompartilhamentoProgressoPortal1720000001064();

  it('cria selecoes aditivas com valores default privados e categorias fechadas', async () => {
    const query = jest.fn(async (_sql: string) => undefined);

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toMatch(/metricas_compartilhadas_portal jsonb not null default '\[\]'::jsonb/i);
    expect(sql).toContain('["imc", "percentualGordura", "massaMagraKg"]');
    expect(sql).toMatch(/exibir_no_progresso boolean not null default false/i);
    expect(sql).toMatch(/not exibir_no_progresso or categoria = 'meta'/i);
  });

  it('recusa rollback destrutivo das escolhas de compartilhamento', async () => {
    const query = jest.fn();

    await expect(migration.down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query).not.toHaveBeenCalled();
  });
});
