import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { ProcessadorLembretesAgenda } from './processador-lembretes-agenda';

function criarProcessador() {
  const repositorioTenants = {
    find: jest.fn(async () => [{ id: 'tenant-1' }, { id: 'tenant-2' }])
  };
  const fonteDados = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === TenantOrm) return repositorioTenants;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const servico = {
    processarLembretesConsulta: jest.fn(async () => ({
      consultasAvaliadas: 1,
      lembretesProcessados: 1,
      lembretesIgnorados: 0
    }))
  };

  return { processador: new ProcessadorLembretesAgenda(fonteDados as never, servico as never), repositorioTenants, servico };
}

describe('ProcessadorLembretesAgenda', () => {
  it('deve processar lembretes de agenda para tenants ativos', async () => {
    const { processador, repositorioTenants, servico } = criarProcessador();

    await processador.processarLembretes();

    expect(repositorioTenants.find).toHaveBeenCalledWith({ where: { status: 'ativo' } });
    expect(servico.processarLembretesConsulta).toHaveBeenCalledWith('tenant-1');
    expect(servico.processarLembretesConsulta).toHaveBeenCalledWith('tenant-2');
  });
});
