import { ProtegerResolucaoAgendaPublica1720000001034 } from './1720000001034-ProtegerResolucaoAgendaPublica';

describe('ProtegerResolucaoAgendaPublica1720000001034', () => {
  it('resolve token opaco sem desativar a RLS da tabela', async () => {
    const consultas: string[] = [];
    const query = jest.fn(async (sql: string) => consultas.push(sql));
    await new ProtegerResolucaoAgendaPublica1720000001034().up({ query } as never);

    const sql = String(consultas[0]).toLowerCase();
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = public, pg_temp');
    expect(sql).toContain('where link.token_hash = p_token_hash');
    expect(sql).not.toContain('disable row level security');
  });

  it('remove apenas a funcao de resolucao no rollback', async () => {
    const consultas: string[] = [];
    const query = jest.fn(async (sql: string) => consultas.push(sql));
    await new ProtegerResolucaoAgendaPublica1720000001034().down({ query } as never);
    expect(String(consultas[0]).toLowerCase()).toContain(
      'drop function if exists resolver_agenda_link_publico'
    );
  });
});
