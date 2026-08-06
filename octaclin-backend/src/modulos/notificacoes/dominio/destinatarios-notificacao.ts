import type { PapelUsuario } from '../../auth/dominio/usuario-autenticado';

export interface UsuarioDestinavel {
  id: string;
  role: PapelUsuario;
}

/**
 * Papeis que operam o console com visao de toda a casa (`tenant_total` e
 * `operacional_delegado`): recebem qualquer evento do tenant.
 */
const PAPEIS_VISAO_TOTAL: readonly PapelUsuario[] = ['SuperAdmin', 'Collaborator'];

/**
 * Quem recebe o evento.
 *
 * Professional tem escopo `pacientes_responsaveis`, entao so entra na lista
 * quando e o dono identificado do evento — e por isso um evento sem dono nao vai
 * para profissional nenhum, em vez de ir para todos. Patient e Client ficam de
 * fora: o paciente tem o proprio canal e o gestor da conta nao opera a clinica.
 */
export function destinatariosDaNotificacao(
  usuarios: readonly UsuarioDestinavel[],
  usuarioIdResponsavel: string | undefined
): string[] {
  const ids = usuarios
    .filter((usuario) => PAPEIS_VISAO_TOTAL.includes(usuario.role))
    .map((usuario) => usuario.id);

  const responsavel = usuarios.find(
    (usuario) => usuario.id === usuarioIdResponsavel && usuario.role === 'Professional'
  );
  if (responsavel) ids.push(responsavel.id);

  return [...new Set(ids)];
}
