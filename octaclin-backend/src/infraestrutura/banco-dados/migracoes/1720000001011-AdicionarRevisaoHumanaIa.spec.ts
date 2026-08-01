import { QueryRunner } from 'typeorm';
import { AdicionarRevisaoHumanaIa1720000001011 } from './1720000001011-AdicionarRevisaoHumanaIa';

describe('AdicionarRevisaoHumanaIa1720000001011', () => {
  it('deve adicionar revisao, limitar cache por paciente e tornar regras rascunhos', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new AdicionarRevisaoHumanaIa1720000001011().up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    expect(sql).toContain('revisao_humana');
    expect(sql).toContain('limitacoes');
    expect(sql).toContain('ALTER COLUMN ativa SET DEFAULT false');
    expect(sql).toContain('resultado @>');
    expect(sql).toContain('(tenant_id, paciente_id, provedor, imagem_hash)');
  });
});
