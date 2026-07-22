import { NotFoundException } from '@nestjs/common';
import { ServicoPacientes } from './servico-pacientes';

function criarGerenciadorFake(repositorio: Record<string, unknown>) {
  return {
    getRepository: jest.fn().mockReturnValue(repositorio)
  };
}

const limitesPermitidos = {
  checarLimite: jest.fn(async () => ({ permitido: true }))
};

describe('ServicoPacientes', () => {
  it('deve criar paciente dentro do contexto do tenant e criptografar dados sensiveis', async () => {
    const repositorio = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>) => ({ id: 'paciente-1', ...dados }))
    };
    const gerenciador = criarGerenciadorFake(repositorio);
    const executorTenant = {
      executar: jest.fn((tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    const criptografia = {
      criptografar: jest.fn((valor: string) => Buffer.from(`criptografado:${valor}`)),
      descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('criptografado:', ''))
    };
    const servico = new ServicoPacientes(executorTenant as never, criptografia as never, limitesPermitidos as never);

    const paciente = await servico.criar('tenant-1', {
      profissionalResponsavelId: 'profissional-1',
      nome: 'Maria',
      contato: 'maria@example.com'
    });

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(criptografia.criptografar).toHaveBeenCalledWith('Maria');
    expect(paciente).toEqual(expect.objectContaining({ nome: 'Maria', contato: 'maria@example.com' }));
  });

  it('deve limitar a paginacao em no maximo 100 itens', async () => {
    const repositorio = {
      findAndCount: jest.fn(async () => [[], 0])
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limitesPermitidos as never
    );

    await servico.listar('tenant-1', 1, 500);

    expect(repositorio.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('deve bloquear criacao de paciente quando limite do plano for atingido', async () => {
    const repositorio = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>) => ({ id: 'paciente-1', ...dados }))
    };
    const executorTenant = {
      executar: jest.fn((tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao(criarGerenciadorFake(repositorio))
      )
    };
    const limites = {
      checarLimite: jest.fn(async () => ({
        permitido: false,
        recurso: 'pacientes',
        plano: 'Plano gratuito',
        uso: 25,
        limite: 25,
        restante: 0,
        mensagem: 'Limite de pacientes atingido para o Plano gratuito.'
      }))
    };
    const servico = new ServicoPacientes(
      executorTenant as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limites as never
    );

    await expect(
      servico.criar('tenant-1', {
        profissionalResponsavelId: 'profissional-1',
        nome: 'Maria',
        contato: 'maria@example.com'
      })
    ).rejects.toThrow('Limite de pacientes atingido para o Plano gratuito.');

    expect(limites.checarLimite).toHaveBeenCalledWith('tenant-1', 'pacientes');
    expect(repositorio.save).not.toHaveBeenCalled();
  });

  it('deve retornar pacientes com campos sensiveis descriptografados na listagem', async () => {
    const repositorio = {
      findAndCount: jest.fn(async () => [
        [
          {
            id: 'paciente-1',
            tenantId: 'tenant-1',
            profissionalResponsavelId: 'profissional-1',
            nomeCriptografado: Buffer.from('cripto:Maria'),
            contatoCriptografado: Buffer.from('cripto:maria@example.com'),
            statusAdesao: 'novo',
            scoreRisco: '0',
            criadoEm: new Date('2026-01-01T00:00:00Z'),
            atualizadoEm: new Date('2026-01-01T00:00:00Z')
          }
        ],
        1
      ])
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      {
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const resposta = await servico.listar('tenant-1');

    expect(resposta.itens[0]).toEqual(expect.objectContaining({ nome: 'Maria', contato: 'maria@example.com' }));
  });

  it('deve exibir contato principal quando paciente possui contato estruturado pelo portal', async () => {
    const repositorio = {
      findAndCount: jest.fn(async () => [
        [
          {
            id: 'paciente-1',
            tenantId: 'tenant-1',
            profissionalResponsavelId: 'profissional-1',
            nomeCriptografado: Buffer.from('cripto:Maria'),
            contatoCriptografado: Buffer.from(
              'cripto:{"email":"maria@example.com","whatsapp":"5511999999999","preferencias":{"email":true,"whatsapp":false}}'
            ),
            statusAdesao: 'novo',
            scoreRisco: '0',
            criadoEm: new Date('2026-01-01T00:00:00Z'),
            atualizadoEm: new Date('2026-01-01T00:00:00Z')
          }
        ],
        1
      ])
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      {
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const resposta = await servico.listar('tenant-1');

    expect(resposta.itens[0]).toEqual(expect.objectContaining({ nome: 'Maria', contato: 'maria@example.com' }));
  });

  it('deve falhar ao arquivar paciente inexistente', async () => {
    const repositorio = {
      update: jest.fn(async () => ({ affected: 0 }))
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limitesPermitidos as never
    );

    await expect(servico.arquivar('tenant-1', 'paciente-inexistente')).rejects.toBeInstanceOf(NotFoundException);
  });
});
