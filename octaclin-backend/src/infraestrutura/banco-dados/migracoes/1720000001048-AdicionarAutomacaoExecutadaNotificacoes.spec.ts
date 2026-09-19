import { QueryRunner } from 'typeorm';
import { AdicionarAutomacaoExecutadaNotificacoes1720000001048 } from './1720000001048-AdicionarAutomacaoExecutadaNotificacoes';

describe('AdicionarAutomacaoExecutadaNotificacoes1720000001048', () => {
  const sqlDa = async (metodo: 'up' | 'down') => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new AdicionarAutomacaoExecutadaNotificacoes1720000001048()[metodo]({ query } as unknown as QueryRunner);
    return query.mock.calls.map(([comando]) => String(comando)).join('\n');
  };

  it('amplia o check preservando todos os tipos existentes', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('drop constraint if exists notificacoes_tipo_check');
    expect(sql).toContain(
      "check (tipo in ('mensagem_recebida', 'solicitacao_agendamento', 'formulario_respondido', 'falha_envio', 'tarefa_concluida', 'automacao_executada'))"
    );
  });

  it('remove somente o tipo novo antes de restaurar o check anterior', async () => {
    const sql = await sqlDa('down');

    expect(sql).toContain("delete from notificacoes where tipo = 'automacao_executada'");
    expect(sql).toContain(
      "check (tipo in ('mensagem_recebida', 'solicitacao_agendamento', 'formulario_respondido', 'falha_envio', 'tarefa_concluida'))"
    );
  });
});
