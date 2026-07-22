import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ServicoPortalCliente } from './servico-portal-cliente';

function criarRepositorioFake(itens: Record<string, any>[]) {
  function corresponde(valorItem: unknown, valorConsulta: unknown) {
    return valorItem === valorConsulta;
  }

  return {
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) =>
      itens.find((item) => Object.entries(consulta.where).every(([chave, valor]) => corresponde(item[chave], valor))) ?? null
    ),
    find: jest.fn(async (consulta: { where: Record<string, unknown> }) =>
      itens.filter((item) => Object.entries(consulta.where).every(([chave, valor]) => corresponde(item[chave], valor)))
    )
  };
}

function criarServico(dados: { tenants: Record<string, any>[]; usuarios: Record<string, any>[] }) {
  const repositorioTenants = criarRepositorioFake(dados.tenants);
  const repositorioUsuarios = criarRepositorioFake(dados.usuarios);
  const fonteDados = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === TenantOrm) return repositorioTenants;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === UsuarioOrm) return repositorioUsuarios;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
  };

  return {
    servico: new ServicoPortalCliente(fonteDados as never, executorTenant as never),
    repositorioTenants,
    repositorioUsuarios,
    executorTenant
  };
}

describe('ServicoPortalCliente', () => {
  it('deve montar resumo real da conta do cliente pelo tenant autenticado', async () => {
    const { servico, repositorioTenants, repositorioUsuarios, executorTenant } = criarServico({
      tenants: [
        {
          id: 'tenant-1',
          nome: 'Clinica Octa Real',
          slug: 'clinica-octa-real',
          status: 'ativo',
          criadoEm: new Date('2026-07-01T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        },
        {
          id: 'tenant-2',
          nome: 'Outra conta',
          slug: 'outra-conta',
          status: 'ativo',
          criadoEm: new Date('2026-07-01T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ],
      usuarios: [
        { id: 'cliente-1', tenantId: 'tenant-1', role: 'Client', ativo: true },
        { id: 'profissional-1', tenantId: 'tenant-1', role: 'Professional', ativo: true },
        { id: 'colaborador-1', tenantId: 'tenant-1', role: 'Collaborator', ativo: true },
        { id: 'paciente-1', tenantId: 'tenant-1', role: 'Patient', ativo: true },
        { id: 'inativo-1', tenantId: 'tenant-1', role: 'Patient', ativo: false },
        { id: 'outro-1', tenantId: 'tenant-2', role: 'Client', ativo: true }
      ]
    });

    const resumo = await servico.obterResumo('tenant-1', 'cliente-1');

    expect(repositorioTenants.findOne).toHaveBeenCalledWith({ where: { id: 'tenant-1', status: 'ativo' } });
    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(repositorioUsuarios.find).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1', ativo: true } });
    expect(resumo).toEqual({
      conta: {
        tenantId: 'tenant-1',
        nome: 'Clinica Octa Real',
        slug: 'clinica-octa-real',
        status: 'ativo',
        criadoEm: new Date('2026-07-01T10:00:00.000Z'),
        atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
      },
      assinatura: {
        plano: 'Plano gratuito',
        status: 'ativa',
        origem: 'base_inicial'
      },
      usuarios: {
        totalAtivos: 4,
        clientes: 1,
        profissionais: 2,
        pacientes: 1
      },
      acesso: {
        usuarioId: 'cliente-1',
        papel: 'Client',
        escopoDados: 'conta_cliente',
        destinoInicial: '/cliente'
      }
    });
    expect(JSON.stringify(resumo)).not.toContain('Outra conta');
  });
});
