import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { ProcessadorOutboxComunicacoes } from './processador-outbox-comunicacoes';

describe('ProcessadorOutboxComunicacoes', () => {
  it('encaminha o lembrete de acompanhamento somente com tipo e origem válidos', async () => {
    const evento = { id: 'evento-a', tenantId: 'tenant-1', tipo: 'acompanhamento.lembrete',
      status: 'pendente', tentativas: 0, criadoEm: new Date(),
      payload: { tipo: 'tarefa', recursoId: 'tarefa-a', chaveIdempotencia: 'tarefa-acompanhamento:tarefa-a:1' }
    } as OutboxEventoOrm;
    const repo = { find: jest.fn(async () => [evento]), findOne: jest.fn(async () => evento),
      save: jest.fn(async (valor) => valor) };
    const fonte = { createQueryRunner: () => ({ connect: async () => undefined,
      release: async () => undefined, query: async () => [{ obtida: true }] }),
      getRepository: () => ({ find: async () => [{ id: 'tenant-1', status: 'ativo' }] }) };
    const executor = { executar: (_tenant: string, fn: (m: unknown) => Promise<unknown>) =>
      fn({ getRepository: () => repo }) };
    const servico = { processarLembreteAcompanhamento: jest.fn(async () => undefined) };
    await new ProcessadorOutboxComunicacoes(fonte as never, executor as never, servico as never,
      {} as never).processarPendentes();
    expect(servico.processarLembreteAcompanhamento).toHaveBeenCalledWith('tenant-1', evento.payload);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'processado' }));
  });
  it('encaminha o evento de plano publicado ao serviço de comunicações após reivindicar o outbox', async () => {
    const evento = {
      id: 'evento-plano-1',
      tenantId: 'tenant-1',
      tipo: 'plano_alimentar.publicado',
      status: 'pendente',
      tentativas: 0,
      payload: { pacienteId: 'paciente-1', planoId: 'plano-1', versaoId: 'versao-1' },
      criadoEm: new Date()
    } as OutboxEventoOrm;
    const repositorioOutbox = {
      find: jest.fn(async () => [evento]),
      findOne: jest.fn(async () => evento),
      update: jest.fn(async () => ({ affected: 1 })),
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
    const comunicacoes = {
      publicarEventoNotificacao: jest.fn(async () => undefined),
      processarAvisoPlanoPublicado: jest.fn(async () => undefined)
    };
    const notificacoes = { processarMensagem: jest.fn(async () => undefined) };

    const processador = new ProcessadorOutboxComunicacoes(
      fonteDados as never,
      executorTenant as never,
      comunicacoes as never,
      notificacoes as never
    );
    await processador.processarPendentes();

    expect(comunicacoes.processarAvisoPlanoPublicado).toHaveBeenCalledTimes(1);
    expect(comunicacoes.processarAvisoPlanoPublicado).toHaveBeenCalledWith('tenant-1', {
      pacienteId: 'paciente-1', planoId: 'plano-1', versaoId: 'versao-1'
    });
    expect(repositorioOutbox.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'processado',
      tipo: 'plano_alimentar.publicado'
    }));
  });

  it('encaminha lembrete de material com tenant resolvido no ciclo e payload validado', async () => {
    const evento = {
      id: 'evento-material-1', tenantId: 'tenant-1', tipo: 'material.nao_visualizado.lembrete',
      status: 'processando', tentativas: 1,
      reivindicadoEm: new Date(Date.now() - 6 * 60000),
      payload: { envioId: 'envio-1', chaveIdempotencia: 'material-nao-visualizado:envio-1:1' },
      criadoEm: new Date()
    } as OutboxEventoOrm;
    const repositorioOutbox = {
      find: jest.fn(async () => [evento]),
      findOne: jest.fn(async () => evento),
      update: jest.fn(async () => ({ affected: 1 })),
      save: jest.fn(async (entrada: OutboxEventoOrm) => entrada)
    };
    const fonteDados = {
      createQueryRunner: jest.fn(() => ({
        connect: jest.fn(async () => undefined), release: jest.fn(async () => undefined),
        query: jest.fn(async (sql: string) => sql.includes('pg_try_advisory_lock') ? [{ obtida: true }] : [])
      })),
      getRepository: (entidade: unknown) => entidade === TenantOrm
        ? { find: jest.fn(async () => [{ id: 'tenant-1', status: 'ativo' }]) }
        : undefined
    };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorioOutbox })
      )
    };
    const comunicacoes = {
      publicarEventoNotificacao: jest.fn(async () => undefined),
      processarAvisoPlanoPublicado: jest.fn(async () => undefined),
      processarLembreteMaterialNaoVisualizado: jest.fn(async () => undefined)
    };
    const notificacoes = { processarMensagem: jest.fn(async () => undefined) };

    await new ProcessadorOutboxComunicacoes(
      fonteDados as never, executorTenant as never, comunicacoes as never, notificacoes as never
    ).processarPendentes();

    expect(comunicacoes.processarLembreteMaterialNaoVisualizado).toHaveBeenCalledWith('tenant-1', {
      envioId: 'envio-1', chaveIdempotencia: 'material-nao-visualizado:envio-1:1'
    });
    expect(repositorioOutbox.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.arrayContaining([expect.objectContaining({ status: 'processando' })])
    }));
    expect(repositorioOutbox.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'processado' }));
  });

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
    const repositorioOutbox = {
      find: jest.fn(async () => [evento]),
      findOne: jest.fn(async () => evento),
      update: jest.fn(async () => ({ affected: 1 })),
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
