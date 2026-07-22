import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { TokenRedefinicaoSenhaOrm } from '../../auth/infraestrutura/token-redefinicao-senha.orm';
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

function criarServico(usuarios: Record<string, any>[], tokens: Record<string, any>[] = []) {
  const repositorioUsuarios = criarRepositorioFake(usuarios);
  const repositorioTokens = criarRepositorioFake(tokens);
  const executorTenant = {
    executar: jest.fn((_tenantId: string, callback: any) =>
      callback({
        getRepository: (entidade: any) => {
          if (entidade === UsuarioOrm) return repositorioUsuarios;
          if (entidade === TokenRedefinicaoSenhaOrm) return repositorioTokens;
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
    servico: new ServicoUsuariosCliente(executorTenant as never, criptografia as never, senhas as never, email as never),
    repositorioUsuarios,
    repositorioTokens,
    executorTenant,
    criptografia,
    senhas,
    email
  };
}

describe('ServicoUsuariosCliente', () => {
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
