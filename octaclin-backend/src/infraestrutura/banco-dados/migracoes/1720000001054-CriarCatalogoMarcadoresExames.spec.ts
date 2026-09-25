import { QueryRunner } from 'typeorm';
import { CriarCatalogoMarcadoresExames1720000001054 } from './1720000001054-CriarCatalogoMarcadoresExames';

describe('CriarCatalogoMarcadoresExames1720000001054', () => {
  it('cria catalogo cifrado com RLS forcada e vinculo tenant-aware opcional', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarCatalogoMarcadoresExames1720000001054().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(([comando]) => String(comando)).join('\n').toLowerCase();

    expect(sql).toContain('create table if not exists catalogo_marcadores_exames');
    expect(sql).toContain('definicao_criptografada bytea not null');
    expect(sql).toContain('alter table catalogo_marcadores_exames force row level security');
    expect(sql).toMatch(/create policy isolamento_tenant_catalogo_marcadores_exames[\s\S]*?using \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)[\s\S]*?with check \(tenant_id = nullif\(current_setting\('app\.tenant_id', true\), ''\)::uuid\)/);
    expect(sql).toContain('add column if not exists catalogo_marcador_id uuid');
    expect(sql).toContain('foreign key (tenant_id, catalogo_marcador_id)');
    expect(sql).toContain('references catalogo_marcadores_exames (tenant_id, id)');
  });
});
