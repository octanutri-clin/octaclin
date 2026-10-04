import { QueryRunner } from 'typeorm';
import { CriarPermissoesIntegracaoProfissional1720000001063 } from './1720000001063-CriarPermissoesIntegracaoProfissional';

describe('migration 1063 de concessoes de integracao por profissional', () => {
  const migration = new CriarPermissoesIntegracaoProfissional1720000001063();

  it('cria concessoes versionadas com escopos separados e RLS forcada', async () => {
    const query = jest.fn(async (_sql: string) => undefined);

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('create table if not exists permissoes_integracao_profissional');
    expect(sql).toContain('escopos_api');
    expect(sql).toContain('eventos_webhook');
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/force row level security/i);
    expect(sql).toMatch(/unique index[\s\S]*where revogada_em is null/i);
    expect(sql).toMatch(/current_setting\('app\.tenant_id', true\)/i);
    expect(sql).toMatch(/alter table api_chaves add column if not exists profissional_usuario_id uuid/i);
    expect(sql).toMatch(/alter table webhook_assinaturas add column if not exists profissional_usuario_id uuid/i);
    expect(sql).toContain('fk_api_chaves_profissional_usuario');
    expect(sql).toContain('fk_webhook_assinaturas_profissional_usuario');
  });

  it('preserva o historico de autorizacao e bloqueia rollback destrutivo', async () => {
    const query = jest.fn();

    await expect(migration.down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query).not.toHaveBeenCalled();
  });
});
