import { CompartilharReceitasNutricionais1720000001066 } from './1720000001066-CompartilharReceitasNutricionais';

describe('CompartilharReceitasNutricionais1720000001066', () => {
  it('cria categorias, snapshots, entregas, consentimento e push com FKs/RLS', async () => {
    const executar = jest.fn(async (_sql: string) => undefined);
    await new CompartilharReceitasNutricionais1720000001066().up({ query: executar } as never);
    const sql = executar.mock.calls.map(([comando]) => comando).join('\n').toLowerCase();

    expect(sql).toContain('add column categoria varchar(80)');
    expect(sql).toContain('add column versao_atual integer not null default 1');
    expect(sql).toContain('snapshot_criptografado bytea not null');
    expect(sql).toContain('agendado_para timestamptz');
    expect(sql).toContain('default false');
    expect(sql).toContain('endpoint_criptografado bytea not null');
    expect(sql).toContain('foreign key (tenant_id, receita_id)');
    expect(sql).toContain('foreign key (tenant_id, paciente_id)');
    expect(sql).toContain('unique (tenant_id, idempotencia)');
    expect(sql.match(/force row level security/g)?.length).toBeGreaterThanOrEqual(4);
    expect(sql).toContain("current_setting('app.tenant_id', true)");
    expect(sql).not.toMatch(/update\s+receitas_nutricionais\s+set\s+categoria/i);
  });

  it('recusa rollback automático de compartilhamentos e consentimentos clínicos', async () => {
    const executar = jest.fn(async (_sql: string) => undefined);
    await expect(new CompartilharReceitasNutricionais1720000001066().down({ query: executar } as never))
      .rejects.toThrow('Rollback recusado');
    expect(executar).not.toHaveBeenCalled();
  });
});
