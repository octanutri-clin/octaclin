import { CriarSessoesUsuario1720000001036 } from './1720000001036-CriarSessoesUsuario';

describe('CriarSessoesUsuario1720000001036', () => {
  async function sqlDaMigracao(): Promise<string> {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarSessoesUsuario1720000001036().up({ query } as never);
    return query.mock.calls.map((chamada) => String(chamada[0])).join('\n');
  }

  it('cria a tabela de sessoes com RLS forcada por tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('create table if not exists sessoes_usuario');
    expect(sql).toContain('alter table sessoes_usuario enable row level security');
    expect(sql).toContain('alter table sessoes_usuario force row level security');
    expect(sql).toContain('isolamento_tenant_sessoes_usuario');
  });

  it('amarra a sessao ao usuario dentro do mesmo tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('foreign key (tenant_id, usuario_id) references usuarios (tenant_id, id) on delete cascade');
    expect(sql).toContain('unique (tenant_id, id)');
  });

  it('e aditiva sobre refresh_tokens, sem recriar nem apagar a tabela', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('alter table refresh_tokens add column if not exists sessao_id uuid');
    expect(sql).toContain('alter table refresh_tokens add column if not exists consumido_em timestamptz');
    expect(sql).not.toContain('drop table if exists refresh_tokens');
    expect(sql).not.toContain('truncate');
  });

  it('vincula o refresh token a sessao pelo par tenant/sessao', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('foreign key (tenant_id, sessao_id) references sessoes_usuario (tenant_id, id) on delete cascade');
  });

  it('indexa familia, usuario, sessao e tokens ativos', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('idx_sessoes_usuario_ativas');
    expect(sql).toContain('idx_refresh_tokens_sessao');
    expect(sql).toContain('idx_refresh_tokens_ativos');
  });

  it('nao guarda token em claro nem material sensivel', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).not.toMatch(/token_valor|token_claro|refresh_token\s+text/);
    expect(sql).not.toContain('user_agent');
    expect(sql).not.toContain('ip inet');
  });

  it('reverte apenas o que criou', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarSessoesUsuario1720000001036().down({ query } as never);
    const sql = query.mock.calls.map((chamada) => String(chamada[0])).join('\n');

    expect(sql).toContain('alter table refresh_tokens drop column if exists sessao_id');
    expect(sql).toContain('alter table refresh_tokens drop column if exists consumido_em');
    expect(sql).toContain('drop table if exists sessoes_usuario');
    expect(sql).not.toContain('drop table if exists refresh_tokens');
  });
});
