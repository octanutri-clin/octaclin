import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ExpedienteProfissionalOrm } from '../infraestrutura/expediente-profissional.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoExpedientes } from './servico-expedientes';

const usuarioSuperAdmin: UsuarioAutenticado = {
  usuarioId: 'usuario-admin',
  tenantId: 'tenant-1',
  papel: 'SuperAdmin',
  emailHash: 'hash',
  permissoes: ['agenda.consultas.criar']
};

const usuarioProfissional: UsuarioAutenticado = {
  usuarioId: 'usuario-prof',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash',
  permissoes: ['agenda.consultas.criar']
};

describe('ServicoExpedientes', () => {
  function criarServico() {
    let faixas: Record<string, unknown>[] = [];
    const repositorioExpediente = {
      create: jest.fn((dados: Record<string, unknown>) => ({ id: `faixa-${Math.random()}`, criadoEm: new Date(), atualizadoEm: new Date(), ...dados })),
      save: jest.fn(async (entradas: Record<string, unknown>[]) => {
        faixas.push(...entradas);
        return entradas;
      }),
      delete: jest.fn(async ({ tenantId, profissionalId }: { tenantId: string; profissionalId: string }) => {
        faixas = faixas.filter((faixa) => !(faixa.tenantId === tenantId && faixa.profissionalId === profissionalId));
      }),
      find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        faixas.filter((faixa) => Object.entries(where).every(([chave, valor]) => faixa[chave] === valor))
      )
    };
    const repositorioProfissional = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'profissional-1' ? ({ id: 'profissional-1', tenantId: 'tenant-1' } as ProfissionalOrm) : null
      )
    };
    const gerenciador = {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === ExpedienteProfissionalOrm) return repositorioExpediente;
        if (entidade === ProfissionalOrm) return repositorioProfissional;
        if (entidade === UserActionLogOrm) return { create: jest.fn((d: unknown) => d), save: jest.fn(async () => undefined) };
        throw new Error('Repositorio nao mapeado');
      })
    };
    const servico = new ServicoExpedientes({
      executar: async (_tenantId: string, fn: (gerenciador: unknown) => unknown) => fn(gerenciador)
    } as never);
    return { servico, faixas: () => faixas, repositorioExpediente };
  }

  it('salva a jornada inteira, substituindo qualquer faixa anterior', async () => {
    const { servico, faixas } = criarServico();

    await servico.salvar(
      'tenant-1',
      { profissionalId: 'profissional-1', faixas: [{ diaSemana: 1, horaInicio: '09:00', horaFim: '12:00' }] },
      usuarioSuperAdmin
    );
    const resultado = await servico.salvar(
      'tenant-1',
      {
        profissionalId: 'profissional-1',
        faixas: [
          { diaSemana: 1, horaInicio: '08:00', horaFim: '12:00' },
          { diaSemana: 1, horaInicio: '13:00', horaFim: '18:00' }
        ]
      },
      usuarioSuperAdmin
    );

    expect(resultado).toHaveLength(2);
    expect(faixas()).toHaveLength(2);
    expect(faixas().every((faixa) => faixa.horaInicio === '08:00' || faixa.horaInicio === '13:00')).toBe(true);
  });

  it('rejeita faixas sobrepostas no mesmo dia', async () => {
    const { servico } = criarServico();

    await expect(
      servico.salvar(
        'tenant-1',
        {
          profissionalId: 'profissional-1',
          faixas: [
            { diaSemana: 1, horaInicio: '08:00', horaFim: '12:00' },
            { diaSemana: 1, horaInicio: '11:00', horaFim: '13:00' }
          ]
        },
        usuarioSuperAdmin
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita faixa com horaFim antes de horaInicio', async () => {
    const { servico } = criarServico();

    await expect(
      servico.salvar(
        'tenant-1',
        { profissionalId: 'profissional-1', faixas: [{ diaSemana: 1, horaInicio: '12:00', horaFim: '08:00' }] },
        usuarioSuperAdmin
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aceita faixas nao sobrepostas em dias diferentes com o mesmo horario', async () => {
    const { servico } = criarServico();

    const resultado = await servico.salvar(
      'tenant-1',
      {
        profissionalId: 'profissional-1',
        faixas: [
          { diaSemana: 1, horaInicio: '08:00', horaFim: '12:00' },
          { diaSemana: 2, horaInicio: '08:00', horaFim: '12:00' }
        ]
      },
      usuarioSuperAdmin
    );

    expect(resultado).toHaveLength(2);
  });

  it('salvar jornada vazia remove todas as faixas do profissional', async () => {
    const { servico, faixas } = criarServico();
    await servico.salvar(
      'tenant-1',
      { profissionalId: 'profissional-1', faixas: [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00' }] },
      usuarioSuperAdmin
    );

    const resultado = await servico.salvar('tenant-1', { profissionalId: 'profissional-1', faixas: [] }, usuarioSuperAdmin);

    expect(resultado).toEqual([]);
    expect(faixas()).toEqual([]);
  });

  it('profissional autenticado so consegue salvar a propria jornada, ignorando profissionalId do corpo', async () => {
    // Papel Professional sem profissional vinculado (nao ha ProfissionalOrm
    // com usuarioId = usuario-prof no repositorio fake) resolve para o
    // sentinela e rejeita -- mesmo padrao ja usado em bloqueios manuais.
    const { servico } = criarServico();

    await expect(
      servico.salvar(
        'tenant-1',
        { profissionalId: 'profissional-1', faixas: [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00' }] },
        usuarioProfissional
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita quando nenhum profissional pode ser resolvido', async () => {
    const { servico } = criarServico();

    await expect(
      servico.salvar('tenant-1', { faixas: [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00' }] }, {
        ...usuarioSuperAdmin
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
