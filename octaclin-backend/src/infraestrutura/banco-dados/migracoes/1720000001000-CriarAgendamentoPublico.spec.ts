import { getMetadataArgsStorage, type QueryRunner } from 'typeorm';
import { AgendaLinkPublicoOrm } from '../../../modulos/agenda/infraestrutura/agenda-link-publico.orm';
import { CriarAgendamentoPublico1720000001000 } from './1720000001000-CriarAgendamentoPublico';

describe('CriarAgendamentoPublico1720000001000', () => {
  it('usa token hash SHA-256 hexadecimal estrito no modelo e na migracao', async () => {
    const migration = new CriarAgendamentoPublico1720000001000();
    const query = jest.fn().mockResolvedValue(undefined);

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls[0][0] as string;
    const colunaTokenHash = getMetadataArgsStorage().columns.find(
      (coluna) => coluna.target === AgendaLinkPublicoOrm && coluna.propertyName === 'tokenHash'
    );

    expect(colunaTokenHash).toMatchObject({ options: expect.objectContaining({ type: 'char', length: 64, unique: true }) });
    expect(sql).toMatch(/token_hash char\(64\) not null/i);
    expect(sql).toMatch(/check \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/i);
  });

  it('impede solicitacao pendente de carregar referencias de decisao', async () => {
    const migration = new CriarAgendamentoPublico1720000001000();
    const query = jest.fn().mockResolvedValue(undefined);

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls[0][0] as string;

    expect(sql).toMatch(
      /check\s*\(\s*\(\s*status = 'pendente'\s+and\s+paciente_id is null\s+and\s+consulta_id is null\s+and\s+decidida_em is null\s+and\s+decidida_por_usuario_id is null\s*\)\s*or\s*\(\s*status in \('aprovada', 'recusada', 'expirada'\)\s*\)\s*\)/i
    );
  });
});
