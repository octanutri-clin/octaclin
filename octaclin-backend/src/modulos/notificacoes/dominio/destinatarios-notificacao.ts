import type { PapelUsuario } from '../../auth/dominio/usuario-autenticado';
import type { TipoNotificacao } from './tipo-notificacao';

export interface UsuarioDestinavel {
  id: string;
  role: PapelUsuario;
}

const TIPOS_OPERACIONAIS_COLABORADOR: readonly TipoNotificacao[] = [
  'mensagem_recebida',
  'solicitacao_agendamento',
  'falha_envio'
];

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
  usuarioIdResponsavel: string | undefined,
  tipo: TipoNotificacao
): string[] {
  const ids = usuarios
    .filter(
      (usuario) =>
        usuario.role === 'SuperAdmin' ||
        (usuario.role === 'Collaborator' && TIPOS_OPERACIONAIS_COLABORADOR.includes(tipo))
    )
    .map((usuario) => usuario.id);

  const responsavel = usuarios.find(
    (usuario) => usuario.id === usuarioIdResponsavel && usuario.role === 'Professional'
  );
  if (responsavel) ids.push(responsavel.id);

  return [...new Set(ids)];
}
