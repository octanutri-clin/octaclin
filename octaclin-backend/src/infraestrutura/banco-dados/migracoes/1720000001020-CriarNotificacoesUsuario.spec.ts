import { QueryRunner } from 'typeorm';
import { CriarNotificacoesUsuario1720000001020 } from './1720000001020-CriarNotificacoesUsuario';

describe('CriarNotificacoesUsuario1720000001020', () => {
  const sqlDa = async (metodo: 'up' | 'down') => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new CriarNotificacoesUsuario1720000001020()[metodo]({ query } as unknown as QueryRunner);
    return query.mock.calls.map(([comando]) => String(comando)).join('\n');
  };

  it('cria notificacoes com RLS forcada', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('create table if not exists notificacoes');
    expect(sql).toContain('alter table notificacoes enable row level security');
    expect(sql).toContain('alter table notificacoes force row level security');
    expect(sql).toContain("current_setting('app.tenant_id', true)");
  });

  it('endereca cada linha a um usuario, sem texto livre', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('usuario_id uuid not null references usuarios(id)');
    // Sem coluna de titulo/corpo: o texto e derivado do tipo na interface, entao
    // nome de paciente e conteudo de mensagem nao existem nesta tabela.
    expect(sql).not.toContain('titulo');
    expect(sql).not.toContain('corpo');
    expect(sql).toContain(
      "check (tipo in ('mensagem_recebida', 'solicitacao_agendamento', 'formulario_respondido', 'falha_envio'))"
    );
  });

  it('impede duas notificacoes do mesmo evento para o mesmo usuario', async () => {
    const sql = await sqlDa('up');

    // Webhook da Meta reentrega e o outbox reprocessa: sem esta unicidade o sino
    // contaria a mesma mensagem varias vezes.
    expect(sql).toContain('create unique index if not exists idx_notificacoes_evento');
    expect(sql).toContain('on notificacoes (tenant_id, usuario_id, tipo, recurso_id)');
  });

  it('indexa por indice parcial a consulta de nao lidas, que e a que roda a cada poll', async () => {
    const sql = await sqlDa('up');

    expect(sql).toContain('create index if not exists idx_notificacoes_nao_lidas');
    expect(sql).toContain('where lido_em is null');
  });

  it('remove a tabela no down', async () => {
    const sql = await sqlDa('down');

    expect(sql).toContain('drop table if exists notificacoes cascade');
  });
});
