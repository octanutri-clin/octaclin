import { CriarMfaEReautenticacao1720000001037 } from './1720000001037-CriarMfaEReautenticacao';

describe('CriarMfaEReautenticacao1720000001037', () => {
  it('cria armazenamento tenant-scoped com RLS forcada e sem segredo em texto', async () => {
    const consultas: string[] = [];
    await new CriarMfaEReautenticacao1720000001037().up({
      query: jest.fn(async (sql: string) => consultas.push(sql))
    } as never);

    const sql = consultas.join('\n').toLowerCase();
    for (const tabela of ['mfa_fatores_usuario', 'mfa_codigos_recuperacao', 'mfa_desafios']) {
      expect(sql).toContain(`create table if not exists ${tabela}`);
      expect(sql).toContain(`alter table ${tabela} force row level security`);
      expect(sql).toContain(`isolamento_tenant_${tabela}`);
    }
    expect(sql).toContain('segredo_criptografado bytea');
    expect(sql).not.toContain('segredo_texto');
    expect(sql).toContain('ultimo_contador_totp bigint');
    expect(sql).toContain('unique (tenant_id, usuario_id, codigo_hash)');
    expect(sql).toContain('mfa_verificado_em timestamptz');
    expect(sql).toContain("'mfa_obrigatorio'");
  });

  it('rollback remove somente as estruturas aditivas do PR 41', async () => {
    const consultas: string[] = [];
    await new CriarMfaEReautenticacao1720000001037().down({
      query: jest.fn(async (sql: string) => consultas.push(sql))
    } as never);

    const sql = consultas.join('\n').toLowerCase();
    expect(sql).toContain('drop table if exists mfa_desafios');
    expect(sql).toContain('drop table if exists mfa_codigos_recuperacao');
    expect(sql).toContain('drop table if exists mfa_fatores_usuario');
    expect(sql).toContain('drop column if exists mfa_verificado_em');
    expect(sql).not.toContain('drop table if exists usuarios');
  });
});
