import { QueryRunner } from 'typeorm';
import { AdicionarTarefaConcluidaNotificacoes1720000001039 } from './1720000001039-AdicionarTarefaConcluidaNotificacoes';

describe('AdicionarTarefaConcluidaNotificacoes1720000001039', () => {
  const sqlDa = async (metodo: 'up' | 'down') => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new AdicionarTarefaConcluidaNotificacoes1720000001039()[metodo]({ query } as unknown as QueryRunner);
    return query.mock.calls.map(([comando]) => String(comando)).join('\n');
  };

  it('adiciona tarefa_concluida ao check de tipo no up', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('drop constraint if exists notificacoes_tipo_check');
    expect(sql).toContain(
      "check (tipo in ('mensagem_recebida', 'solicitacao_agendamento', 'formulario_respondido', 'falha_envio', 'tarefa_concluida'))"
    );
  });

  it('remove tarefa_concluida do check de tipo no down, restaurando o conjunto anterior', async () => {
    const sql = await sqlDa('down');

    expect(sql).toContain('drop constraint if exists notificacoes_tipo_check');
    expect(sql).toContain(
      "check (tipo in ('mensagem_recebida', 'solicitacao_agendamento', 'formulario_respondido', 'falha_envio'))"
    );
    expect(sql).not.toContain('tarefa_concluida');
  });
});
