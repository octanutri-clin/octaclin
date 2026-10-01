import { AdicionarRevisaoDiarioRapido1720000001059 } from './1720000001059-AdicionarRevisaoDiarioRapido';

describe('AdicionarRevisaoDiarioRapido1720000001059', () => {
  it('adiciona colunas sem copiar conteúdo clínico nem alterar RLS', async () => {
    const executar = jest.fn(async (_sql: string) => undefined);
    await new AdicionarRevisaoDiarioRapido1720000001059().up({ query: executar } as never);
    const sql = executar.mock.calls.map(([comando]) => comando).join('\n');
    expect(sql).toContain('alter table logs_diario_rapido add column if not exists revisado_em timestamptz');
    expect(sql).toContain('add column if not exists revisado_por_usuario_id uuid');
    expect(sql).toContain('idx_diario_rapido_revisao_tenant');
    expect(sql).toContain('idx_acompanhamento_tarefas_lembrete_prazo');
    expect(sql).not.toContain('disable row level security');
  });
});
