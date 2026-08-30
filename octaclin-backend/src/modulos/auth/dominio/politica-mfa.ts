import { contextoAcessoPorPapel, type PermissaoOctaClin } from './permissoes';
import type { PapelUsuario } from './usuario-autenticado';

const PERMISSOES_PRIVILEGIADAS: readonly PermissaoOctaClin[] = [
  'operacoes.tenants.gerenciar',
  'operacoes.outbox.reprocessar',
  'profissionais.gerenciar',
  'comunicacoes.canais.gerenciar',
  'comunicacoes.templates.gerenciar',
  'automacoes.gerenciar',
  'cliente.usuarios.convidar',
  'cliente.usuarios.desativar',
  'cliente.usuarios.gerenciar',
  'cliente.convites.gerenciar',
  'cliente.configuracoes.gerenciar'
];

/**
 * A obrigatoriedade deriva de capability, nao do nome do papel. Assim um novo
 * papel administrativo nao entra sem MFA por esquecimento em outra lista.
 */
export function exigeMfaPorPapel(papel: PapelUsuario): boolean {
  const permissoes = contextoAcessoPorPapel(papel).permissoes;
  return PERMISSOES_PRIVILEGIADAS.some((permissao) => permissoes.includes(permissao));
}
