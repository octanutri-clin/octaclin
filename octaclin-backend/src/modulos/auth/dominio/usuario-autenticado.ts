import type { PermissaoOctaClin } from './permissoes';

export type PapelUsuario = 'SuperAdmin' | 'Professional' | 'Collaborator' | 'Patient' | 'Client';

export interface UsuarioAutenticado {
  usuarioId: string;
  tenantId: string;
  papel: PapelUsuario;
  emailHash: string;
  permissoes: PermissaoOctaClin[];
}
