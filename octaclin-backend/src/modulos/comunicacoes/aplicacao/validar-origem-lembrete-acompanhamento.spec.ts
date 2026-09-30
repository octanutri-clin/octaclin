import { validarOrigemLembreteAcompanhamento } from './validar-origem-lembrete-acompanhamento';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { AcompanhamentoTarefaOrm } from '../../pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { chaveLembreteTarefa } from '../dominio/lembretes-acompanhamento';

describe('validarOrigemLembreteAcompanhamento', () => {
  const agora = new Date('2026-10-09T08:00:00Z');
  const vencimento = new Date('2026-10-09T09:00:00Z');
  const origem = { tipo: 'tarefa' as const, recursoId: 'tarefa-a',
    chaveIdempotencia: chaveLembreteTarefa('tarefa-a', vencimento) };
  function cenario(ativo: boolean, status = 'pendente', pacienteId = 'paciente-a') {
    const config = { valor: { plano: { ativo: false, intervaloDias: 7 },
      tarefas: { ativo, antecedenciaHoras: 24, ativadoEm: '2026-10-01T10:00:00Z' } } };
    const tarefa = { id: 'tarefa-a', pacienteId, categoria: 'tarefa', status,
      criadoEm: new Date('2026-10-02T10:00:00Z'), vencimentoEm: vencimento };
    const paciente = { id: 'paciente-a', tenantId: 'tenant-a', statusCicloVida: 'ACTIVE' };
    const gerenciador = { getRepository: jest.fn((entidade) => {
      if (entidade === TenantConfiguracaoOrm) return { findOne: async () => config };
      if (entidade === AcompanhamentoTarefaOrm) return { findOne: async () => tarefa };
      if (entidade === PacienteOrm) return { findOne: async (opcoes: { where: { id: string } }) =>
        opcoes.where.id === paciente.id ? paciente : null };
      throw new Error('Entidade inesperada');
    }) };
    return gerenciador;
  }

  it('rejeita configuração desligada e tarefa concluída', async () => {
    await expect(validarOrigemLembreteAcompanhamento(cenario(false) as never, 'tenant-a', origem, agora)).resolves.toBeNull();
    await expect(validarOrigemLembreteAcompanhamento(cenario(true, 'concluida') as never, 'tenant-a', origem, agora)).resolves.toBeNull();
  });

  it('exige vínculo com paciente ativo e chave da data corrente', async () => {
    await expect(validarOrigemLembreteAcompanhamento(cenario(true, 'pendente', 'outro') as never, 'tenant-a', origem, agora)).resolves.toBeNull();
    await expect(validarOrigemLembreteAcompanhamento(cenario(true) as never, 'tenant-a',
      { ...origem, chaveIdempotencia: 'tarefa-acompanhamento:tarefa-a:antiga' }, agora)).resolves.toBeNull();
    await expect(validarOrigemLembreteAcompanhamento(cenario(true) as never, 'tenant-a', origem, agora))
      .resolves.toEqual({ pacienteId: 'paciente-a' });
  });
});
