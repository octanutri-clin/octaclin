import { ProcessadorLembretesAcompanhamento } from './processador-lembretes-acompanhamento';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';

jest.mock('../../../infraestrutura/processamento/rodada-por-tenant', () => ({
  executarPorTenantAtivo: jest.fn(async (_fonte, _logger, _nome, executar) => executar('tenant-a'))
}));

function cenario(ativo = true) {
  const agora = new Date('2026-10-08T11:00:00Z');
  const config = { tenantId: 'tenant-a', chave: 'lembretes_acompanhamento', valor: {
    plano: { ativo, intervaloDias: 7, ativadoEm: '2026-09-30T10:00:00.000Z' },
    tarefas: { ativo, antecedenciaHoras: 24, ativadoEm: '2026-09-30T10:00:00.000Z' }
  } };
  const mensagens: Record<string, unknown>[] = [];
  const eventos: Record<string, unknown>[] = [];
  const mensagensRepo = { findOne: jest.fn(async () => null), create: jest.fn((dados) => dados), save: jest.fn(async (dados) => { mensagens.push(dados); return dados; }) };
  const outboxRepo = { create: jest.fn((dados) => dados), save: jest.fn(async (dados) => { eventos.push(dados); return dados; }) };
  const manager = { query: jest.fn(async (sql: string) => {
    if (sql.includes('pg_try_advisory_xact_lock')) return [{ obtido: true }];
    if (sql.includes('fase296-planos')) return [{ planoId: 'plano-a', pacienteId: 'paciente-a', versaoId: 'versao-a', publicadaEm: new Date('2026-10-01T10:00:00Z'), ciclo: 1 }];
    if (sql.includes('fase296-tarefas')) return [{ tarefaId: 'tarefa-a', pacienteId: 'paciente-a', criadoEm: new Date('2026-10-02T10:00:00Z'), vencimentoEm: new Date('2026-10-09T09:00:00Z'), status: 'pendente' }];
    return [];
  }), getRepository: jest.fn((entidade) => {
    if (entidade === TenantConfiguracaoOrm) return { findOne: jest.fn(async () => config) };
    if (entidade === MensagemNotificacaoOrm) return mensagensRepo;
    if (entidade === OutboxEventoOrm) return outboxRepo;
    return undefined;
  }) };
  const executor = { executar: jest.fn(async (_tenant, fn) => fn(manager)) };
  const cripto = { criptografar: jest.fn((texto: string) => Buffer.from(texto)) };
  const processador = new ProcessadorLembretesAcompanhamento({} as never, executor as never, cripto as never);
  return { processador, manager, mensagens, eventos, mensagensRepo, agora };
}

describe('ProcessadorLembretesAcompanhamento', () => {
  it('não consulta recursos nem grava mensagens quando ambos os lembretes estão desligados', async () => {
    const { processador, manager, mensagens, eventos, agora } = cenario(false);
    await processador.agendarPendentes(agora);
    expect(manager.query).not.toHaveBeenCalledWith(expect.stringContaining('fase296-planos'), expect.anything());
    expect(mensagens).toHaveLength(0);
    expect(eventos).toHaveLength(0);
  });

  it('grava aviso genérico e outbox de cada ocorrência sem conteúdo clínico', async () => {
    const { processador, manager, mensagens, eventos, agora } = cenario();
    await processador.agendarPendentes(agora);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'),
      ['lembretes-acompanhamento:tenant-a']);
    expect(mensagens).toHaveLength(2);
    expect(eventos).toHaveLength(2);
    expect(mensagens.map((item) => item.chaveIdempotencia)).toEqual([
      'plano-acompanhamento:versao-a:1:portal',
      `tarefa-acompanhamento:tarefa-a:${new Date('2026-10-09T09:00:00Z').getTime()}:portal`
    ]);
    expect(JSON.stringify(eventos)).not.toContain('paciente-a');
    expect(JSON.stringify(eventos)).not.toContain('Exemplo sintético');
  });

  it('não duplica ocorrência cujo aviso do portal já existe', async () => {
    const { processador, mensagensRepo, mensagens, agora } = cenario();
    mensagensRepo.findOne.mockResolvedValueOnce({ id: 'aviso-ja-criado' } as never);
    await processador.agendarPendentes(agora);
    expect(mensagens).toHaveLength(1);
  });
});
