import { QueryRunner } from 'typeorm';
import { CifrarDetalhesSolicitacoesLgpd1720000001062 } from './1720000001062-CifrarDetalhesSolicitacoesLgpd';

describe('migration 1062 dos detalhes LGPD', () => {
  const migracao = new CifrarDetalhesSolicitacoesLgpd1720000001062();

  it('adiciona coluna cifrada e indice por tenant/protocolo sem apagar metadados', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await migracao.up({ query } as unknown as QueryRunner);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('add column if not exists detalhes_criptografados bytea');
    expect(query.mock.calls[1][0]).toContain("(tenant_id, (metadados->>'protocolo'), aceito_em desc)");
    expect(query.mock.calls.join(' ')).not.toMatch(/drop\s+(table|column)/i);
  });

  it('recusa down que poderia destruir o unico exemplar cifrado', async () => {
    const query = jest.fn();
    await expect(migracao.down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query).not.toHaveBeenCalled();
  });
});
