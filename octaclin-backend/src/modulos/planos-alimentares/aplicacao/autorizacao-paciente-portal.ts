import { ForbiddenException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { IsNull, type EntityManager } from 'typeorm';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { VinculoRepresentacaoPacienteOrm } from '../../pacientes/infraestrutura/vinculo-representacao-paciente.orm';

export type AcessoPortalPaciente = 'propria' | 'representante';

/**
 * FOOD06 P2d-3a: prova, na transação fornecida e sob lock, que a conta `Patient` do token acessa o paciente escolhido:
 * é a conta do próprio paciente (`pacientes.usuario_id`) ou tem vínculo de representação vigente com ele. O `pacienteId`
 * vindo do cliente é só seletor. Ordem de locks: usuário → paciente → vínculo (a mesma de quem arquiva o paciente e de
 * quem desativa a conta). Nunca dá ação clínica.
 */
export async function autorizarPacientePortal(g: EntityManager, u: UsuarioAutenticado, pacienteId: string): Promise<AcessoPortalPaciente> {
  const negar = () => new ForbiddenException('Operação não autorizada.');
  if (!g.queryRunner?.isTransactionActive || !u || !isUUID(u.tenantId) || !isUUID(u.usuarioId) || !isUUID(pacienteId) || u.papel !== 'Patient') throw negar();
  const tenantId = u.tenantId.toLowerCase(), usuarioId = u.usuarioId.toLowerCase(), paciente = pacienteId.toLowerCase();
  const conta = await g.getRepository(UsuarioOrm).findOne({ where: { id: usuarioId, tenantId }, select: { id: true, role: true, ativo: true },
    lock: { mode: 'pessimistic_read' } });
  if (!conta?.ativo || conta.role !== 'Patient') throw negar();
  const linha = await g.getRepository(PacienteOrm).findOne({ where: { id: paciente, tenantId, arquivadoEm: IsNull() },
    select: { id: true, usuarioId: true }, lock: { mode: 'pessimistic_write' } });
  if (!linha) throw negar();
  if (linha.usuarioId === usuarioId) return 'propria';
  const vinculo = await g.getRepository(VinculoRepresentacaoPacienteOrm).findOne({ where: { tenantId, pacienteId: paciente,
    representanteUsuarioId: usuarioId, revogadoEm: IsNull() }, select: { id: true }, lock: { mode: 'pessimistic_read' } });
  if (!vinculo) throw negar();
  return 'representante';
}
