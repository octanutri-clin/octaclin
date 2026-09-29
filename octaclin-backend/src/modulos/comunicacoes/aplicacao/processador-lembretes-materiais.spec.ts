import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { EnvioMaterialPacienteOrm } from '../../materiais/infraestrutura/envio-material-paciente.orm';
import { ProcessadorLembretesMateriais } from './processador-lembretes-materiais';

describe('ProcessadorLembretesMateriais', () => {
  it('agenda apenas vencimentos do tenant e move a próxima ocorrência para 72h sem catch-up', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00.000Z'));
    const envio = {
      id: 'envio-1', tenantId: 'tenant-1', status: 'enviado', visualizadoEm: undefined,
      proximoLembreteEm: new Date('2026-10-01T00:00:00.000Z')
    } as EnvioMaterialPacienteOrm;
    const envios = {
      find: jest.fn(async (opcoes: { where: { tenantId: string }; lock: { mode: string; onLocked: string } }) => {
        expect(opcoes.where.tenantId).toBe('tenant-1');
        expect(opcoes.lock).toEqual({ mode: 'pessimistic_write', onLocked: 'skip_locked' });
        return envio.proximoLembreteEm && envio.proximoLembreteEm.getTime() <= Date.now() ? [envio] : [];
      }),
      save: jest.fn(async (valor: EnvioMaterialPacienteOrm) => valor)
    };
    const eventos: Array<Record<string, unknown>> = [];
    const outbox = {
      create: jest.fn((valor: Record<string, unknown>) => valor),
      save: jest.fn(async (valor: Record<string, unknown>) => { eventos.push(valor); return valor; })
    };
    const fonteDados = {
      createQueryRunner: jest.fn(() => ({
        connect: jest.fn(async () => undefined),
        release: jest.fn(async () => undefined),
        query: jest.fn(async (sql: string) => sql.includes('pg_try_advisory_lock') ? [{ obtida: true }] : [])
      })),
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === TenantOrm) return { find: jest.fn(async () => [{ id: 'tenant-1', status: 'ativo' }]) };
        throw new Error('Repositorio fora do tenant');
      })
    };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: (entidade: unknown) => {
          if (entidade === EnvioMaterialPacienteOrm) return envios;
          if (entidade === OutboxEventoOrm) return outbox;
          throw new Error('Repositorio inesperado');
        } })
      )
    };

    try {
      const processador = new ProcessadorLembretesMateriais(fonteDados as never, executorTenant as never);
      await processador.agendarPendentes();
      await processador.agendarPendentes();
    } finally {
      jest.useRealTimers();
    }

    expect(envios.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1', status: 'enviado' }),
      order: { proximoLembreteEm: 'ASC' },
      take: 100
    }));
    expect(envios.save).toHaveBeenCalledWith(expect.objectContaining({
      proximoLembreteEm: new Date('2026-10-07T12:00:00.000Z')
    }));
    expect(eventos).toEqual([expect.objectContaining({
      tenantId: 'tenant-1',
      tipo: 'material.nao_visualizado.lembrete',
      status: 'pendente',
      payload: {
        envioId: 'envio-1',
        chaveIdempotencia: 'material-nao-visualizado:envio-1:1790812800000'
      }
    })]);
  });

  it('não cria evento quando não há vencimento elegível', async () => {
    const envios = { find: jest.fn(async () => []), save: jest.fn() };
    const outbox = { create: jest.fn(), save: jest.fn() };
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
      executar: (_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: (entidade: unknown) => entidade === EnvioMaterialPacienteOrm ? envios : outbox })
    };

    await new ProcessadorLembretesMateriais(fonteDados as never, executorTenant as never).agendarPendentes();

    expect(outbox.save).not.toHaveBeenCalled();
  });
});
