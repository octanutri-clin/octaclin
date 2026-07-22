import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ServicoUsuariosCliente } from './servico-usuarios-cliente';

function criarRepositorioFake(usuarios: Record<string, any>[]) {
  return {
    find: jest.fn(async (opcoes?: any) => {
      let itens = [...usuarios];
      if (opcoes?.where?.tenantId) itens = itens.filter((usuario) => usuario.tenantId === opcoes.where.tenantId);
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
      const usuario = usuarios.find((item) => item.id === where.id && item.tenantId === where.tenantId);
      if (!usuario) return { affected: 0 };
      Object.assign(usuario, dados);
      return { affected: 1 };
    })
  };
}

function criarServico(usuarios: Record<string, any>[]) {
  const repositorioUsuarios = criarRepositorioFake(usuarios);
  const executorTenant = {
    executar: jest.fn((_tenantId: string, callback: any) =>
      callback({
        getRepository: (entidade: any) => {
          if (entidade === UsuarioOrm) return repositorioUsuarios;
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

  return {
    servico: new ServicoUsuariosCliente(executorTenant as never, criptografia as never, senhas as never),
    repositorioUsuarios,
    executorTenant,
    criptografia,
    senhas
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

  it('deve criar usuario colaborador com email normalizado e senha protegida', async () => {
    const { servico, repositorioUsuarios, criptografia, senhas } = criarServico([]);

    const resposta = await servico.criar('tenant-1', {
      email: ' Novo@OctaClin.Local ',
      senhaInicial: 'SenhaNova@123',
      role: 'Collaborator'
    });

    expect(criptografia.gerarHashBusca).toHaveBeenCalledWith(' Novo@OctaClin.Local ');
    expect(criptografia.criptografar).toHaveBeenCalledWith('novo@octaclin.local');
    expect(senhas.gerarHash).toHaveBeenCalledWith('SenhaNova@123');
    expect(repositorioUsuarios.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        emailHash: 'hash:novo@octaclin.local',
        emailCriptografado: Buffer.from('email:novo@octaclin.local'),
        senhaHash: 'senha:SenhaNova@123',
        role: 'Collaborator',
        ativo: true
      })
    );
    expect(resposta).toEqual(
      expect.objectContaining({
        id: 'usuario-1',
        tenantId: 'tenant-1',
        email: 'novo@octaclin.local',
        role: 'Collaborator',
        ativo: true
      })
    );
    expect(JSON.stringify(resposta)).not.toContain('SenhaNova@123');
  });

  it('deve impedir o gestor de desativar o proprio usuario', async () => {
    const { servico, repositorioUsuarios } = criarServico([]);

    await expect(servico.desativar('tenant-1', 'cliente-1', 'cliente-1')).rejects.toThrow(
      'O gestor logado nao pode desativar o proprio acesso.'
    );
    expect(repositorioUsuarios.update).not.toHaveBeenCalled();
  });
});
