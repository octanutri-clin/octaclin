import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PermissaoOctaClin } from '../dominio/permissoes';
import { PapelUsuario, UsuarioAutenticado } from '../dominio/usuario-autenticado';

export const CHAVE_PAPEIS = 'papeisPermitidos';
export const Papeis = (...papeis: PapelUsuario[]) => SetMetadata(CHAVE_PAPEIS, papeis);

export const CHAVE_PERMISSOES = 'permissoesExigidas';
export const Permissoes = (...permissoes: PermissaoOctaClin[]) => SetMetadata(CHAVE_PERMISSOES, permissoes);

export const CHAVE_REAUTENTICACAO = 'reautenticacaoObrigatoria';
export const ReautenticacaoObrigatoria = () => SetMetadata(CHAVE_REAUTENTICACAO, true);

export const UsuarioAtual = createParamDecorator((_: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
  const requisicao = contexto.switchToHttp().getRequest<{ usuarioAutenticado: UsuarioAutenticado }>();
  return requisicao.usuarioAutenticado;
});
