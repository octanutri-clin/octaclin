import { MigrationInterface, QueryRunner } from 'typeorm';
import { criarOpcoesTypeOrm } from './opcoes-typeorm';

describe('PA06 ativação — migration aditiva', () => {
  function instancia() {
    const construtor = (criarOpcoesTypeOrm().migrations as Array<new () => MigrationInterface>)
      .find(m => m.name === 'AtivacaoPlanos1720000001074');
    expect(construtor).toBeDefined();
    return construtor ? new construtor() : undefined;
  }
  it('registra estado operacional separado e preserva apenas uma entrega legada por paciente', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await instancia()?.up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(c => c[0]).join('\n').toLowerCase();
    for (const trecho of ['ativo_para_paciente', 'ativacao_revisao', 'ativacao_definida', 'identidades_refeicoes_criptografadas',
      'plano_alimentar_refeicao_estados', 'plano_alimentar_refeicao_vinculos', 'plano_alimentar_ativacao_eventos',
      'rank() over', 'publicada_em desc', 'force row level security', "current_setting('app.tenant_id'"])
      expect(sql).toContain(trecho);
    expect(sql).not.toMatch(/disable trigger|disable row|update plano_alimentar_versoes|update plano_alimentar_refeicoes|drop table/);
    expect(criarOpcoesTypeOrm().migrationsRun).toBe(false);
  });
  it('faz backfill no contexto de cada tenant e deixa empates de publicação desligados', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await instancia()?.up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(c => c[0]).join('\n').toLowerCase();
    expect(sql).toContain('for clinica in select id from tenants');
    expect(sql).toContain("set_config('app.tenant_id', clinica.id::text, true)");
    expect(sql).toContain('r.tenant_id=clinica.id');
    expect(sql).toContain('p.tenant_id=clinica.id');
    expect(sql).toContain('a.empatados=1');
    expect(sql).not.toContain('v.id desc');
  });
  it('cria identidade no insert e bloqueia writer legado depois de uma decisão operacional', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await instancia()?.up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(c => c[0]).join('\n').toLowerCase();
    expect(sql).toContain('after insert on plano_alimentar_refeicoes');
    expect(sql).toContain("current_setting('app.refeicao_identidade_id',true)");
    expect(sql).toContain('revisao_operacional > 0');
    expect(sql).toContain('for update of p');
  });
  it('recusa apagar histórico operacional no rollback', async () => {
    const query = jest.fn();
    const m = instancia();
    if (m) await expect(m.down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query).not.toHaveBeenCalled();
  });
});
