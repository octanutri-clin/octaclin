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

  it('permite historico de links inativos e garante no maximo um link ativo por tenant e profissional', async () => {
    const migration = new CriarAgendamentoPublico1720000001000();
    const query = jest.fn().mockResolvedValue(undefined);

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls[0][0] as string;
    const colunasIndice = getMetadataArgsStorage().indices
      .map((indice) => ({ indice, columns: Array.isArray(indice.columns) ? indice.columns : [] }))
      .find(
        ({ indice, columns }) =>
          indice.target === AgendaLinkPublicoOrm &&
          indice.unique === true &&
          columns.includes('tenantId') &&
          columns.includes('profissionalId') &&
          indice.where === `"ativo" = true`
      );

    expect(sql).not.toMatch(/unique\s*\(\s*tenant_id\s*,\s*profissional_id\s*\)/i);
    expect(sql).toMatch(
      /create unique index if not exists idx_agenda_links_publicos_tenant_profissional_ativo\s+on agenda_links_publicos\s+\(tenant_id, profissional_id\)\s+where ativo = true/i
    );
    expect(colunasIndice?.indice).toBeTruthy();
  });

  it('impede solicitacao pendente de carregar referencias de decisao', async () => {
    const migration = new CriarAgendamentoPublico1720000001000();
    const query = jest.fn().mockResolvedValue(undefined);

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls[0][0] as string;

    expect(sql).toMatch(
      /check\s*\(\s*\(\s*status = 'pendente'\s+and\s+paciente_id is null\s+and\s+consulta_id is null\s+and\s+decidida_em is null\s+and\s+decidida_por_usuario_id is null\s*\)\s*or\s*\(\s*status = 'processando'\s+and\s+paciente_id is null\s+and\s+consulta_id is null\s+and\s+decidida_em is not null\s+and\s+decidida_por_usuario_id is not null\s*\)\s*or\s*\(\s*status in \('aprovada', 'recusada', 'expirada'\)\s*\)\s*\)/i
    );
  });
});
