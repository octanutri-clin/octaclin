import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { RefreshTokenOrm } from '../../auth/infraestrutura/refresh-token.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ProfissionalOrm } from '../infraestrutura/profissional.orm';
import { ServicoProfissionais } from './servico-profissionais';

const usuarioColaborador: UsuarioAutenticado = {
  usuarioId: 'usuario-colaborador-1',
  tenantId: 'tenant-1',
  papel: 'Collaborator',
  emailHash: 'hash-colaborador',
  permissoes: []
};

const usuarioProfissional: UsuarioAutenticado = {
  usuarioId: 'usuario-profissional-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash-profissional',
  permissoes: []
};

function criarRepositorioFake() {
  return {
    create: jest.fn((dados: Record<string, unknown>) => dados),
    save: jest.fn(async (dados: Record<string, unknown>) => ({
      id: dados.usuarioId ? 'profissional-1' : 'usuario-1',
      ...dados
    })),
    findAndCount: jest.fn(async () => [[], 0])
  };
}

describe('ServicoProfissionais', () => {
  it('deve revogar o acesso ao arquivar um profissional', async () => {
    const repositorioProfissionais = {
      findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-1' })),
      update: jest.fn(async () => ({ affected: 1 }))
    };
    const repositorioUsuarios = { update: jest.fn(async () => ({ affected: 1 })) };
    const repositorioRefreshTokens = { update: jest.fn(async () => ({ affected: 1 })) };
    const servico = new ServicoProfissionais(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({
            getRepository: jest.fn((entidade: unknown) => {
              if (entidade === ProfissionalOrm) return repositorioProfissionais;
              if (entidade === UsuarioOrm) return repositorioUsuarios;
              if (entidade === RefreshTokenOrm) return repositorioRefreshTokens;
              throw new Error('Repositorio nao mapeado.');
            })
          })
        )
      } as never,
      { gerarHashBusca: jest.fn(), criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      { gerarHash: jest.fn() } as never
    );

    await servico.arquivar('tenant-1', 'profissional-1');

    expect(repositorioUsuarios.update).toHaveBeenCalledWith(
      { id: 'usuario-1', tenantId: 'tenant-1' },
      { ativo: false }
    );
    expect(repositorioRefreshTokens.update).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', usuarioId: 'usuario-1' },
      { revogadoEm: expect.any(Date) }
    );
  });

  it('deve criar usuario profissional e perfil no mesmo contexto tenant', async () => {
    const repositorioUsuarios = criarRepositorioFake();
    const repositorioProfissionais = criarRepositorioFake();
    const gerenciador = {
      getRepository: jest.fn((entidade: { name: string }) =>
        entidade.name === 'UsuarioOrm' ? repositorioUsuarios : repositorioProfissionais
      )
    };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    const criptografia = {
      gerarHashBusca: jest.fn(() => 'email-hash'),
      criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
      descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
    };
    const senhas = { gerarHash: jest.fn(() => 'hash-senha') };
    const servico = new ServicoProfissionais(executorTenant as never, criptografia as never, senhas as never);

    await servico.criar('tenant-1', {
      email: 'dra.carla@example.com',
      senhaInicial: 'senha-forte',
      nome: 'Dra. Carla'
    });

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(repositorioUsuarios.save).toHaveBeenCalledWith(expect.objectContaining({ role: 'Professional' }));
    expect(repositorioProfissionais.save).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 'usuario-1' }));
  });

  it('deve retornar profissionais com nome descriptografado na listagem', async () => {
    const repositorioProfissionais = {
      findAndCount: jest.fn(async () => [
        [
          {
            id: 'profissional-1',
            tenantId: 'tenant-1',
            usuarioId: 'usuario-1',
            nomeCriptografado: Buffer.from('cripto:Dra. Carla'),
            registroProfissional: 'CRN-1',
            especialidade: 'Nutricao clinica',
            criadoEm: new Date('2026-01-01T00:00:00Z'),
            atualizadoEm: new Date('2026-01-01T00:00:00Z')
          }
        ],
        1
      ])
    };
    const servico = new ServicoProfissionais(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({ getRepository: jest.fn(() => repositorioProfissionais) })
        )
      } as never,
      {
        gerarHashBusca: jest.fn(),
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      { gerarHash: jest.fn() } as never
    );

    const resposta = await servico.listar('tenant-1', usuarioColaborador);

    expect(resposta.itens[0]).toEqual(expect.objectContaining({ nome: 'Dra. Carla' }));
  });

  describe('escopo pacientes_responsaveis para Professional', () => {
    function criarServicoComProfissional(dadosProfissional: Record<string, unknown> | null) {
      const repositorioProfissionais = {
        findAndCount: jest.fn(async () => [[], 0]),
        findOne: jest.fn(async () => dadosProfissional)
      };
      const servico = new ServicoProfissionais(
        {
          executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
            operacao({
              getRepository: jest.fn((entidade: { name: string }) => {
                if (entidade === ProfissionalOrm) return repositorioProfissionais;
                throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
              })
            })
          )
        } as never,
        { gerarHashBusca: jest.fn(), criptografar: jest.fn(), descriptografar: jest.fn() } as never,
        { gerarHash: jest.fn() } as never
      );
      return { servico, repositorioProfissionais };
    }

    it('deve listar apenas o proprio registro quando o usuario for Professional', async () => {
      const { servico, repositorioProfissionais } = criarServicoComProfissional({
        id: 'profissional-1',
        tenantId: 'tenant-1',
        usuarioId: 'usuario-profissional-1'
      });

      await servico.listar('tenant-1', usuarioProfissional);

      expect(repositorioProfissionais.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'profissional-1' }) })
      );
    });

    it('deve tratar outro profissional como nao encontrado ao consultar por id como Professional', async () => {
      const { servico } = criarServicoComProfissional({
        id: 'profissional-1',
        tenantId: 'tenant-1',
        usuarioId: 'usuario-profissional-1'
      });

      await expect(servico.obterPorId('tenant-1', 'profissional-outro-2', usuarioProfissional)).rejects.toThrow(
        'Profissional nao encontrado.'
      );
    });
  });
});
