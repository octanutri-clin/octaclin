import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';

const PAPEIS_CLINICOS: readonly UsuarioAutenticado['papel'][] = [
  'SuperAdmin', 'Professional', 'Collaborator'
];

export function podeLerResumoExames(
  tenantId: string,
  usuario: Pick<UsuarioAutenticado, 'tenantId' | 'papel' | 'permissoes'>
): boolean {
  return tenantId === usuario.tenantId
    && PAPEIS_CLINICOS.includes(usuario.papel)
    && usuario.permissoes.includes('pacientes.ler');
}
