import { ServicoProfissionais } from './servico-profissionais';

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

    const resposta = await servico.listar('tenant-1');

    expect(resposta.itens[0]).toEqual(expect.objectContaining({ nome: 'Dra. Carla' }));
  });
});
