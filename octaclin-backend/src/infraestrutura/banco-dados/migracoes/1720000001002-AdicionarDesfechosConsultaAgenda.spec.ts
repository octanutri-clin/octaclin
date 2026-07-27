import type { QueryRunner } from 'typeorm';
import { AdicionarDesfechosConsultaAgenda1720000001002 } from './1720000001002-AdicionarDesfechosConsultaAgenda';

describe('AdicionarDesfechosConsultaAgenda1720000001002', () => {
  it('normaliza estados novos antes de restaurar a constraint antiga no down', async () => {
    const migration = new AdicionarDesfechosConsultaAgenda1720000001002();
    const query = jest.fn().mockResolvedValue(undefined);

    await migration.down({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map((call) => call[0] as string).join('\n');
    const indiceNormalizacao = sql.search(/update\s+agenda_consultas/i);
    const indiceConstraint = sql.search(/add constraint chk_agenda_consultas_status/i);

    expect(indiceNormalizacao).toBeGreaterThanOrEqual(0);
    expect(indiceConstraint).toBeGreaterThan(indiceNormalizacao);
    expect(sql).toMatch(/when status = 'reagendada' then 'agendada'/i);
    expect(sql).toMatch(/when status in \('concluida', 'falta'\) then 'cancelada'/i);
  });
});
