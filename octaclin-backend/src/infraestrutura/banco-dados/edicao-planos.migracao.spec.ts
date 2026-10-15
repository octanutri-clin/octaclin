import { MigrationInterface, QueryRunner } from 'typeorm';
import { criarOpcoesTypeOrm } from './opcoes-typeorm';

describe('PA06 migration de edição parcial', () => {
  function migracao() {
    const construtores = criarOpcoesTypeOrm().migrations as Array<new () => MigrationInterface>;
    const construtor = construtores.find(m => m.name === 'EdicaoPlanos1720000001073');
    expect(construtor).toBeDefined();
    return construtor ? new construtor() as MigrationInterface : undefined;
  }
  it('registra colunas aditivas sem relaxar a estrutura clínica ou executar DDL no boot', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await migracao()?.up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls.map(x => x[0]).join('\n');
    for (const coluna of ['rascunho_revisao', 'edicao_protegida', 'edicao_snapshot_criptografado', 'edicao_materializada_revisao']) expect(sql).toContain(coluna);
    expect(sql).not.toMatch(/drop\s|disable row|alter column/i);
    expect(criarOpcoesTypeOrm().migrationsRun).toBe(false);
  });
  it('recusa down que apagaria histórico de edição', async () => {
    const query = jest.fn();
    const instancia = migracao();
    if (instancia) await expect(instancia.down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query).not.toHaveBeenCalled();
  });
});
