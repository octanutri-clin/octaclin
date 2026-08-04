import { Logger } from '@nestjs/common';
import { executarPorTenantAtivo } from './rodada-por-tenant';

function criarFonteDados(tenants: { id: string }[]) {
  return { getRepository: jest.fn(() => ({ find: jest.fn(async () => tenants) })) } as never;
}

function criarLogger() {
  return { warn: jest.fn(), error: jest.fn(), log: jest.fn() } as unknown as Logger;
}

describe('executarPorTenantAtivo', () => {
  it('deve executar a operacao para cada tenant ativo', async () => {
    const visitados: string[] = [];
    const resultado = await executarPorTenantAtivo(
      criarFonteDados([{ id: 'tenant-1' }, { id: 'tenant-2' }]),
      criarLogger(),
      'rodada teste',
      async (tenantId) => {
        visitados.push(tenantId);
      }
    );

    expect(visitados).toEqual(['tenant-1', 'tenant-2']);
    expect(resultado).toEqual({ tenantsAvaliados: 2, tenantsComFalha: 0, tenantsExpirados: 0 });
  });

  it('nao deve deixar a falha de um tenant impedir os seguintes', async () => {
    const visitados: string[] = [];
    const logger = criarLogger();

    const resultado = await executarPorTenantAtivo(
      criarFonteDados([{ id: 'tenant-1' }, { id: 'tenant-2' }, { id: 'tenant-3' }]),
      logger,
      'rodada teste',
      async (tenantId) => {
        if (tenantId === 'tenant-2') throw new Error('Banco indisponivel.');
        visitados.push(tenantId);
      }
    );

    expect(visitados).toEqual(['tenant-1', 'tenant-3']);
    expect(resultado).toMatchObject({ tenantsAvaliados: 3, tenantsComFalha: 1 });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('tenant-2'));
  });

  it('nao deve deixar um tenant travado prender a fila inteira', async () => {
    jest.useFakeTimers();
    const visitados: string[] = [];
    const logger = criarLogger();

    const rodada = executarPorTenantAtivo(
      criarFonteDados([{ id: 'tenant-travado' }, { id: 'tenant-2' }]),
      logger,
      'rodada teste',
      async (tenantId) => {
        if (tenantId === 'tenant-travado') return new Promise<void>(() => undefined);
        visitados.push(tenantId);
      },
      { timeoutMs: 1000 }
    );

    await jest.advanceTimersByTimeAsync(1000);
    const resultado = await rodada;

    expect(visitados).toEqual(['tenant-2']);
    expect(resultado).toMatchObject({ tenantsExpirados: 1 });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('tenant-travado'));
    jest.useRealTimers();
  });

  it('nao deve deixar temporizador pendente quando o tenant termina antes do timeout', async () => {
    jest.useFakeTimers();

    await executarPorTenantAtivo(criarFonteDados([{ id: 'tenant-1' }]), criarLogger(), 'rodada teste', async () => undefined, {
      timeoutMs: 60_000
    });

    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});
