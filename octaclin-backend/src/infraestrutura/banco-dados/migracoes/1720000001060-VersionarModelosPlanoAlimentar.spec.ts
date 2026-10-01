import { VersionarModelosPlanoAlimentar1720000001060 } from './1720000001060-VersionarModelosPlanoAlimentar';

describe('VersionarModelosPlanoAlimentar1720000001060', () => {
  it('adiciona versão, histórico cifrado, isolamento RLS e FK composta', async () => {
    const executar = jest.fn(async (_sql: string) => undefined);
    await new VersionarModelosPlanoAlimentar1720000001060().up({ query: executar } as never);
    const sql = executar.mock.calls.map(([comando]) => comando).join('\n').toLowerCase();
    expect(sql).toContain('add column if not exists versao_atual integer not null default 1');
    expect(sql).toContain('nome_criptografado bytea not null');
    expect(sql).toContain('conteudo_criptografado bytea not null');
    expect(sql).toContain('unique (tenant_id, modelo_id, numero)');
    expect(sql).toContain('foreign key (tenant_id, modelo_id)');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql).toContain("current_setting('app.tenant_id', true)");
    expect(sql).toContain('create trigger');
    expect(sql).toContain('before update or delete');
    expect(sql).not.toMatch(/update\s+modelos_plano_alimentar\s+set\s+.*nome_criptografado/is);
  });

  it('recusa rollback destrutivo para preservar revisoes clinicas', async () => {
    const executar = jest.fn(async (_sql: string) => undefined);
    await expect(new VersionarModelosPlanoAlimentar1720000001060().down({ query: executar } as never))
      .rejects.toThrow('Migration 1060 nao pode ser revertida automaticamente porque removeria historico clinico.');
    expect(executar).not.toHaveBeenCalled();
  });
});
