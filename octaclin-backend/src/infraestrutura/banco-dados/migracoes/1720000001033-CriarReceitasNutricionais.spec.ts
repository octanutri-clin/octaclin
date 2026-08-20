import { CriarReceitasNutricionais1720000001033 } from './1720000001033-CriarReceitasNutricionais';

describe('CriarReceitasNutricionais1720000001033', () => {
  async function sqlDaMigracao(): Promise<string> {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarReceitasNutricionais1720000001033().up({ query } as never);
    return String(query.mock.calls[0][0]);
  }

  it('cria a biblioteca aditiva com RLS forcada por tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('create table if not exists receitas_nutricionais');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('isolamento_tenant_receitas_nutricionais');
  });

  it('restringe tipo/origem e mantem as FKs compostas no tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain("tipo in ('receita', 'refeicao_pronta')");
    expect(sql).toContain("origem in ('pessoal', 'clinica')");
    expect(sql).toContain('foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id)');
    expect(sql).toContain('foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id)');
    expect(sql).toContain('receitas_nutricionais_origem_profissional_check');
  });

  it('guarda somente snapshots criptografados e indexa a listagem', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('nome_criptografado bytea not null');
    expect(sql).toContain('conteudo_criptografado bytea not null');
    expect(sql).toContain('idx_receitas_nutricionais_listagem');
    expect(sql).toContain('idx_receitas_nutricionais_profissional');
  });

  it('e reversivel fora de producao', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarReceitasNutricionais1720000001033().down({ query } as never);
    expect(String(query.mock.calls[0][0])).toContain('drop table if exists receitas_nutricionais');
  });
});
