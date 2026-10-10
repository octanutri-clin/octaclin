import { NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
export async function garantirEscopoPaciente(m: EntityManager, tenantId: string, pacienteId: string, usuario: UsuarioAutenticado, bloquear = false) {
  const profissionalResponsavelId = await resolverProfissionalIdDoUsuario(m, tenantId, usuario);
  const paciente = await m.getRepository(PacienteOrm).findOne({
    where: { id: pacienteId, tenantId, arquivadoEm: IsNull(), ...(profissionalResponsavelId ? { profissionalResponsavelId } : {}) },
    ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {})
  });
  if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
  return paciente;
}
