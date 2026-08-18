import { CriarModelosPlanoAlimentar1720000001031 } from './1720000001031-CriarModelosPlanoAlimentar';

describe('CriarModelosPlanoAlimentar1720000001031', () => {
  async function sqlDaMigracao(): Promise<string> {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarModelosPlanoAlimentar1720000001031().up({ query } as never);
    return String(query.mock.calls[0][0]);
  }

  it('cria a tabela de modelos com RLS forcada e isolamento por tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('create table if not exists modelos_plano_alimentar');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('isolamento_tenant_modelos_plano_alimentar');
    expect(sql).toContain("current_setting('app.tenant_id', true)");
  });

  it('amarra as chaves estrangeiras pelo tenant', async () => {
    const sql = await sqlDaMigracao();
    // FK composta: sem o tenant na chave, um modelo poderia apontar para
    // profissional ou usuario de outro tenant.
    expect(sql).toContain('foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id)');
    expect(sql).toContain('foreign key (tenant_id, criado_por_usuario_id) references usuarios (tenant_id, id)');
    expect(sql).toContain('unique (tenant_id, id)');
  });

  it('restringe a origem e exige profissional apenas no modelo pessoal', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain("origem in ('pessoal', 'clinica')");
    // Modelo pessoal pertence a um profissional; modelo da clinica nao pode
    // ficar preso a um, senao deixaria de ser compartilhado ao desligarem esse
    // profissional.
    expect(sql).toContain('modelos_plano_alimentar_origem_profissional_check');
  });

  it('guarda nome e conteudo criptografados', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('nome_criptografado bytea not null');
    expect(sql).toContain('conteudo_criptografado bytea not null');
  });

  it('indexa a listagem por tenant, origem e arquivamento', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('idx_modelos_plano_alimentar_listagem');
  });

  it('e reversivel', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarModelosPlanoAlimentar1720000001031().down({ query } as never);
    expect(String(query.mock.calls[0][0])).toContain('drop table if exists modelos_plano_alimentar');
  });
});
