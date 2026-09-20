import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { TIPO_OUTBOX_GATILHO_AUTOMACAO } from './disparar-gatilho-automacao';
import { ProcessadorOutboxGatilhosAutomacao } from './processador-outbox-gatilhos-automacao';

function criarFonteDados(repositorioOutbox: unknown) {
  return {
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      query: jest.fn(async (sql: string) => (sql.includes('pg_try_advisory_lock') ? [{ obtida: true }] : []))
    })),
    getRepository: (entidade: unknown) => {
      if (entidade === TenantOrm) return { find: jest.fn(async () => [{ id: 'tenant-1', status: 'ativo' }]) };
      throw new Error('Repositorio inesperado');
    }
  };
}

function criarEvento(sobrepor: Partial<OutboxEventoOrm> = {}): OutboxEventoOrm {
  return {
    id: 'evento-1',
    tenantId: 'tenant-1',
    tipo: TIPO_OUTBOX_GATILHO_AUTOMACAO,
    status: 'pendente',
    tentativas: 0,
    payload: { execucaoId: 'execucao-1', jobId: 'execucao-regra-execucao-1', contexto: { envioId: 'envio-1' } },
    criadoEm: new Date(),
    ...sobrepor
  } as OutboxEventoOrm;
}

describe('ProcessadorOutboxGatilhosAutomacao', () => {
  it('publica o job de automacao uma unica vez quando dois workers concorrentes encontram o mesmo evento', async () => {
    const evento = criarEvento();
    let reivindicado = false;
    const repositorioOutbox = {
      find: jest.fn(async () => [evento]),
      update: jest.fn(async () => {
        if (reivindicado) return { affected: 0 };
        reivindicado = true;
        return { affected: 1 };
      }),
      save: jest.fn(async (entrada: OutboxEventoOrm) => entrada)
    };
    const fonteDados = criarFonteDados(repositorioOutbox);
    const executorTenant = {
      executar: (_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorioOutbox })
    };
    const filaAutomacoes = { add: jest.fn(async () => undefined) };

    const primeiro = new ProcessadorOutboxGatilhosAutomacao(fonteDados as never, executorTenant as never, filaAutomacoes as never);
    const segundo = new ProcessadorOutboxGatilhosAutomacao(fonteDados as never, executorTenant as never, filaAutomacoes as never);

    await Promise.all([primeiro.processarPendentes(), segundo.processarPendentes()]);

    expect(filaAutomacoes.add).toHaveBeenCalledTimes(1);
    expect(filaAutomacoes.add).toHaveBeenCalledWith(
      'avaliar',
      { tenantId: 'tenant-1', execucaoId: 'execucao-1', contexto: { envioId: 'envio-1' } },
      expect.objectContaining({ jobId: 'execucao-regra-execucao-1' })
    );
    expect(repositorioOutbox.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'processado' }));
  });

  it('deixa o evento retomavel (pendente) quando a publicacao na fila falha', async () => {
    const evento = criarEvento();
    const repositorioOutbox = {
      find: jest.fn(async () => [evento]),
      update: jest.fn(async () => ({ affected: 1 })),
      save: jest.fn(async (entrada: OutboxEventoOrm) => entrada)
    };
    const fonteDados = criarFonteDados(repositorioOutbox);
    const executorTenant = {
      executar: (_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorioOutbox })
    };
    const filaAutomacoes = { add: jest.fn(async () => Promise.reject(new Error('fila indisponivel'))) };

    const processador = new ProcessadorOutboxGatilhosAutomacao(fonteDados as never, executorTenant as never, filaAutomacoes as never);
    await processador.processarPendentes();

    expect(repositorioOutbox.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pendente', erro: expect.stringContaining('fila indisponivel') })
    );
    expect(repositorioOutbox.save).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'processado' }));
  });

  it('marca falha definitiva depois do limite de tentativas', async () => {
    const evento = criarEvento({ tentativas: 4 });
    const repositorioOutbox = {
      find: jest.fn(async () => [evento]),
      update: jest.fn(async () => ({ affected: 1 })),
      save: jest.fn(async (entrada: OutboxEventoOrm) => entrada)
    };
    const fonteDados = criarFonteDados(repositorioOutbox);
    const executorTenant = {
      executar: (_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorioOutbox })
    };
    const filaAutomacoes = { add: jest.fn(async () => Promise.reject(new Error('fila indisponivel'))) };

    const processador = new ProcessadorOutboxGatilhosAutomacao(fonteDados as never, executorTenant as never, filaAutomacoes as never);
    await processador.processarPendentes();

    expect(repositorioOutbox.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'falhou' }));
  });

  it('nao processa eventos de outro tipo de outbox', async () => {
    const repositorioOutbox = {
      find: jest.fn(async (opcoes: { where: { tipo: string } }) => {
        expect(opcoes.where.tipo).toBe(TIPO_OUTBOX_GATILHO_AUTOMACAO);
        return [];
      }),
      update: jest.fn(),
      save: jest.fn()
    };
    const fonteDados = criarFonteDados(repositorioOutbox);
    const executorTenant = {
      executar: (_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorioOutbox })
    };
    const filaAutomacoes = { add: jest.fn() };

    const processador = new ProcessadorOutboxGatilhosAutomacao(fonteDados as never, executorTenant as never, filaAutomacoes as never);
    await processador.processarPendentes();

    expect(filaAutomacoes.add).not.toHaveBeenCalled();
  });
});
