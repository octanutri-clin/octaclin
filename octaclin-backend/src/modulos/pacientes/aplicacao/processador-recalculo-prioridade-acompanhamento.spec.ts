import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { ProcessadorRecalculoPrioridadeAcompanhamento } from './processador-recalculo-prioridade-acompanhamento';

function criarProcessador() {
  const repositorioTenants = {
    find: jest.fn(async () => [{ id: 'tenant-1' }, { id: 'tenant-2' }])
  };
  const fonteDados = {
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      query: jest.fn(async (sql: string) => (sql.includes('pg_try_advisory_lock') ? [{ obtida: true }] : []))
    })),
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === TenantOrm) return repositorioTenants;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const servico = {
    recalcularTenant: jest.fn(async () => ({
      pacientesAvaliados: 1,
      pacientesAtualizados: 1,
      pacientesInalterados: 0,
      pacientesComFalha: 0
    }))
  };

  return {
    processador: new ProcessadorRecalculoPrioridadeAcompanhamento(fonteDados as never, servico as never),
    repositorioTenants,
    servico
  };
}

describe('ProcessadorRecalculoPrioridadeAcompanhamento', () => {
  it('deve recalcular a prioridade de acompanhamento para todos os tenants ativos', async () => {
    const { processador, repositorioTenants, servico } = criarProcessador();

    await processador.recalcular();

    expect(repositorioTenants.find).toHaveBeenCalledWith({ where: { status: 'ativo' } });
    expect(servico.recalcularTenant).toHaveBeenCalledWith('tenant-1');
    expect(servico.recalcularTenant).toHaveBeenCalledWith('tenant-2');
  });
});
