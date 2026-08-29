import type { PermissaoOctaClin } from './permissoes';

export type PapelUsuario = 'SuperAdmin' | 'Professional' | 'Collaborator' | 'Patient' | 'Client';

export interface UsuarioAutenticado {
  usuarioId: string;
  tenantId: string;
  papel: PapelUsuario;
  emailHash: string;
  permissoes: PermissaoOctaClin[];
  /**
   * Sessao (familia de refresh tokens) que originou o access token. Opcional no
   * tipo porque fixtures e fluxos internos montam o contexto sem token; o
   * `GuardaJwt` sempre preenche, e endpoints de sessao exigem o valor.
   */
  sessaoId?: string;
}
