import { EntityManager, IsNull } from 'typeorm';
import { UsuarioAutenticado } from '../../modulos/auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../modulos/profissionais/infraestrutura/profissional.orm';

/**
 * UUID que nao corresponde a nenhum registro real. Usado como filtro sentinela
 * quando um usuario Professional autenticado nao possui profissional vinculado,
 * garantindo lista vazia em vez de expor dados de outros profissionais.
 */
export const PROFISSIONAL_SENTINELA_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

/**
 * Retorna o profissionais.id do usuario autenticado quando ele for Professional
 * (escopo pacientes_responsaveis), ou undefined para papeis com visao tenant-wide
 * (SuperAdmin, Collaborator).
 */
export async function resolverProfissionalIdDoUsuario(
  gerenciador: EntityManager,
  tenantId: string,
  usuario: UsuarioAutenticado
): Promise<string | undefined> {
  if (usuario.papel !== 'Professional') return undefined;

  const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
    where: { usuarioId: usuario.usuarioId, tenantId, arquivadoEm: IsNull() }
  });

  return profissional?.id ?? PROFISSIONAL_SENTINELA_INEXISTENTE;
}
