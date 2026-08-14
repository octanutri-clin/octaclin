import { GovernancaCatalogoMultifonte1720000001028 } from './1720000001028-GovernancaCatalogoMultifonte';

describe('GovernancaCatalogoMultifonte1720000001028', () => {
  it('cria governanca fail-closed e preserva somente a TACO conhecida como ativa', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new GovernancaCatalogoMultifonte1720000001028().up({ query } as never);

    const sql = query.mock.calls.map(([comando]) => comando).join('\n');
    expect(sql).toContain('create table catalogos_composicao_alimentos');
    expect(sql).toContain('create table importacoes_catalogo_composicao');
    expect(sql).toContain('create table eventos_governanca_fontes');
    expect(sql).toContain('unique (catalogo_id, versao, base_codigo)');
    expect(sql).toContain("situacao varchar(20) not null default 'em_validacao'");
    expect(sql).toContain("direito_uso_status varchar(24) not null default 'pendente'");
    expect(sql).toContain('fontes_composicao_alimentos_ativacao_check');
    expect(sql).toContain("codigo = 'taco_nepa_unicamp'");
    expect(sql).toContain("versao = 'taco-4a-cmvcol-taco3-v1'");
    expect(sql).toContain("situacao = 'ativa'");
    expect(sql).toContain('idx_fontes_composicao_alimentos_situacao');
    expect(sql).toContain('idx_alimentos_composicao_fonte_nome');
    expect(sql).toContain('trg_proteger_catalogo_composicao_referenciado');
    expect(sql).toContain('trg_proteger_fonte_composicao_ativa');
    expect(sql).toContain('trg_proteger_alimento_fonte_versionada');
    expect(sql).toContain('Transicao de governanca exige ator e motivo.');
    expect(sql).toContain('Importacao do alimento nao pertence a fonte versionada.');
    expect(sql).toContain('revoke insert, update, delete, truncate');
  });

  it('remove somente a extensao aditiva no down', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new GovernancaCatalogoMultifonte1720000001028().down({ query } as never);

    const sql = query.mock.calls.map(([comando]) => comando).join('\n');
    expect(sql).toContain('drop column if exists situacao');
    expect(sql).toContain('drop column if exists base_codigo');
    expect(sql).toContain('drop table if exists importacoes_catalogo_composicao');
    expect(sql).toContain('drop table if exists catalogos_composicao_alimentos');
    expect(sql).not.toContain('drop table fontes_composicao_alimentos');
    expect(sql).not.toContain('drop table alimentos_composicao');
  });
});
