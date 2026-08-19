import { LiberarSubstituicoesAoPaciente1720000001032 } from './1720000001032-LiberarSubstituicoesAoPaciente';

describe('LiberarSubstituicoesAoPaciente1720000001032', () => {
  async function sqlDaMigracao(): Promise<string> {
    const query = jest.fn(async (_sql: string) => undefined);
    await new LiberarSubstituicoesAoPaciente1720000001032().up({ query } as never);
    return String(query.mock.calls[0][0]);
  }

  it('adiciona liberacao e preferencia na substituicao, ambas com default false', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('add column if not exists liberada_para_paciente boolean not null default false');
    expect(sql).toContain('add column if not exists preferida boolean not null default false');
  });

  it('preserva o que o paciente ja enxerga, liberando as substituicoes existentes', async () => {
    const sql = await sqlDaMigracao();
    // O portal ja devolvia toda substituicao ao paciente antes desta fase. Se a
    // coluna nascesse `false` sem backfill, todo plano publicado perderia em
    // silencio as trocas que o paciente ve hoje.
    expect(sql).toContain('update plano_alimentar_substituicoes set liberada_para_paciente = true');
  });

  it('limita quantas alternativas aparecem antes de expandir', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('add column if not exists substituicoes_visiveis_inicialmente integer');
    expect(sql).toContain('plano_alimentar_itens_substituicoes_visiveis_check');
  });

  it('cria a trilha de escolhas com RLS forcada e isolamento por tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('create table if not exists plano_alimentar_escolhas_paciente');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('force row level security');
    expect(sql).toContain('isolamento_tenant_plano_alimentar_escolhas_paciente');
    expect(sql).toContain("current_setting('app.tenant_id', true)");
  });

  it('amarra as chaves estrangeiras da trilha pelo tenant', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('foreign key (tenant_id, versao_id) references plano_alimentar_versoes (tenant_id, id)');
    expect(sql).toContain('foreign key (tenant_id, item_id) references plano_alimentar_itens (tenant_id, id)');
    expect(sql).toContain(
      'foreign key (tenant_id, substituicao_id) references plano_alimentar_substituicoes (tenant_id, id)'
    );
    expect(sql).toContain('foreign key (tenant_id, escolhido_por_usuario_id) references usuarios (tenant_id, id)');
  });

  it('nao impoe unique na trilha, que e append-only', async () => {
    const sql = await sqlDaMigracao();
    const trilha = sql.slice(sql.indexOf('create table if not exists plano_alimentar_escolhas_paciente'));
    // Sobrescrever a escolha anterior apagaria justamente o historico que torna
    // o evento auditavel. A escolha vigente e a ultima linha, nao a unica.
    expect(trilha.slice(0, trilha.indexOf(');'))).not.toContain('unique (tenant_id, item_id)');
    expect(sql).toContain('idx_plano_alimentar_escolhas_paciente_vigente');
  });

  it('indexa a trilha por versao para a leitura do portal', async () => {
    const sql = await sqlDaMigracao();
    expect(sql).toContain('idx_plano_alimentar_escolhas_paciente_versao');
  });

  it('e reversivel', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new LiberarSubstituicoesAoPaciente1720000001032().down({ query } as never);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('drop table if exists plano_alimentar_escolhas_paciente');
    expect(sql).toContain('drop column if exists liberada_para_paciente');
    expect(sql).toContain('drop column if exists preferida');
    expect(sql).toContain('drop column if exists substituicoes_visiveis_inicialmente');
  });
});
