import { QueryRunner } from 'typeorm';
import { AdicionarCategoriaMensagemNotificacao1720000001044 } from './1720000001044-AdicionarCategoriaMensagemNotificacao';

describe('AdicionarCategoriaMensagemNotificacao1720000001044', () => {
  async function executar() {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new AdicionarCategoriaMensagemNotificacao1720000001044();

    await migration.up({ query } as unknown as QueryRunner);
    const sqlUp = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    query.mockClear();
    await migration.down({ query } as unknown as QueryRunner);
    const sqlDown = query.mock.calls.map(([comando]) => String(comando)).join('\n');

    return { sqlUp, sqlDown };
  }

  it('adiciona categoria com default administrativo, nunca clinico por omissao', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toContain("add column if not exists categoria varchar(20) not null default 'administrativo'");
  });

  it('restringe categoria aos dois valores do modelo', async () => {
    const { sqlUp } = await executar();

    expect(sqlUp).toMatch(/check \(categoria in \('clinico', 'administrativo'\)\)/);
  });

  it('e reversivel: down remove a constraint e a coluna', async () => {
    const { sqlDown } = await executar();

    expect(sqlDown).toContain('drop constraint if exists mensagens_notificacao_categoria_check');
    expect(sqlDown).toContain('drop column if exists categoria');
  });
});
