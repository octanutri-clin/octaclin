import { QueryRunner } from 'typeorm';
import { AdicionarIdempotenciaMensagensNotificacao1720000001040 } from './1720000001040-AdicionarIdempotenciaMensagensNotificacao';

describe('AdicionarIdempotenciaMensagensNotificacao1720000001040', () => {
  const sqlDa = async (metodo: 'up' | 'down') => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new AdicionarIdempotenciaMensagensNotificacao1720000001040()[metodo]({ query } as unknown as QueryRunner);
    return query.mock.calls.map(([comando]) => String(comando)).join('\n');
  };

  it('adiciona a coluna e o indice unico parcial por tenant no up', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('add column if not exists chave_idempotencia varchar(200)');
    expect(sql).toContain('create unique index if not exists uq_mensagens_notificacao_tenant_chave_idempotencia');
    expect(sql).toContain('on mensagens_notificacao (tenant_id, chave_idempotencia)');
    expect(sql).toContain('where chave_idempotencia is not null');
  });

  it('remove indice e coluna no down', async () => {
    const sql = await sqlDa('down');

    expect(sql).toContain('drop index if exists uq_mensagens_notificacao_tenant_chave_idempotencia');
    expect(sql).toContain('drop column if exists chave_idempotencia');
  });
});
