import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UsuarioAutenticado } from '../../modulos/auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../modulos/pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../modulos/profissionais/infraestrutura/profissional.orm';
import { PACIENTE_SENTINELA_INEXISTENTE } from './escopo-paciente';
import { PROFISSIONAL_SENTINELA_INEXISTENTE } from './escopo-profissional';
import { resolverFiltroEscopoRecursosPaciente, validarPacienteNoEscopo } from './escopo-recursos-paciente';

const usuarios: Record<'Patient' | 'Professional' | 'SuperAdmin' | 'Collaborator', UsuarioAutenticado> = {
  Patient: {
    usuarioId: 'usuario-paciente-1',
    tenantId: 'tenant-1',
    papel: 'Patient',
    emailHash: 'hash-paciente',
    permissoes: []
  },
  Professional: {
    usuarioId: 'usuario-profissional-1',
    tenantId: 'tenant-1',
    papel: 'Professional',
    emailHash: 'hash-profissional',
    permissoes: []
  },
  SuperAdmin: {
    usuarioId: 'usuario-admin-1',
    tenantId: 'tenant-1',
    papel: 'SuperAdmin',
    emailHash: 'hash-admin',
    permissoes: []
  },
  Collaborator: {
    usuarioId: 'usuario-colaborador-1',
    tenantId: 'tenant-1',
    papel: 'Collaborator',
    emailHash: 'hash-colaborador',
    permissoes: []
  }
};

function criarGerenciador(
  paciente: { findOne: jest.Mock },
  profissional: { findOne: jest.Mock }
): EntityManager {
  return {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === PacienteOrm) return paciente;
      if (entidade === ProfissionalOrm) return profissional;
      throw new Error('Repositorio nao esperado');
    })
  } as unknown as EntityManager;
}

describe('escopo de recursos de paciente', () => {
  it('resolve os filtros por papel, mantendo SuperAdmin e Collaborator com visao tenant-wide', async () => {
    const gerenciador = criarGerenciador(
      { findOne: jest.fn(async () => ({ id: 'paciente-1' })) },
      { findOne: jest.fn(async () => ({ id: 'profissional-1' })) }
    );

    await expect(resolverFiltroEscopoRecursosPaciente(gerenciador, 'tenant-1', usuarios.Patient)).resolves.toEqual({
      pacienteId: 'paciente-1'
    });
    await expect(resolverFiltroEscopoRecursosPaciente(gerenciador, 'tenant-1', usuarios.Professional)).resolves.toEqual({
      profissionalResponsavelId: 'profissional-1'
    });
    await expect(resolverFiltroEscopoRecursosPaciente(gerenciador, 'tenant-1', usuarios.SuperAdmin)).resolves.toEqual({});
    await expect(resolverFiltroEscopoRecursosPaciente(gerenciador, 'tenant-1', usuarios.Collaborator)).resolves.toEqual({});
  });

  it('usa sentinela quando Patient ou Professional nao possui vinculo ativo no tenant', async () => {
    const gerenciador = criarGerenciador({ findOne: jest.fn(async () => null) }, { findOne: jest.fn(async () => null) });

    await expect(resolverFiltroEscopoRecursosPaciente(gerenciador, 'tenant-1', usuarios.Patient)).resolves.toEqual({
      pacienteId: PACIENTE_SENTINELA_INEXISTENTE
    });
    await expect(resolverFiltroEscopoRecursosPaciente(gerenciador, 'tenant-1', usuarios.Professional)).resolves.toEqual({
      profissionalResponsavelId: PROFISSIONAL_SENTINELA_INEXISTENTE
    });
  });

  it('retorna NotFoundException quando Professional tenta acessar paciente de outro profissional', async () => {
    const paciente = { findOne: jest.fn(async () => null) };
    const profissional = { findOne: jest.fn(async () => ({ id: 'profissional-1' })) };
    const gerenciador = criarGerenciador(paciente, profissional);

    await expect(validarPacienteNoEscopo(gerenciador, 'tenant-1', 'paciente-outro-profissional', usuarios.Professional)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(paciente.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'paciente-outro-profissional',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        arquivadoEm: expect.any(Object)
      })
    });
  });

  it('aceita o proprio paciente e resolve o vinculo pelo usuario autenticado', async () => {
    const pacienteProprio = { id: 'paciente-1', tenantId: 'tenant-1' };
    const paciente = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(pacienteProprio)
        .mockResolvedValueOnce(pacienteProprio)
    };
    const gerenciador = criarGerenciador(paciente, { findOne: jest.fn() });

    await expect(validarPacienteNoEscopo(gerenciador, 'tenant-1', 'paciente-1', usuarios.Patient)).resolves.toBe(
      pacienteProprio
    );
    expect(paciente.findOne).toHaveBeenNthCalledWith(1, {
      where: {
        usuarioId: 'usuario-paciente-1',
        tenantId: 'tenant-1',
        arquivadoEm: expect.any(Object)
      }
    });
    expect(paciente.findOne).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        arquivadoEm: expect.any(Object)
      }
    });
  });

  it('retorna NotFoundException quando Patient tenta acessar paciente de outro vinculo de usuario', async () => {
    const paciente = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'paciente-proprio', tenantId: 'tenant-1' })
        .mockResolvedValueOnce(null)
    };
    const profissional = { findOne: jest.fn() };
    const gerenciador = criarGerenciador(paciente, profissional);

    await expect(validarPacienteNoEscopo(gerenciador, 'tenant-1', 'paciente-outro-usuario', usuarios.Patient)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(paciente.findOne).toHaveBeenCalledWith({
      where: {
        usuarioId: 'usuario-paciente-1',
        tenantId: 'tenant-1',
        arquivadoEm: expect.any(Object)
      }
    });
    expect(paciente.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'paciente-outro-usuario',
        tenantId: 'tenant-1',
        arquivadoEm: expect.any(Object)
      })
    });
  });
});
