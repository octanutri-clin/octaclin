import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
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

function criarServico(dados: {
  tenants: Record<string, any>[];
  usuarios: Record<string, any>[];
  configuracoes?: Record<string, any>[];
  pacientes?: Record<string, any>[];
  mensagens?: Record<string, any>[];
  questionarios?: Record<string, any>[];
  arquivos?: Record<string, any>[];
}) {
  const repositorioTenants = criarRepositorioFake(dados.tenants);
  const repositorioUsuarios = criarRepositorioFake(dados.usuarios);
  const repositorioConfiguracoes = criarRepositorioFake(dados.configuracoes ?? []);
  const repositorioPacientes = criarRepositorioFake(dados.pacientes ?? []);
  const repositorioMensagens = criarRepositorioFake(dados.mensagens ?? []);
  const repositorioQuestionarios = criarRepositorioFake(dados.questionarios ?? []);
  const repositorioArquivos = criarRepositorioFake(dados.arquivos ?? []);
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
      if (entidade === PacienteOrm) return repositorioPacientes;
      if (entidade === MensagemNotificacaoOrm) return repositorioMensagens;
      if (entidade === QuestionarioOrm) return repositorioQuestionarios;
      if (entidade === ArquivoMidiaOrm) return repositorioArquivos;
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
    repositorioPacientes,
    repositorioMensagens,
    repositorioQuestionarios,
    repositorioArquivos,
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
        planoId: 'gratuito',
        status: 'ativa',
        origem: 'base_inicial',
        limites: {
          usuariosAdministrativos: 2,
          pacientes: 25,
          mensagensMes: 200,
          formulariosAtivos: 5,
          armazenamentoMb: 500
        },
        uso: {
          usuariosAdministrativos: 3,
          pacientes: 0,
          mensagensMes: 0,
          formulariosAtivos: 0,
          armazenamentoMb: 0
        },
        alertas: [
          {
            recurso: 'usuariosAdministrativos',
            uso: 3,
            limite: 2,
            percentual: 150,
            status: 'excedido'
          }
        ]
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

  it('deve montar assinatura SaaS com plano configurado, uso real e alertas de limite', async () => {
    const { servico } = criarServico({
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
      usuarios: [
        { id: 'cliente-1', tenantId: 'tenant-1', role: 'Client', ativo: true },
        { id: 'profissional-1', tenantId: 'tenant-1', role: 'Professional', ativo: true },
        { id: 'colaborador-1', tenantId: 'tenant-1', role: 'Collaborator', ativo: true },
        { id: 'paciente-user-1', tenantId: 'tenant-1', role: 'Patient', ativo: true }
      ],
      configuracoes: [
        {
          id: 'plano-1',
          tenantId: 'tenant-1',
          chave: 'plano_saas',
          valor: {
            planoId: 'profissional',
            status: 'trial',
            origem: 'manual_admin',
            renovacaoEm: '2026-08-22T00:00:00.000Z'
          }
        }
      ],
      pacientes: [
        { id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null },
        { id: 'paciente-2', tenantId: 'tenant-1', arquivadoEm: null },
        { id: 'paciente-arquivado', tenantId: 'tenant-1', arquivadoEm: new Date('2026-07-01T10:00:00.000Z') }
      ],
      mensagens: [
        { id: 'mensagem-1', tenantId: 'tenant-1', criadoEm: new Date('2026-07-21T10:00:00.000Z') },
        { id: 'mensagem-antiga', tenantId: 'tenant-1', criadoEm: new Date('2026-06-21T10:00:00.000Z') }
      ],
      questionarios: [
        { id: 'questionario-1', tenantId: 'tenant-1', status: 'publicado' },
        { id: 'questionario-2', tenantId: 'tenant-1', status: 'rascunho' },
        { id: 'questionario-arquivado', tenantId: 'tenant-1', status: 'arquivado' }
      ],
      arquivos: [
        { id: 'arquivo-1', tenantId: 'tenant-1', tamanhoBytes: String(5 * 1024 * 1024) },
        { id: 'arquivo-2', tenantId: 'tenant-1', tamanhoBytes: String(6 * 1024 * 1024) }
      ]
    });

    const resumo = await servico.obterResumo('tenant-1', 'cliente-1');

    expect(resumo.assinatura).toEqual({
      plano: 'Profissional',
      planoId: 'profissional',
      status: 'trial',
      origem: 'manual_admin',
      renovacaoEm: '2026-08-22T00:00:00.000Z',
      limites: {
        usuariosAdministrativos: 3,
        pacientes: 100,
        mensagensMes: 1000,
        formulariosAtivos: 20,
        armazenamentoMb: 2048
      },
      uso: {
        usuariosAdministrativos: 3,
        pacientes: 2,
        mensagensMes: 1,
        formulariosAtivos: 2,
        armazenamentoMb: 11
      },
      alertas: [
        {
          recurso: 'usuariosAdministrativos',
          uso: 3,
          limite: 3,
          percentual: 100,
          status: 'excedido'
        }
      ]
    });
  });

  it('deve checar limite do tenant antes de novas acoes SaaS', async () => {
    const { servico } = criarServico({
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
          id: 'plano-1',
          tenantId: 'tenant-1',
          chave: 'plano_saas',
          valor: { planoId: 'gratuito', status: 'ativa', origem: 'base_inicial' }
        }
      ],
      pacientes: Array.from({ length: 25 }, (_, indice) => ({
        id: `paciente-${indice + 1}`,
        tenantId: 'tenant-1',
        arquivadoEm: null
      }))
    });

    await expect(servico.checarLimite('tenant-1', 'pacientes')).resolves.toEqual({
      permitido: false,
      recurso: 'pacientes',
      planoId: 'gratuito',
      plano: 'Plano gratuito',
      uso: 25,
      limite: 25,
      restante: 0,
      mensagem: 'Limite de pacientes atingido para o Plano gratuito.'
    });
  });

  it('deve registrar solicitacao comercial de ajuste de assinatura do cliente', async () => {
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
      usuarios: [
        { id: 'cliente-1', tenantId: 'tenant-1', role: 'Client', ativo: true },
        { id: 'profissional-1', tenantId: 'tenant-1', role: 'Professional', ativo: true }
      ],
      configuracoes: [
        {
          id: 'plano-1',
          tenantId: 'tenant-1',
          chave: 'plano_saas',
          valor: { planoId: 'profissional', status: 'trial', origem: 'manual_admin' }
        }
      ]
    });

    const solicitacao = await servico.solicitarAjusteAssinatura('tenant-1', 'cliente-1', {
      acao: 'upgrade',
      planoDesejado: 'clinica',
      observacao: ' Preciso liberar mais usuarios administrativos. '
    });

    expect(repositorioConfiguracoes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        chave: 'assinatura_interesse',
        valor: expect.objectContaining({
          acao: 'upgrade',
          status: 'pendente',
          planoAtualId: 'profissional',
          planoAtual: 'Profissional',
          planoDesejado: 'clinica',
          solicitadoPorUsuarioId: 'cliente-1',
          observacao: 'Preciso liberar mais usuarios administrativos.',
          solicitadoEm: expect.any(String)
        })
      })
    );
    expect(solicitacao).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        acao: 'upgrade',
        status: 'pendente',
        planoAtualId: 'profissional',
        planoAtual: 'Profissional',
        planoDesejado: 'clinica',
        observacao: 'Preciso liberar mais usuarios administrativos.',
        solicitadoEm: expect.any(String)
      })
    );
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
