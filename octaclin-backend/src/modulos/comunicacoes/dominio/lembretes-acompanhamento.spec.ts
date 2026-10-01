import { cicloLembretePlano, tarefaElegivelParaLembrete } from './lembretes-acompanhamento';

describe('lembretes de acompanhamento', () => {
  const ativadoEm = new Date('2026-09-30T10:00:00Z');

  it('não envia para plano publicado antes da ativação ou fora da janela do ciclo', () => {
    expect(cicloLembretePlano(new Date('2026-09-29T10:00:00Z'), ativadoEm, 7, new Date('2026-10-10T10:00:00Z'))).toBeNull();
    expect(cicloLembretePlano(new Date('2026-10-01T10:00:00Z'), ativadoEm, 7, new Date('2026-10-05T10:00:00Z'))).toBeNull();
    expect(cicloLembretePlano(new Date('2026-10-01T10:00:00Z'), ativadoEm, 7, new Date('2026-10-09T11:00:00Z'))).toBeNull();
  });

  it('gera um ciclo estável após cada intervalo configurado', () => {
    const publicado = new Date('2026-10-01T10:00:00Z');
    expect(cicloLembretePlano(publicado, ativadoEm, 7, new Date('2026-10-08T11:00:00Z'))).toBe(1);
    expect(cicloLembretePlano(publicado, ativadoEm, 7, new Date('2026-10-15T11:00:00Z'))).toBe(2);
  });

  it('avisa tarefa nova apenas quando está próxima do vencimento e pendente', () => {
    const criado = new Date('2026-10-01T09:00:00Z');
    const vencimento = new Date('2026-10-03T12:00:00Z');
    expect(tarefaElegivelParaLembrete(criado, vencimento, 'pendente', ativadoEm, 24, new Date('2026-10-02T11:00:00Z'))).toBe(false);
    expect(tarefaElegivelParaLembrete(criado, vencimento, 'pendente', ativadoEm, 24, new Date('2026-10-02T12:10:00Z'))).toBe(true);
    expect(tarefaElegivelParaLembrete(criado, vencimento, 'concluida', ativadoEm, 24, new Date('2026-10-02T12:10:00Z'))).toBe(false);
    expect(tarefaElegivelParaLembrete(new Date('2026-09-29T09:00:00Z'), vencimento, 'pendente', ativadoEm, 24, new Date('2026-10-02T12:10:00Z'))).toBe(false);
    expect(tarefaElegivelParaLembrete(criado, vencimento, 'pendente', ativadoEm, 24, new Date('2026-10-03T12:10:00Z'))).toBe(false);
  });

  it('permite aviso na hora exata do vencimento por até uma hora', () => {
    const criado = new Date('2026-10-01T09:00:00Z');
    const vencimento = new Date('2026-10-03T12:00:00Z');
    expect(tarefaElegivelParaLembrete(criado, vencimento, 'pendente', ativadoEm, 0, new Date('2026-10-03T12:10:00Z'))).toBe(true);
    expect(tarefaElegivelParaLembrete(criado, vencimento, 'pendente', ativadoEm, 0, new Date('2026-10-03T13:01:00Z'))).toBe(false);
  });
});
