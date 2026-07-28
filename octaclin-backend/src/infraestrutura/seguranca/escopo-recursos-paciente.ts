import { NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { UsuarioAutenticado } from '../../modulos/auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../modulos/pacientes/infraestrutura/paciente.orm';
import { PACIENTE_SENTINELA_INEXISTENTE, resolverPacienteIdDoUsuario } from './escopo-paciente';
import { resolverProfissionalIdDoUsuario } from './escopo-profissional';

export interface FiltroEscopoRecursosPaciente {
  pacienteId?: string;
  profissionalResponsavelId?: string;
}

/**
 * Resolve o filtro de escopo aplicavel a recursos clinicos vinculados a um
 * paciente. A autorizacao de entrada no endpoint permanece nos guards; esta
 * politica apenas limita os dados visiveis para uma sessao ja admitida.
 */
export async function resolverFiltroEscopoRecursosPaciente(
  gerenciador: EntityManager,
  tenantId: string,
  usuario: UsuarioAutenticado
): Promise<FiltroEscopoRecursosPaciente> {
  if (usuario.papel === 'Patient') {
    return { pacienteId: await resolverPacienteIdDoUsuario(gerenciador, tenantId, usuario.usuarioId) };
  }

  if (usuario.papel === 'Professional') {
    return { profissionalResponsavelId: await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario) };
  }

  if (usuario.papel === 'SuperAdmin' || usuario.papel === 'Collaborator') {
    return {};
  }

  return { pacienteId: PACIENTE_SENTINELA_INEXISTENTE };
}

/**
 * Carrega um paciente somente quando ele pertence ao tenant, nao esta
 * arquivado e pode ser acessado pelo escopo do usuario autenticado.
 */
export async function validarPacienteNoEscopo(
  gerenciador: EntityManager,
  tenantId: string,
  pacienteId: string,
  usuario: UsuarioAutenticado
): Promise<PacienteOrm> {
  const filtroEscopo = await resolverFiltroEscopoRecursosPaciente(gerenciador, tenantId, usuario);
  const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
    where: {
      id: pacienteId,
      tenantId,
      arquivadoEm: IsNull(),
      ...(filtroEscopo.profissionalResponsavelId
        ? { profissionalResponsavelId: filtroEscopo.profissionalResponsavelId }
        : {})
    }
  });

  if (!paciente || (filtroEscopo.pacienteId && filtroEscopo.pacienteId !== paciente.id)) {
    throw new NotFoundException('Paciente nao encontrado.');
  }

  return paciente;
}
