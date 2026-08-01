import { HttpException, HttpStatus } from '@nestjs/common';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { TokenRedefinicaoSenhaOrm } from '../../auth/infraestrutura/token-redefinicao-senha.orm';
import { RefreshTokenOrm } from '../../auth/infraestrutura/refresh-token.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { ServicoUsuariosCliente } from './servico-usuarios-cliente';

function criarRepositorioFake(usuarios: Record<string, any>[]) {
  return {
    find: jest.fn(async (opcoes?: any) => {
      let itens = [...usuarios];
      if (opcoes?.where?.tenantId) itens = itens.filter((usuario) => usuario.tenantId === opcoes.where.tenantId);
      if (opcoes?.where?.status) itens = itens.filter((usuario) => usuario.status === opcoes.where.status);
      return itens;
    }),
    findOne: jest.fn(async (opcoes?: any) => {
      const where = opcoes?.where ?? {};
      return (
        usuarios.find((usuario) =>
          Object.entries(where).every(([chave, valor]) => usuario[chave] === valor)
        ) ?? null
      );
    }),
    create: jest.fn((dados) => ({ ...dados })),
    save: jest.fn(async (usuario) => {
      const salvo = {
        id: usuario.id ?? `usuario-${usuarios.length + 1}`,
        criadoEm: new Date('2026-07-22T10:00:00.000Z'),
        atualizadoEm: new Date('2026-07-22T10:00:00.000Z'),
        ...usuario
      };
      usuarios.push(salvo);
      return salvo;
    }),
    update: jest.fn(async (where, dados) => {
      const usuario = usuarios.find((item) =>
        Object.entries(where).every(([chave, valor]) => item[chave] === valor)
      );
      if (!usuario) return { affected: 0 };
      Object.assign(usuario, dados);
      return { affected: 1 };
    })
  };
}

function criarServico(
  usuarios: Record<string, any>[],
  tokens: Record<string, any>[] = [],
  limites: { checarLimite: jest.Mock } = {
    checarLimite: jest.fn(async () => ({ permitido: true }))
  },
  protecaoAbuso = {
    consumirTentativa: jest.fn()
  },
  profissionais: Record<string, any>[] = []
) {
  const repositorioUsuarios = criarRepositorioFake(usuarios);
  const repositorioTokens = criarRepositorioFake(tokens);
  const repositorioProfissionais = criarRepositorioFake(profissionais);
  const repositorioRefreshTokens = criarRepositorioFake([]);
  const executorTenant = {
    executar: jest.fn((_tenantId: string, callback: any) =>
      callback({
        getRepository: (entidade: any) => {
          if (entidade === UsuarioOrm) return repositorioUsuarios;
          if (entidade === TokenRedefinicaoSenhaOrm) return repositorioTokens;
          if (entidade === ProfissionalOrm) return repositorioProfissionais;
          if (entidade === RefreshTokenOrm) return repositorioRefreshTokens;
          throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
        }
      })
    )
  };
  const criptografia = {
    gerarHashBusca: jest.fn((valor: string) => `hash:${valor.trim().toLowerCase()}`),
    criptografar: jest.fn((valor: string) => Buffer.from(`email:${valor}`)),
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8').replace('email:', ''))
  };
  const senhas = { gerarHash: jest.fn((valor: string) => `senha:${valor}`) };
  const email = { enviar: jest.fn(async () => ({ idExterno: 'email-1' })) };

  return {
    servico: new ServicoUsuariosCliente(
      executorTenant as never,
      criptografia as never,
      senhas as never,
      email as never,
      limites as never,
      protecaoAbuso as never
    ),
    repositorioUsuarios,
    repositorioTokens,
    repositorioProfissionais,
    repositorioRefreshTokens,
    executorTenant,
    criptografia,
    senhas,
    email,
    protecaoAbuso
  };
}

