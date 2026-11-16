import { ForbiddenException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { IsNull, type EntityManager } from 'typeorm';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { autorizarColaboradorDelegado } from '../../profissionais/aplicacao/servico-delegacoes-carteira';

/**
 * Quem pode registrar PENDÊNCIA (nunca confirmação clínica): o Professional responsável pelo paciente ou, desde a P2d-2,
 * o Collaborator com delegação vigente da carteira do responsável ATUAL, provada sob lock na mesma transação.
 * Patient continua fechado até a P2d-3 (vínculo de representação).
 */
export async function autorizarPendenciaRestricao(g: EntityManager, u: UsuarioAutenticado, pacienteId: string): Promise<'profissional' | 'colaborador'> {
  const negar = () => new ForbiddenException('Operação não autorizada.');
  if (!g.queryRunner?.isTransactionActive || !u || !isUUID(u.tenantId) || !isUUID(u.usuarioId) || !isUUID(pacienteId) ||
    (u.papel !== 'Professional' && u.papel !== 'Collaborator')) throw negar();
  if (u.papel === 'Collaborator') {
    await autorizarColaboradorDelegado(g, u.tenantId, u.usuarioId, pacienteId);
    return 'colaborador';
  }
  const usuario = await g.getRepository(UsuarioOrm).findOne({
    where: { id: u.usuarioId, tenantId: u.tenantId }, select: { id: true, role: true, ativo: true }, lock: { mode: 'pessimistic_read' }
  });
  if (!usuario?.ativo || usuario.role !== u.papel) throw negar();
  const profissional = await g.getRepository(ProfissionalOrm).findOne({
    where: { tenantId: u.tenantId, usuarioId: u.usuarioId, arquivadoEm: IsNull() }, lock: { mode: 'pessimistic_read' }
  });
  if (!profissional) throw negar();
  const repo = g.getRepository(PacienteOrm);
  const paciente = await repo.findOne({ where: { id: pacienteId, tenantId: u.tenantId, arquivadoEm: IsNull(),
    profissionalResponsavelId: profissional.id },
    lock: { mode: 'pessimistic_write' } });
  if (!paciente) throw negar();
  return 'profissional';
}
