import { CriarFiltrosSalvosPacientes1720000001035 } from './1720000001035-CriarFiltrosSalvosPacientes';

describe('CriarFiltrosSalvosPacientes1720000001035', () => {
  async function sqlDaMigracao(): Promise<string> {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarFiltrosSalvosPacientes1720000001035().up({ query } as never);
    return String(query.mock.calls[0][0]);
  }

  it('cria a tabela aditiva com RLS forcada por tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('create table if not exists filtros_salvos_pacientes');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('isolamento_tenant_filtros_salvos_pacientes');
  });

  it('restringe origem e mantem as FKs compostas no tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain("origem in ('pessoal', 'clinica')");
    expect(sql).toContain('foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete cascade');
    expect(sql).toContain('foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id) on delete restrict');
    expect(sql).toContain('filtros_salvos_pacientes_origem_profissional_check');
  });

  it('guarda o nome cifrado, os criterios em jsonb e indexa a listagem', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('nome_criptografado bytea not null');
    expect(sql).toContain('criterios jsonb not null');
    expect(sql).toContain('idx_filtros_salvos_pacientes_listagem');
    expect(sql).toContain('idx_filtros_salvos_pacientes_profissional');
  });

  it('e reversivel fora de producao', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarFiltrosSalvosPacientes1720000001035().down({ query } as never);
    expect(String(query.mock.calls[0][0])).toContain('drop table if exists filtros_salvos_pacientes');
  });
});