describe('ServicoUsuariosCliente', () => {
  it('deve promover colaborador, provisionar perfil profissional e revogar sessoes anteriores', async () => {
    const { servico, repositorioUsuarios, repositorioProfissionais, repositorioRefreshTokens } = criarServico([
      {
        id: 'colaborador-1',
        tenantId: 'tenant-1',
        emailCriptografado: Buffer.from('email:agenda@octaclin.local'),
        emailHash: 'hash:agenda@octaclin.local',
        senhaHash: 'senha',
        role: 'Collaborator',
        ativo: true,
        criadoEm: new Date('2026-07-20T10:00:00.000Z'),
        atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
      }
    ]);

    const resposta = await servico.atualizarPapel('tenant-1', 'cliente-1', 'colaborador-1', {
      role: 'Professional',
      nomeProfissional: 'Dra. Carla',
      especialidade: 'Nutricao'
    });

    expect(resposta.role).toBe('Professional');
    expect(repositorioUsuarios.save).toHaveBeenCalledWith(expect.objectContaining({ role: 'Professional' }));
    expect(repositorioProfissionais.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', usuarioId: 'colaborador-1', especialidade: 'Nutricao' })
    );
    expect(repositorioRefreshTokens.update).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', usuarioId: 'colaborador-1' },
      { revogadoEm: expect.any(Date) }
    );
  });

  it('deve impedir o gestor de alterar o proprio papel', async () => {
    const { servico, repositorioUsuarios } = criarServico([]);

    await expect(
      servico.atualizarPapel('tenant-1', 'cliente-1', 'cliente-1', { role: 'Collaborator' })
    ).rejects.toThrow('O gestor logado nao pode alterar o proprio acesso.');
    expect(repositorioUsuarios.save).not.toHaveBeenCalled();
  });

  it('deve impedir reduzir acesso profissional com pacientes ainda vinculados', async () => {
    const usuario = {
      id: 'profissional-1',
      tenantId: 'tenant-1',
      role: 'Professional',
      ativo: true,
      emailCriptografado: Buffer.from('email:prof@octaclin.local')
    };
    const repositorioUsuarios = { findOne: jest.fn(async () => usuario), save: jest.fn() };
    const repositorioProfissionais = {
      findOne: jest.fn(async () => ({ id: 'perfil-1', tenantId: 'tenant-1', usuarioId: usuario.id }))
    };
    const repositorioPacientes = { count: jest.fn(async () => 1) };
    const repositorioConsultas = { count: jest.fn(async () => 0) };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({
          getRepository: jest.fn((entidade: unknown) => {
            if (entidade === UsuarioOrm) return repositorioUsuarios;
            if (entidade === ProfissionalOrm) return repositorioProfissionais;
            if (entidade === PacienteOrm) return repositorioPacientes;
            if (entidade === AgendaConsultaOrm) return repositorioConsultas;
            throw new Error('Repositorio nao mapeado.');
          })
        })
      )
    };
    const servico = new ServicoUsuariosCliente(
      executorTenant as never,
      { descriptografar: jest.fn(() => 'prof@octaclin.local') } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );

    await expect(
      servico.atualizarPapel('tenant-1', 'cliente-1', usuario.id, { role: 'Collaborator' })
    ).rejects.toThrow('Reatribua pacientes e consultas futuras antes de remover o acesso profissional.');
    expect(repositorioUsuarios.save).not.toHaveBeenCalled();
  });

  it('deve limitar abuso na criacao de convites administrativos antes de consultar limite do plano', async () => {
    const limites = { checarLimite: jest.fn(async () => ({ permitido: true })) };
    const protecaoAbuso = {
      consumirTentativa: jest.fn(() => {
        throw new HttpException('Muitas acoes de convite. Tente novamente em alguns minutos.', HttpStatus.TOO_MANY_REQUESTS);
      })
    };
    const { servico, repositorioUsuarios } = criarServico([], [], limites, protecaoAbuso);

    await expect(
      servico.criar('tenant-1', 'cliente-1', {
        email: 'novo@octaclin.local',
        role: 'Collaborator'
      })
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });

    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledWith(
      'convite-admin:tenant-1:novo@octaclin.local',
      expect.objectContaining({ maxTentativas: 10 })
    );
    expect(limites.checarLimite).not.toHaveBeenCalled();
    expect(repositorioUsuarios.save).not.toHaveBeenCalled();
  });

  it('deve listar apenas usuarios administrativos do tenant sem expor credenciais', async () => {
    const { servico, repositorioUsuarios, executorTenant } = criarServico([
      {
        id: 'cliente-1',
        tenantId: 'tenant-1',
        emailCriptografado: Buffer.from('email:gestor@octaclin.local'),
        emailHash: 'hash:gestor@octaclin.local',
        senhaHash: 'senha-secreta',
        role: 'Client',
        ativo: true,
        ultimoLoginEm: new Date('2026-07-21T10:00:00.000Z'),
        criadoEm: new Date('2026-07-01T10:00:00.000Z'),
        atualizadoEm: new Date('2026-07-21T10:00:00.000Z')
      },
      {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        emailCriptografado: Buffer.from('email:paciente@octaclin.local'),
        emailHash: 'hash:paciente@octaclin.local',
        senhaHash: 'senha-paciente',
        role: 'Patient',
        ativo: true,
        criadoEm: new Date('2026-07-01T10:00:00.000Z'),
        atualizadoEm: new Date('2026-07-21T10:00:00.000Z')
      },
      {
        id: 'profissional-outro',
        tenantId: 'tenant-2',
        emailCriptografado: Buffer.from('email:fora@octaclin.local'),
        emailHash: 'hash:fora@octaclin.local',
        senhaHash: 'senha-fora',
        role: 'Professional',
        ativo: true,
        criadoEm: new Date('2026-07-01T10:00:00.000Z'),
        atualizadoEm: new Date('2026-07-21T10:00:00.000Z')
      }
    ]);

    const resposta = await servico.listar('tenant-1');

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(repositorioUsuarios.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      order: { criadoEm: 'DESC' }
    });
    expect(resposta).toEqual({
      itens: [
        {
          id: 'cliente-1',
          tenantId: 'tenant-1',
          email: 'gestor@octaclin.local',
          role: 'Client',
          ativo: true,
          ultimoLoginEm: new Date('2026-07-21T10:00:00.000Z'),
          criadoEm: new Date('2026-07-01T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-21T10:00:00.000Z')
        }
      ],
      total: 1
    });
    expect(JSON.stringify(resposta)).not.toContain('senha-secreta');
    expect(JSON.stringify(resposta)).not.toContain('hash:gestor');
  });

  it('deve convidar usuario colaborador com token de primeiro acesso e email', async () => {
    process.env.EXPOR_LINK_RECUPERACAO_SENHA = 'true';
    const { servico, repositorioUsuarios, repositorioTokens, criptografia, senhas, email } = criarServico([]);

    const resposta = await servico.criar('tenant-1', 'cliente-1', {
      email: ' Novo@OctaClin.Local ',
      role: 'Collaborator'
    });

    expect(criptografia.gerarHashBusca).toHaveBeenCalledWith(' Novo@OctaClin.Local ');
    expect(criptografia.criptografar).toHaveBeenCalledWith('novo@octaclin.local');
    expect(senhas.gerarHash).toHaveBeenCalledWith(expect.stringMatching(/^convite\./));
    expect(repositorioUsuarios.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        emailHash: 'hash:novo@octaclin.local',
        emailCriptografado: Buffer.from('email:novo@octaclin.local'),
        senhaHash: expect.stringMatching(/^senha:convite\./),
        role: 'Collaborator',
        ativo: true
      })
    );
    expect(repositorioTokens.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        emailHash: 'hash:novo@octaclin.local',
        tokenHash: expect.any(String),
        status: 'pendente',
        expiraEm: expect.any(Date),
        payload: expect.objectContaining({
          origem: 'convite_usuario_cliente',
          criadoPorUsuarioId: 'cliente-1',
          role: 'Collaborator'
        })
      })
    );
    expect(email.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          destino: 'novo@octaclin.local',
          assunto: 'Convite para acessar o OctaClin',
          linkPrimeiroAcesso: expect.stringMatching(/^http:\/\/localhost:3000\/recuperar-senha\?token=tenant-1\./)
        })
      })
    );
    expect(resposta).toEqual(
      expect.objectContaining({
        id: 'usuario-1',
        tenantId: 'tenant-1',
        email: 'novo@octaclin.local',
        role: 'Collaborator',
        ativo: true,
        convite: {
          expiraEm: expect.any(Date),
          linkPrimeiroAcesso: expect.stringMatching(/^http:\/\/localhost:3000\/recuperar-senha\?token=tenant-1\./)
        }
      })
    );
    expect(JSON.stringify(resposta)).not.toContain('convite.');
    delete process.env.EXPOR_LINK_RECUPERACAO_SENHA;
  });

  it('deve provisionar perfil profissional vinculado ao usuario convidado', async () => {
    const { servico, repositorioProfissionais, criptografia } = criarServico([]);

    await servico.criar('tenant-1', 'cliente-1', {
      email: 'profissional@octaclin.local',
      role: 'Professional',
      nomeProfissional: 'Dra. Carla',
      registroProfissional: 'CRN-1234',
      especialidade: 'Nutricao clinica'
    });

    expect(criptografia.criptografar).toHaveBeenCalledWith('Dra. Carla');
    expect(repositorioProfissionais.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        nomeCriptografado: Buffer.from('email:Dra. Carla'),
        registroProfissional: 'CRN-1234',
        especialidade: 'Nutricao clinica'
      })
    );
  });

  it('deve bloquear convite administrativo quando limite de usuarios for atingido', async () => {
    const limites = {
      checarLimite: jest.fn(async () => ({
        permitido: false,
        recurso: 'usuariosAdministrativos',
        plano: 'Profissional',
        uso: 3,
        limite: 3,
        restante: 0,
        mensagem: 'Limite de usuarios administrativos atingido para o Profissional.'
      }))
    };
    const { servico, repositorioUsuarios, repositorioTokens } = criarServico([], [], limites);

    await expect(
      servico.criar('tenant-1', 'cliente-1', {
        email: 'novo@octaclin.local',
        role: 'Collaborator'
      })
    ).rejects.toThrow('Limite de usuarios administrativos atingido para o Profissional.');

    expect(limites.checarLimite).toHaveBeenCalledWith('tenant-1', 'usuariosAdministrativos');
    expect(repositorioUsuarios.save).not.toHaveBeenCalled();
    expect(repositorioTokens.save).not.toHaveBeenCalled();
  });

  it('deve impedir o gestor de desativar o proprio usuario', async () => {
    const { servico, repositorioUsuarios } = criarServico([]);

    await expect(servico.desativar('tenant-1', 'cliente-1', 'cliente-1')).rejects.toThrow(
      'O gestor logado nao pode desativar o proprio acesso.'
    );
    expect(repositorioUsuarios.update).not.toHaveBeenCalled();
  });

  it('deve listar convites administrativos pendentes com trilha de auditoria', async () => {
    const { servico, repositorioTokens } = criarServico(
      [
        {
          id: 'colaborador-1',
          tenantId: 'tenant-1',
          emailCriptografado: Buffer.from('email:agenda@octaclin.local'),
          emailHash: 'hash:agenda@octaclin.local',
          senhaHash: 'senha-aleatoria',
          role: 'Collaborator',
          ativo: true,
          criadoEm: new Date('2026-07-20T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ],
      [
        {
          id: 'token-1',
          tenantId: 'tenant-1',
          usuarioId: 'colaborador-1',
          emailHash: 'hash:agenda@octaclin.local',
          tokenHash: 'hash-token',
          status: 'pendente',
          expiraEm: new Date('2026-07-29T10:00:00.000Z'),
          payload: {
            origem: 'convite_usuario_cliente',
            criadoPorUsuarioId: 'cliente-1',
            role: 'Collaborator',
            convidadoEm: '2026-07-22T10:00:00.000Z'
          },
          criadoEm: new Date('2026-07-22T10:00:00.000Z')
        },
        {
          id: 'token-recuperacao',
          tenantId: 'tenant-1',
          usuarioId: 'colaborador-1',
          emailHash: 'hash:agenda@octaclin.local',
          tokenHash: 'hash-recuperacao',
          status: 'pendente',
          expiraEm: new Date('2026-07-22T11:00:00.000Z'),
          payload: { origem: 'recuperacao_senha' },
          criadoEm: new Date('2026-07-22T09:00:00.000Z')
        }
      ]
    );

    const resposta = await servico.listarConvites('tenant-1');

    expect(repositorioTokens.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', status: 'pendente' },
      order: { criadoEm: 'DESC' }
    });
    expect(resposta).toEqual({
      itens: [
        {
          id: 'token-1',
          usuarioId: 'colaborador-1',
          tenantId: 'tenant-1',
          email: 'agenda@octaclin.local',
          role: 'Collaborator',
          status: 'pendente',
          expiraEm: new Date('2026-07-29T10:00:00.000Z'),
          criadoEm: new Date('2026-07-22T10:00:00.000Z'),
          criadoPorUsuarioId: 'cliente-1',
          emailErro: undefined
        }
      ],
      total: 1
    });
  });

  it('deve listar historico completo de convites administrativos por usuario', async () => {
    const { servico, repositorioTokens } = criarServico(
      [
        {
          id: 'colaborador-1',
          tenantId: 'tenant-1',
          emailCriptografado: Buffer.from('email:agenda@octaclin.local'),
          emailHash: 'hash:agenda@octaclin.local',
          senhaHash: 'senha-aleatoria',
          role: 'Collaborator',
          ativo: false,
          criadoEm: new Date('2026-07-20T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        },
        {
          id: 'profissional-1',
          tenantId: 'tenant-1',
          emailCriptografado: Buffer.from('email:prof@octaclin.local'),
          emailHash: 'hash:prof@octaclin.local',
          senhaHash: 'senha-aleatoria',
          role: 'Professional',
          ativo: true,
          criadoEm: new Date('2026-07-20T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ],
      [
        {
          id: 'token-2',
          tenantId: 'tenant-1',
          usuarioId: 'colaborador-1',
          emailHash: 'hash:agenda@octaclin.local',
          tokenHash: 'hash-token-2',
          status: 'pendente',
          expiraEm: new Date('2026-07-30T10:00:00.000Z'),
          payload: {
            origem: 'convite_usuario_cliente',
            role: 'Collaborator',
            reenviadoPorUsuarioId: 'cliente-2',
            convidadoEm: '2026-07-23T10:00:00.000Z'
          },
          criadoEm: new Date('2026-07-23T10:00:00.000Z')
        },
        {
          id: 'token-1',
          tenantId: 'tenant-1',
          usuarioId: 'colaborador-1',
          emailHash: 'hash:agenda@octaclin.local',
          tokenHash: 'hash-token-1',
          status: 'revogado',
          expiraEm: new Date('2026-07-29T10:00:00.000Z'),
          revogadoEm: new Date('2026-07-23T09:00:00.000Z'),
          payload: {
            origem: 'convite_usuario_cliente',
            role: 'Collaborator',
            criadoPorUsuarioId: 'cliente-1',
            revogadoPorUsuarioId: 'cliente-2',
            motivoRevogacao: 'reenviado',
            convidadoEm: '2026-07-22T10:00:00.000Z'
          },
          criadoEm: new Date('2026-07-22T10:00:00.000Z')
        },
        {
          id: 'token-3',
          tenantId: 'tenant-1',
          usuarioId: 'profissional-1',
          emailHash: 'hash:prof@octaclin.local',
          tokenHash: 'hash-token-3',
          status: 'usado',
          usadoEm: new Date('2026-07-24T10:00:00.000Z'),
          expiraEm: new Date('2026-07-31T10:00:00.000Z'),
          payload: {
            origem: 'convite_usuario_cliente',
            role: 'Professional',
            criadoPorUsuarioId: 'cliente-1',
            convidadoEm: '2026-07-24T09:00:00.000Z'
          },
          criadoEm: new Date('2026-07-24T09:00:00.000Z')
        }
      ]
    );

    const resposta = await servico.listarHistoricoConvites('tenant-1');

    expect(repositorioTokens.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      order: { criadoEm: 'DESC' }
    });
    expect(resposta.total).toBe(3);
    expect(resposta.itens).toEqual([
      expect.objectContaining({
        id: 'token-3',
        usuarioId: 'profissional-1',
        email: 'prof@octaclin.local',
        role: 'Professional',
        status: 'usado',
        criadoPorUsuarioId: 'cliente-1',
        usadoEm: new Date('2026-07-24T10:00:00.000Z')
      }),
      expect.objectContaining({
        id: 'token-2',
        usuarioId: 'colaborador-1',
        email: 'agenda@octaclin.local',
        role: 'Collaborator',
        status: 'pendente',
        reenviadoPorUsuarioId: 'cliente-2'
      }),
      expect.objectContaining({
        id: 'token-1',
        usuarioId: 'colaborador-1',
        email: 'agenda@octaclin.local',
        role: 'Collaborator',
        status: 'revogado',
        criadoPorUsuarioId: 'cliente-1',
        revogadoPorUsuarioId: 'cliente-2',
        motivoRevogacao: 'reenviado',
        revogadoEm: new Date('2026-07-23T09:00:00.000Z')
      })
    ]);
    expect(JSON.stringify(resposta)).not.toContain('hash-token');
  });

  it('deve exportar historico de convites administrativos em csv simples', async () => {
    const { servico } = criarServico(
      [
        {
          id: 'colaborador-1',
          tenantId: 'tenant-1',
          emailCriptografado: Buffer.from('email:agenda@octaclin.local'),
          emailHash: 'hash:agenda@octaclin.local',
          senhaHash: 'senha-aleatoria',
          role: 'Collaborator',
          ativo: false,
          criadoEm: new Date('2026-07-20T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ],
      [
        {
          id: 'token-1',
          tenantId: 'tenant-1',
          usuarioId: 'colaborador-1',
          emailHash: 'hash:agenda@octaclin.local',
          tokenHash: 'hash-token-1',
          status: 'revogado',
          expiraEm: new Date('2026-07-29T10:00:00.000Z'),
          revogadoEm: new Date('2026-07-23T09:00:00.000Z'),
          payload: {
            origem: 'convite_usuario_cliente',
            role: 'Collaborator',
            criadoPorUsuarioId: 'cliente-1',
            revogadoPorUsuarioId: 'cliente-2',
            motivoRevogacao: 'manual',
            convidadoEm: '2026-07-22T10:00:00.000Z'
          },
          criadoEm: new Date('2026-07-22T10:00:00.000Z')
        }
      ]
    );

    const csv = await servico.exportarHistoricoConvitesCsv('tenant-1');

    expect(csv).toContain('email,role,status,criado_em,expira_em,usado_em,revogado_em,criado_por,reenviado_por,revogado_por,motivo_revogacao,email_erro');
    expect(csv).toContain('agenda@octaclin.local,Collaborator,revogado,2026-07-22T10:00:00.000Z,2026-07-29T10:00:00.000Z,,2026-07-23T09:00:00.000Z,cliente-1,,cliente-2,manual,');
    expect(csv).not.toContain('hash-token');
  });

  it('deve reenviar convite revogando tokens pendentes anteriores', async () => {
    process.env.EXPOR_LINK_RECUPERACAO_SENHA = 'true';
    const tokenAntigo: Record<string, any> = {
      id: 'token-antigo',
      tenantId: 'tenant-1',
      usuarioId: 'colaborador-1',
      emailHash: 'hash:agenda@octaclin.local',
      tokenHash: 'hash-antigo',
      status: 'pendente',
      expiraEm: new Date('2026-07-29T10:00:00.000Z'),
      payload: { origem: 'convite_usuario_cliente', role: 'Collaborator' },
      criadoEm: new Date('2026-07-22T10:00:00.000Z')
    };
    const { servico, repositorioTokens, email } = criarServico(
      [
        {
          id: 'colaborador-1',
          tenantId: 'tenant-1',
          emailCriptografado: Buffer.from('email:agenda@octaclin.local'),
          emailHash: 'hash:agenda@octaclin.local',
          senhaHash: 'senha-aleatoria',
          role: 'Collaborator',
          ativo: true,
          criadoEm: new Date('2026-07-20T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ],
      [tokenAntigo]
    );

    const resposta = await servico.reenviarConvite('tenant-1', 'cliente-1', 'colaborador-1');

    expect(tokenAntigo.status).toBe('revogado');
    expect(tokenAntigo.revogadoEm).toEqual(expect.any(Date));
    expect(repositorioTokens.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'token-antigo',
        status: 'revogado',
        revogadoEm: expect.any(Date)
      })
    );
    expect(repositorioTokens.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'colaborador-1',
        status: 'pendente',
        payload: expect.objectContaining({
          origem: 'convite_usuario_cliente',
          reenviadoPorUsuarioId: 'cliente-1',
          role: 'Collaborator'
        })
      })
    );
    expect(email.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          destino: 'agenda@octaclin.local',
          linkPrimeiroAcesso: expect.stringMatching(/^http:\/\/localhost:3000\/recuperar-senha\?token=tenant-1\./)
        })
      })
    );
    expect(resposta.convite?.linkPrimeiroAcesso).toMatch(/^http:\/\/localhost:3000\/recuperar-senha\?token=tenant-1\./);
    delete process.env.EXPOR_LINK_RECUPERACAO_SENHA;
  });

  it('deve revogar convite administrativo e desativar usuario convidado', async () => {
    const tokenPendente: Record<string, any> = {
      id: 'token-1',
      tenantId: 'tenant-1',
      usuarioId: 'colaborador-1',
      emailHash: 'hash:agenda@octaclin.local',
      tokenHash: 'hash-token',
      status: 'pendente',
      expiraEm: new Date('2026-07-29T10:00:00.000Z'),
      payload: { origem: 'convite_usuario_cliente', role: 'Collaborator' },
      criadoEm: new Date('2026-07-22T10:00:00.000Z')
    };
    const { servico, repositorioUsuarios, repositorioTokens } = criarServico(
      [
        {
          id: 'colaborador-1',
          tenantId: 'tenant-1',
          emailCriptografado: Buffer.from('email:agenda@octaclin.local'),
          emailHash: 'hash:agenda@octaclin.local',
          senhaHash: 'senha-aleatoria',
          role: 'Collaborator',
          ativo: true,
          criadoEm: new Date('2026-07-20T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ],
      [tokenPendente]
    );

    await servico.revogarConvite('tenant-1', 'cliente-1', 'colaborador-1');

    expect(tokenPendente.status).toBe('revogado');
    expect(tokenPendente.revogadoEm).toEqual(expect.any(Date));
    expect(tokenPendente.payload).toEqual(
      expect.objectContaining({
        revogadoPorUsuarioId: 'cliente-1'
      })
    );
    expect(repositorioTokens.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'token-1', status: 'revogado' }));
    expect(repositorioUsuarios.update).toHaveBeenCalledWith({ id: 'colaborador-1', tenantId: 'tenant-1' }, { ativo: false });
  });
});
