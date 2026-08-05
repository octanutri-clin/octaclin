import { QueryRunner } from 'typeorm';
import { CriarDocumentosEmitidos1720000001017 } from './1720000001017-CriarDocumentosEmitidos';

describe('CriarDocumentosEmitidos1720000001017', () => {
  it('cria a tabela com RLS, invariantes e unicidade da declaracao por consulta', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new CriarDocumentosEmitidos1720000001017();

    await migration.up({ query } as unknown as QueryRunner);
    await migration.down({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    expect(sql).toContain('create table if not exists documentos_emitidos');
    expect(sql).toContain('corpo_criptografado bytea not null');
    expect(sql).toContain("check (tipo in ('declaracao_comparecimento', 'relatorio_alta'))");
    // Declaracao sem consulta nao prova comparecimento: invariante fica no banco.
    expect(sql).toContain("check (tipo <> 'declaracao_comparecimento' or consulta_id is not null)");
    expect(sql).toContain('create unique index if not exists idx_documentos_emitidos_declaracao_consulta');
    expect(sql).toContain("where tipo = 'declaracao_comparecimento' and cancelado_em is null");
    expect(sql).toContain('alter table documentos_emitidos force row level security');
    expect(sql).toContain("current_setting('app.tenant_id', true)");
    expect(sql).toContain('drop table if exists documentos_emitidos cascade');
  });
});
