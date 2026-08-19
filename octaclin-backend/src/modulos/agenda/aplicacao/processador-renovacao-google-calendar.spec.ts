import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { ProcessadorRenovacaoGoogleCalendar } from './processador-renovacao-google-calendar';

function criarRepositorioConexaoFake(conexoesDoTenant: unknown[]) {
  return {
    find: jest.fn(async () => conexoesDoTenant),
    findOne: jest.fn(async () => null),
    save: jest.fn(async (dados: unknown) => dados)
  };
}

describe('ProcessadorRenovacaoGoogleCalendar', () => {
  it('busca tenants ativos via DataSource e resolve as conexoes de cada um dentro do escopo RLS (ExecutorTenant), renovando canais e reconciliando por tenant', async () => {
    const tenant1 = { id: 'tenant-1', nome: 'Tenant 1', slug: 'tenant-1', status: 'ativo' };
    const tenant2 = { id: 'tenant-2', nome: 'Tenant 2', slug: 'tenant-2', status: 'ativo' };

    const conexaoPertoDeExpirar = {
      tenantId: 'tenant-1',
      profissionalId: 'prof-1',
      canalWatchId: 'canal-antigo',
      canalRecursoId: 'recurso-antigo',
      canalExpiraEm: new Date(Date.now() + 1000 * 60 * 60 * 10),
      desconectadoEm: null
    };
    const conexaoFolgada = {
      tenantId: 'tenant-2',
      profissionalId: 'prof-2',
      canalWatchId: 'canal-ok',
      canalRecursoId: 'recurso-ok',
      canalExpiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      desconectadoEm: null
    };
    const conexoesPorTenant: Record<string, unknown[]> = {
      'tenant-1': [conexaoPertoDeExpirar],
      'tenant-2': [conexaoFolgada]
    };

    const fonteDados = {
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      query: jest.fn(async (sql: string) => (sql.includes('pg_try_advisory_lock') ? [{ obtida: true }] : []))
    })),
      getRepository: jest.fn((entidade: { name: string }) => {
        if (entidade === TenantOrm) return { find: jest.fn(async () => [tenant1, tenant2]) };
        // GoogleCanalWatchOrm nao possui RLS, entao consultas diretas via DataSource sao esperadas.
        return {
          find: jest.fn(async () => []),
          delete: jest.fn(async () => undefined),
          create: jest.fn((dados: unknown) => dados),
          save: jest.fn(async (dados: unknown) => dados)
        };
      })
    };

    const executorTenant = {
      executar: jest.fn(async (tenantId: string, callback: (gerenciador: unknown) => unknown) =>
        callback({
          getRepository: jest.fn((entidade: { name: string }) => {
            if (entidade === ProfissionalGoogleConexaoOrm) {
              return {
                ...criarRepositorioConexaoFake(conexoesPorTenant[tenantId] ?? []),
                find: jest.fn(async (opcoes: { where: { tenantId: string } }) => {
                  expect(opcoes.where.tenantId).toBe(tenantId);
                  return conexoesPorTenant[tenantId] ?? [];
                })
              };
            }
            if (entidade === GoogleCanalWatchOrm) {
              return {
                delete: jest.fn(async () => undefined),
                create: jest.fn((dados: unknown) => dados),
                save: jest.fn(async (dados: unknown) => dados)
              };
            }
            throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
          })
        })
      )
    };

    const servicoConexao = {
      obterConexaoAtiva: jest.fn(async () => ({ clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'cal' }))
    };
    const googleCalendar = {
      pararCanalWatch: jest.fn(async () => undefined),
      criarCanalWatch: jest.fn(async () => ({ recursoId: 'recurso-novo', expiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) }))
    };
    const servicoSincronizacao = { reconciliar: jest.fn(async () => undefined) };

    const processador = new ProcessadorRenovacaoGoogleCalendar(
      fonteDados as never,
      executorTenant as never,
      servicoConexao as never,
      googleCalendar as never,
      servicoSincronizacao as never
    );

    await processador.renovarCanaisEReconciliar();

    expect(fonteDados.getRepository).toHaveBeenCalledWith(TenantOrm);
    expect(googleCalendar.pararCanalWatch).toHaveBeenCalledWith(expect.anything(), 'canal-antigo', 'recurso-antigo');
    expect(googleCalendar.criarCanalWatch).toHaveBeenCalledTimes(1);
    expect(servicoSincronizacao.reconciliar).toHaveBeenCalledWith('tenant-1', 'prof-1');
    expect(servicoSincronizacao.reconciliar).toHaveBeenCalledWith('tenant-2', 'prof-2');
  });

  it('nao interrompe o processamento dos demais tenants quando um tenant falha ao buscar suas conexoes', async () => {
    const tenantQuebrado = { id: 'tenant-quebrado', nome: 'Tenant quebrado', slug: 'tenant-quebrado', status: 'ativo' };
    const tenantOk = { id: 'tenant-2', nome: 'Tenant 2', slug: 'tenant-2', status: 'ativo' };
    const conexaoTenantOk = {
      tenantId: 'tenant-2',
      profissionalId: 'prof-2',
      canalWatchId: 'canal-ok',
      canalRecursoId: 'recurso-ok',
      canalExpiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      desconectadoEm: null
    };

    const fonteDados = {
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      query: jest.fn(async (sql: string) => (sql.includes('pg_try_advisory_lock') ? [{ obtida: true }] : []))
    })),
      getRepository: jest.fn((entidade: { name: string }) => {
        if (entidade === TenantOrm) return { find: jest.fn(async () => [tenantQuebrado, tenantOk]) };
        return {
          find: jest.fn(async () => []),
          delete: jest.fn(async () => undefined),
          create: jest.fn((dados: unknown) => dados),
          save: jest.fn(async (dados: unknown) => dados)
        };
      })
    };

    const executorTenant = {
      executar: jest.fn(async (tenantId: string, callback: (gerenciador: unknown) => unknown) => {
        if (tenantId === 'tenant-quebrado') {
          throw new Error('falha de conexao com o banco (RLS/transacao)');
        }
        return callback({
          getRepository: jest.fn((entidade: { name: string }) => {
            if (entidade === ProfissionalGoogleConexaoOrm) return criarRepositorioConexaoFake([conexaoTenantOk]);
            throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
          })
        });
      })
    };

    const servicoConexao = {
      obterConexaoAtiva: jest.fn(async () => ({ clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'cal' }))
    };
    const googleCalendar = {
      pararCanalWatch: jest.fn(async () => undefined),
      criarCanalWatch: jest.fn(async () => ({ recursoId: 'recurso-novo', expiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) }))
    };
    const servicoSincronizacao = { reconciliar: jest.fn(async () => undefined) };

    const processador = new ProcessadorRenovacaoGoogleCalendar(
      fonteDados as never,
      executorTenant as never,
      servicoConexao as never,
      googleCalendar as never,
      servicoSincronizacao as never
    );

    await expect(processador.renovarCanaisEReconciliar()).resolves.toBeUndefined();

    expect(servicoSincronizacao.reconciliar).toHaveBeenCalledWith('tenant-2', 'prof-2');
    expect(servicoSincronizacao.reconciliar).not.toHaveBeenCalledWith('tenant-quebrado', expect.anything());
  });
});
