import { EntityManager, IsNull } from 'typeorm';
import { PacienteOrm } from '../../modulos/pacientes/infraestrutura/paciente.orm';

/**
 * UUID que nao corresponde a nenhum registro real. Usado como filtro sentinela
 * quando um usuario Patient autenticado nao possui paciente vinculado,
 * garantindo "nao encontrado" em vez de expor dados de outro paciente.
 */
export const PACIENTE_SENTINELA_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

/**
 * Retorna o pacientes.id vinculado ao usuario Patient autenticado. A
 * identidade vem exclusivamente de `usuarioId` (sessao autenticada) - nunca de
 * um identificador de paciente informado pelo cliente.
 */
export async function resolverPacienteIdDoUsuario(
  gerenciador: EntityManager,
  tenantId: string,
  usuarioId: string
): Promise<string> {
  const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
    where: { usuarioId, tenantId, arquivadoEm: IsNull() }
  });

  return paciente?.id ?? PACIENTE_SENTINELA_INEXISTENTE;
}
