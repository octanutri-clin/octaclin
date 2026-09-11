import { QueryRunner } from 'typeorm';
import { AdicionarStatusEntregaWhatsapp1720000001041 } from './1720000001041-AdicionarStatusEntregaWhatsapp';

describe('AdicionarStatusEntregaWhatsapp1720000001041', () => {
  const sqlDa = async (metodo: 'up' | 'down') => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new AdicionarStatusEntregaWhatsapp1720000001041()[metodo]({ query } as unknown as QueryRunner);
    return query.mock.calls.map(([comando]) => String(comando)).join('\n');
  };

  it('adiciona as colunas de status de entrega no up', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('add column if not exists status_entrega_whatsapp varchar(20)');
    expect(sql).toContain('add column if not exists status_entrega_atualizado_em timestamptz');
  });

  it('remove as colunas no down', async () => {
    const sql = await sqlDa('down');

    expect(sql).toContain('drop column if exists status_entrega_atualizado_em');
    expect(sql).toContain('drop column if exists status_entrega_whatsapp');
  });
});
