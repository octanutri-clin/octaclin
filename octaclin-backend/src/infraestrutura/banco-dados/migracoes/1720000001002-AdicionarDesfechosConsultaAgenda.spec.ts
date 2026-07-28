import type { QueryRunner } from 'typeorm';
import { AdicionarDesfechosConsultaAgenda1720000001002 } from './1720000001002-AdicionarDesfechosConsultaAgenda';

describe('AdicionarDesfechosConsultaAgenda1720000001002', () => {
  it('impede sobreposicao de consultas ativas do mesmo profissional no PostgreSQL', async () => {
    const migration = new AdicionarDesfechosConsultaAgenda1720000001002();
    const query = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);

    await migration.up({ query } as unknown as QueryRunner);

    const sqlPreflight = query.mock.calls[0][0] as string;
    const sql = query.mock.calls[1][0] as string;

    expect(sqlPreflight).toMatch(/a\.status in \('agendada',\s*'reagendada'\)/i);
    expect(sqlPreflight).toMatch(/b\.status in \('agendada',\s*'reagendada'\)/i);
    expect(sqlPreflight).toMatch(/b\.inicio_em < a\.fim_em/i);
    expect(sqlPreflight).toMatch(/b\.fim_em > a\.inicio_em/i);
    expect(sql).toMatch(/create extension if not exists btree_gist/i);
    expect(sql).toMatch(
      /add constraint ex_agenda_consultas_profissional_horario_ativo\s+exclude using gist/i
    );
    expect(sql).toMatch(/tenant_id with =/i);
    expect(sql).toMatch(/profissional_id with =/i);
    expect(sql).toMatch(/tstzrange\(inicio_em,\s*fim_em,\s*'\[\)'\) with &&/i);
    expect(sql).toMatch(
      /where \(profissional_id is not null and status in \('agendada',\s*'reagendada'\)\)/i
    );
  });

  it('aborta antes do DDL com diagnostico operacional quando o preflight encontra conflito historico', async () => {
    const migration = new AdicionarDesfechosConsultaAgenda1720000001002();
    const query = jest.fn().mockResolvedValueOnce([
      {
        consulta_id: 'consulta-1',
        consulta_conflitante_id: 'consulta-2',
        tenant_id: 'tenant-1',
        profissional_id: 'profissional-1',
        total_conflitos: '1'
      }
    ]);

    await expect(migration.up({ query } as unknown as QueryRunner)).rejects.toThrow(
      /Migracao de desfechos da agenda bloqueada: 1 par\(es\).+consulta-1\/consulta-2.+Resolva os conflitos manualmente.+nenhuma consulta foi alterada/i
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).not.toMatch(/add constraint/i);
  });

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
    expect(sql).toMatch(
      /drop constraint if exists ex_agenda_consultas_profissional_horario_ativo/i
    );
    expect(sql).not.toMatch(/drop extension/i);
  });
});
