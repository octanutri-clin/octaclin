import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { ProcessadorOutboxComunicacoes } from './processador-outbox-comunicacoes';

describe('ProcessadorOutboxComunicacoes', () => {
  it('publica um evento uma unica vez quando dois workers concorrentes o encontram', async () => {
    const evento = {
      id: 'evento-1',
      tenantId: 'tenant-1',
      tipo: 'notificacao.enviar',
      status: 'pendente',
      tentativas: 0,
      payload: { mensagemId: 'mensagem-1' },
      criadoEm: new Date()
    } as OutboxEventoOrm;
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
    const fonteDados = {
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
    const executorTenant = {
      executar: (_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorioOutbox })
    };
    const comunicacoes = { publicarEventoNotificacao: jest.fn(async () => undefined) };
    const notificacoes = { processarMensagem: jest.fn(async () => undefined) };
    const anterior = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://localhost:6379';

    try {
      const primeiro = new ProcessadorOutboxComunicacoes(
        fonteDados as never,
        executorTenant as never,
        comunicacoes as never,
        notificacoes as never
      );
      const segundo = new ProcessadorOutboxComunicacoes(
        fonteDados as never,
        executorTenant as never,
        comunicacoes as never,
        notificacoes as never
      );

      await Promise.all([primeiro.processarPendentes(), segundo.processarPendentes()]);
    } finally {
      if (anterior === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = anterior;
    }

    expect(comunicacoes.publicarEventoNotificacao).toHaveBeenCalledTimes(1);
    expect(comunicacoes.publicarEventoNotificacao).toHaveBeenCalledWith('tenant-1', 'mensagem-1');
    expect(notificacoes.processarMensagem).not.toHaveBeenCalled();
  });
});
