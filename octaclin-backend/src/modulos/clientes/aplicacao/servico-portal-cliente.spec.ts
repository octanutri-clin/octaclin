import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
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
    ),
    create: jest.fn((dados) => ({ ...dados })),
    save: jest.fn(async (dados) => {
      const existente = itens.find((item) => dados.id ? item.id === dados.id : item.tenantId === dados.tenantId && item.chave === dados.chave);
      if (existente) {
        Object.assign(existente, dados);
        return existente;
      }
      const salvo = {
        id: dados.id ?? `item-${itens.length + 1}`,
        criadoEm: dados.criadoEm ?? new Date('2026-07-22T10:00:00.000Z'),
        atualizadoEm: dados.atualizadoEm ?? new Date('2026-07-22T10:00:00.000Z'),
        ...dados
      };
      itens.push(salvo);
      return salvo;
    })
  };
}

function criarServico(dados: { tenants: Record<string, any>[]; usuarios: Record<string, any>[]; configuracoes?: Record<string, any>[] }) {
  const repositorioTenants = criarRepositorioFake(dados.tenants);
  const repositorioUsuarios = criarRepositorioFake(dados.usuarios);
  const repositorioConfiguracoes = criarRepositorioFake(dados.configuracoes ?? []);
  const fonteDados = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === TenantOrm) return repositorioTenants;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === UsuarioOrm) return repositorioUsuarios;
      if (entidade === TenantConfiguracaoOrm) return repositorioConfiguracoes;
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
    repositorioConfiguracoes,
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

  it('deve retornar configuracoes da conta com defaults quando ainda nao existem', async () => {
    const { servico, repositorioConfiguracoes, executorTenant } = criarServico({
      tenants: [
        {
          id: 'tenant-1',
          nome: 'Clinica Octa Real',
          slug: 'clinica-octa-real',
          status: 'ativo',
          criadoEm: new Date('2026-07-01T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ],
      usuarios: []
    });

    const configuracoes = await servico.obterConfiguracoes('tenant-1');

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(repositorioConfiguracoes.findOne).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', chave: 'conta_cliente' }
    });
    expect(configuracoes).toEqual({
      tenantId: 'tenant-1',
      nome: 'Clinica Octa Real',
      slug: 'clinica-octa-real',
      status: 'ativo',
      timezone: 'America/Sao_Paulo',
      idioma: 'pt-BR',
      canaisPadrao: {
        email: true,
        whatsapp: true,
        googleCalendar: true
      },
      marca: {
        nomeExibido: 'Clinica Octa Real',
        emailRemetente: '',
        corPrimaria: '#197d8f'
      },
      atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
    });
  });

  it('deve atualizar nome da conta e salvar configuracoes flexiveis no tenant autenticado', async () => {
    const tenant = {
      id: 'tenant-1',
      nome: 'Clinica Antiga',
      slug: 'clinica-octa-real',
      status: 'ativo',
      criadoEm: new Date('2026-07-01T10:00:00.000Z'),
      atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
    };
    const { servico, repositorioTenants, repositorioConfiguracoes } = criarServico({
      tenants: [tenant],
      usuarios: [],
      configuracoes: [
        {
          id: 'config-1',
          tenantId: 'tenant-1',
          chave: 'conta_cliente',
          valor: {
            timezone: 'America/Sao_Paulo',
            idioma: 'pt-BR'
          },
          criadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ]
    });

    const configuracoes = await servico.atualizarConfiguracoes('tenant-1', {
      nome: ' Clinica Octa Atualizada ',
      timezone: 'America/Fortaleza',
      idioma: 'pt-BR',
      canaisPadrao: {
        email: true,
        whatsapp: false,
        googleCalendar: true
      },
      marca: {
        nomeExibido: ' Octa Prime ',
        emailRemetente: ' contato@octaclin.com.br ',
        corPrimaria: '#0f766e'
      }
    });

    expect(repositorioTenants.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tenant-1',
        nome: 'Clinica Octa Atualizada'
      })
    );
    expect(repositorioConfiguracoes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'config-1',
        tenantId: 'tenant-1',
        chave: 'conta_cliente',
        valor: {
          timezone: 'America/Fortaleza',
          idioma: 'pt-BR',
          canaisPadrao: {
            email: true,
            whatsapp: false,
            googleCalendar: true
          },
          marca: {
            nomeExibido: 'Octa Prime',
            emailRemetente: 'contato@octaclin.com.br',
            corPrimaria: '#0f766e'
          }
        }
      })
    );
    expect(configuracoes.nome).toBe('Clinica Octa Atualizada');
    expect(configuracoes.marca.nomeExibido).toBe('Octa Prime');
    expect(configuracoes.canaisPadrao.whatsapp).toBe(false);
  });

  it('deve retornar perfil da empresa com defaults para preparacao fiscal', async () => {
    const { servico, repositorioConfiguracoes } = criarServico({
      tenants: [
        {
          id: 'tenant-1',
          nome: 'Clinica Octa Real',
          slug: 'clinica-octa-real',
          status: 'ativo',
          criadoEm: new Date('2026-07-01T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ],
      usuarios: []
    });

    const perfil = await servico.obterPerfilEmpresa('tenant-1');

    expect(repositorioConfiguracoes.findOne).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', chave: 'perfil_empresa' }
    });
    expect(perfil).toEqual({
      tenantId: 'tenant-1',
      tipoPessoa: 'pj',
      documento: '',
      nomeLegal: 'Clinica Octa Real',
      nomeFantasia: 'Clinica Octa Real',
      inscricaoEstadual: '',
      inscricaoMunicipal: '',
      responsavel: {
        nome: '',
        email: '',
        telefone: '',
        cargo: ''
      },
      endereco: {
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: '',
        pais: 'BR'
      },
      contatos: {
        emailFinanceiro: '',
        telefoneFinanceiro: '',
        whatsappAtendimento: '',
        emailAtendimento: ''
      },
      fiscal: {
        prepararRecibos: true,
        observacoes: ''
      },
      atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
    });
  });

  it('deve atualizar perfil da empresa e persistir dados fiscais no tenant autenticado', async () => {
    const { servico, repositorioConfiguracoes } = criarServico({
      tenants: [
        {
          id: 'tenant-1',
          nome: 'Clinica Octa Real',
          slug: 'clinica-octa-real',
          status: 'ativo',
          criadoEm: new Date('2026-07-01T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ],
      usuarios: [],
      configuracoes: [
        {
          id: 'perfil-1',
          tenantId: 'tenant-1',
          chave: 'perfil_empresa',
          valor: {
            tipoPessoa: 'pj',
            documento: '00.000.000/0001-00'
          },
          criadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ]
    });

    const perfil = await servico.atualizarPerfilEmpresa('tenant-1', {
      tipoPessoa: 'pj',
      documento: ' 12.345.678/0001-90 ',
      nomeLegal: ' OctaClin Consultoria LTDA ',
      nomeFantasia: ' OctaClin Prime ',
      inscricaoEstadual: ' isento ',
      inscricaoMunicipal: ' 123456 ',
      responsavel: {
        nome: ' Dra. Carla Octa ',
        email: ' carla@octaclin.com.br ',
        telefone: ' 5511999990000 ',
        cargo: ' Diretora '
      },
      endereco: {
        cep: ' 01310-100 ',
        logradouro: ' Avenida Paulista ',
        numero: ' 1000 ',
        complemento: ' cj 101 ',
        bairro: ' Bela Vista ',
        cidade: ' Sao Paulo ',
        uf: ' SP ',
        pais: ' BR '
      },
      contatos: {
        emailFinanceiro: ' financeiro@octaclin.com.br ',
        telefoneFinanceiro: ' 5511888880000 ',
        whatsappAtendimento: ' 5511992362080 ',
        emailAtendimento: ' atendimento@octaclin.com.br '
      },
      fiscal: {
        prepararRecibos: true,
        observacoes: ' Emitir recibos em nome do responsavel financeiro. '
      }
    });

    expect(repositorioConfiguracoes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'perfil-1',
        tenantId: 'tenant-1',
        chave: 'perfil_empresa',
        valor: {
          tipoPessoa: 'pj',
          documento: '12.345.678/0001-90',
          nomeLegal: 'OctaClin Consultoria LTDA',
          nomeFantasia: 'OctaClin Prime',
          inscricaoEstadual: 'isento',
          inscricaoMunicipal: '123456',
          responsavel: {
            nome: 'Dra. Carla Octa',
            email: 'carla@octaclin.com.br',
            telefone: '5511999990000',
            cargo: 'Diretora'
          },
          endereco: {
            cep: '01310-100',
            logradouro: 'Avenida Paulista',
            numero: '1000',
            complemento: 'cj 101',
            bairro: 'Bela Vista',
            cidade: 'Sao Paulo',
            uf: 'SP',
            pais: 'BR'
          },
          contatos: {
            emailFinanceiro: 'financeiro@octaclin.com.br',
            telefoneFinanceiro: '5511888880000',
            whatsappAtendimento: '5511992362080',
            emailAtendimento: 'atendimento@octaclin.com.br'
          },
          fiscal: {
            prepararRecibos: true,
            observacoes: 'Emitir recibos em nome do responsavel financeiro.'
          }
        }
      })
    );
    expect(perfil.nomeLegal).toBe('OctaClin Consultoria LTDA');
    expect(perfil.responsavel.email).toBe('carla@octaclin.com.br');
    expect(perfil.endereco.uf).toBe('SP');
  });
});
