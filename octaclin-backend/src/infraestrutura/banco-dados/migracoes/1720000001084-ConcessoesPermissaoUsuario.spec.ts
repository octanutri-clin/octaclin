import type { QueryRunner } from 'typeorm';
import { ConcessoesPermissaoUsuario1720000001084 } from './1720000001084-ConcessoesPermissaoUsuario';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
import { ConcessaoPermissaoUsuarioOrm } from '../../../modulos/auth/infraestrutura/concessao-permissao-usuario.orm';

describe('1084 concessões de permissão por usuário', () => {
  it('registra a migration e a entidade uma única vez, sem ativar synchronize', () => {
    const opcoes = criarOpcoesTypeOrm();
    expect((opcoes.migrations as unknown[]).filter(m => m === ConcessoesPermissaoUsuario1720000001084)).toHaveLength(1);
    expect((opcoes.entities as unknown[]).filter(e => e === ConcessaoPermissaoUsuarioOrm)).toHaveLength(1);
    expect(opcoes.synchronize).toBe(false);
  });
  it('cria somente a estrutura de concessões, com permissão fechada, unicidade ativa, FKs tenant e RLS FORCE', async () => {
    const query = jest.fn(async () => []);
    await new ConcessoesPermissaoUsuario1720000001084().up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.flat().join('\n').toLowerCase();
    expect(sql).toContain('create table concessoes_permissao_usuario');
    expect(sql).toContain("check (permissao in ('restricoes.confirmar'))");
    expect(sql).toMatch(/create unique index[\s\S]*\(tenant_id, usuario_id, permissao\)[\s\S]*where revogada_em is null/);
    for (const campo of ['usuario_id', 'concedida_por', 'revogada_por']) {
      expect(sql).toContain(`foreign key (tenant_id, ${campo}) references usuarios(tenant_id, id) on delete restrict`);
    }
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql.match(/current_setting\('app.tenant_id', true\)/g)).toHaveLength(4);
    expect(sql).not.toMatch(/for (all|delete)\b|insert into|on delete cascade|bypassrls/);
  });

  it.each([
    { isTransactionActive: false, isolamento: 'read committed' },
    { isTransactionActive: true, isolamento: 'repeatable read' },
    { isTransactionActive: true, isolamento: 'serializable' }
  ])('down falha fechado fora de transação READ COMMITTED: %p', async c => {
    const query = jest.fn(async () => [{ transaction_isolation: c.isolamento }]);
    await expect(new ConcessoesPermissaoUsuario1720000001084().down({ query, isTransactionActive: c.isTransactionActive } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query.mock.calls.flat().join('\n')).not.toMatch(/drop |delete |truncate /i);
  });

  it.each([true, undefined])('down preserva dados e estado não verificável (%p)', async existe => {
    const query = jest.fn(async (sql: string) => sql.includes('transaction_isolation') ? [{ transaction_isolation: 'read committed' }]
      : sql.includes("current_setting('row_security')") ? [{ rs: 'off' }] : sql.includes('select exists') ? [{ existe }] : []);
    await expect(new ConcessoesPermissaoUsuario1720000001084().down({ query, isTransactionActive: true } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query.mock.calls.flat().join('\n')).not.toMatch(/drop |delete |truncate /i);
  });
});
