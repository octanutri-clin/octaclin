import { QueryRunner } from 'typeorm';
import { CriarPlanosAlimentares1720000001021 } from './1720000001021-CriarPlanosAlimentares';

describe('CriarPlanosAlimentares1720000001021', () => {
  const sqlDa = async (metodo: 'up' | 'down') => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarPlanosAlimentares1720000001021()[metodo]({ query } as unknown as QueryRunner);
    return query.mock.calls
      .map(([comando]) => String(comando).toLowerCase().replace(/\s+/g, ' ').trim())
      .join(' ');
  };

  it('cria o agregado clinico e o catalogo global de composicao', async () => {
    const sql = await sqlDa('up');

    for (const tabela of [
      'planos_alimentares',
      'plano_alimentar_versoes',
      'plano_alimentar_refeicoes',
      'plano_alimentar_itens',
      'plano_alimentar_substituicoes',
      'fontes_composicao_alimentos',
      'alimentos_composicao'
    ]) {
      expect(sql).toContain(`create table ${tabela}`);
    }
  });

  it('protege todos os vinculos clinicos com chaves compostas tenant-aware', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('create unique index if not exists ux_pacientes_tenant_id_id on pacientes (tenant_id, id)');
    expect(sql).toContain('create unique index if not exists ux_profissionais_tenant_id_id on profissionais (tenant_id, id)');
    expect(sql).toContain('create unique index if not exists ux_usuarios_tenant_id_id on usuarios (tenant_id, id)');
    expect(sql).toContain(
      'foreign key (tenant_id, paciente_id) references pacientes (tenant_id, id) on delete restrict'
    );
    expect(sql).toContain(
      'foreign key (tenant_id, profissional_id) references profissionais (tenant_id, id) on delete restrict'
    );
    expect(sql).toContain(
      'foreign key (tenant_id, plano_id) references planos_alimentares (tenant_id, id) on delete restrict'
    );
    expect(sql).toContain(
      'foreign key (tenant_id, versao_id) references plano_alimentar_versoes (tenant_id, id) on delete restrict'
    );
    expect(sql).toContain(
      'foreign key (tenant_id, refeicao_id) references plano_alimentar_refeicoes (tenant_id, id) on delete restrict'
    );
    expect(sql).toContain(
      'foreign key (tenant_id, item_id) references plano_alimentar_itens (tenant_id, id) on delete restrict'
    );
  });

  it('forca RLS nas cinco tabelas clinicas e mantem o catalogo global fora do tenant', async () => {
    const sql = await sqlDa('up');
    const tabelasClinicas = [
      'planos_alimentares',
      'plano_alimentar_versoes',
      'plano_alimentar_refeicoes',
      'plano_alimentar_itens',
      'plano_alimentar_substituicoes'
    ];

    for (const tabela of tabelasClinicas) {
      expect(sql).toContain(`alter table ${tabela} enable row level security`);
      expect(sql).toContain(`alter table ${tabela} force row level security`);
      expect(sql).toContain(`create policy isolamento_tenant_${tabela}`);
    }

    expect(sql).not.toContain('alter table fontes_composicao_alimentos enable row level security');
    expect(sql).not.toContain('alter table alimentos_composicao enable row level security');
  });

  it('garante um rascunho por plano e vincula o ponteiro publicado ao mesmo plano e tenant', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('create unique index ux_plano_alimentar_versao_rascunho');
    expect(sql).toContain('where publicada_em is null and descartada_em is null');
    expect(sql).toContain(
      'foreign key (tenant_id, id, versao_publicada_atual_id) references plano_alimentar_versoes (tenant_id, plano_id, id)'
    );
    expect(sql).toContain('validar_ponteiro_versao_publicada_plano');
    expect(sql).toContain('versao apontada precisa estar publicada');
  });

  it('torna versoes publicadas e seus filhos imutaveis por triggers', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('bloquear_mutacao_versao_plano_publicada');
    expect(sql).toContain('versao publicada e imutavel');
    expect(sql).toContain('bloquear_mutacao_refeicao_plano_publicado');
    expect(sql).toContain('bloquear_mutacao_item_plano_publicado');
    expect(sql).toContain('bloquear_mutacao_substituicao_plano_publicado');
    expect(sql).toContain('before insert or update or delete on plano_alimentar_refeicoes');
    expect(sql).toContain('before insert or update or delete on plano_alimentar_itens');
    expect(sql).toContain('before insert or update or delete on plano_alimentar_substituicoes');
  });

  it('exige revisao tenant-aware antes da publicacao', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('revisada_em timestamptz');
    expect(sql).toContain('revisada_por_usuario_id uuid');
    expect(sql).toContain(
      'foreign key (tenant_id, revisada_por_usuario_id) references usuarios (tenant_id, id) on delete restrict'
    );
    expect(sql).toContain('revisada_em is not null and revisada_por_usuario_id is not null');
  });

  it('valida de forma diferivel objetivos, refeicao e item antes de publicar', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('objetivos_criptografados is not null');
    expect(sql).toContain('create function validar_publicacao_plano_alimentar()');
    expect(sql).toContain('create constraint trigger trg_validar_publicacao_plano_alimentar');
    expect(sql).toContain('deferrable initially deferred');
    expect(sql).toContain('and not exists (');
    expect(sql).toContain('from plano_alimentar_itens i');
    expect(sql).toContain('plano publicado precisa ter refeicoes preenchidas com ao menos um item em cada uma');
  });

  it('preserva ausencia de dado nutricional como null e rejeita apenas valores negativos', async () => {
    const sql = await sqlDa('up');

    for (const coluna of ['energia_kcal', 'proteinas_g', 'carboidratos_g', 'lipidios_g', 'fibras_g', 'sodio_mg']) {
      expect(sql).toContain(`${coluna} numeric(12,4)`);
      expect(sql).not.toContain(`${coluna} numeric(12,4) not null`);
      expect(sql).toContain(`${coluna} is null or ${coluna} >= 0`);
    }
  });

  it('inclui checks numericos, snapshots e indices das consultas principais', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('check (numero > 0)');
    expect(sql).toContain('check (quantidade > 0)');
    expect(sql).toContain('check (porcao_gramas > 0)');
    expect(sql).toContain('composicao_snapshot_criptografada bytea not null');
    expect(sql).toContain('calculo_snapshot_criptografado bytea');
    expect(sql).toContain('totais_snapshot_criptografado bytea');
    expect(sql).toContain('idx_planos_alimentares_paciente_ativos');
    expect(sql).toContain('idx_plano_alimentar_versoes_publicadas');
    expect(sql).toContain('ux_plano_alimentar_refeicoes_ordem');
    expect(sql).toContain('ux_plano_alimentar_itens_ordem');
    expect(sql).toContain('ux_plano_alimentar_substituicoes_ordem');
  });

  it('remove triggers, funcoes, tabelas e os quatro indices auxiliares criados no up', async () => {
    const sql = await sqlDa('down');

    expect(sql).toContain('drop table if exists plano_alimentar_substituicoes');
    expect(sql).toContain('drop table if exists planos_alimentares');
    expect(sql).toContain('drop table if exists alimentos_composicao');
    expect(sql).toContain('drop function if exists bloquear_mutacao_versao_plano_publicada()');
    expect(sql).toContain('drop function if exists validar_publicacao_plano_alimentar()');
    expect(sql).toContain('drop index if exists ux_pacientes_tenant_id_id');
    expect(sql).toContain('drop index if exists ux_profissionais_tenant_id_id');
    expect(sql).toContain('drop index if exists ux_usuarios_tenant_id_id');
    expect(sql).toContain('drop index if exists ux_avaliacoes_antropometricas_tenant_id_id');
  });
});
