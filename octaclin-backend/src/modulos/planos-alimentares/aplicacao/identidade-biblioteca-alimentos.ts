import { ForbiddenException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
export async function identidadeBiblioteca(g: EntityManager, tenantId: string, usuario: UsuarioAutenticado, escrita: boolean): Promise<string> {
  if (usuario.tenantId !== tenantId || usuario.papel !== 'Professional' || !usuario.permissoes.includes(escrita ? 'planos_alimentares.gerenciar' : 'planos_alimentares.ler')) throw new ForbiddenException('Acesso à biblioteca não permitido.');
  const p = await g.getRepository(ProfissionalOrm).findOne({ where: { tenantId, usuarioId: usuario.usuarioId, arquivadoEm: IsNull() }, lock: { mode: 'pessimistic_read' } });
  if (!p) throw new ForbiddenException('Vínculo profissional indisponível.');
  return p.id;
}
