import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHAVE_PERMISSOES } from './decorators';
import type { PermissaoOctaClin } from '../dominio/permissoes';

@Injectable()
export class GuardaPermissoes implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const permissoesExigidas = this.reflector.getAllAndOverride<PermissaoOctaClin[]>(CHAVE_PERMISSOES, [
      contexto.getHandler(),
      contexto.getClass()
    ]);

    if (!permissoesExigidas?.length) {
      return true;
    }

    const requisicao = contexto.switchToHttp().getRequest<{ usuarioAutenticado?: { permissoes?: PermissaoOctaClin[] } }>();
    const permissoesUsuario = requisicao.usuarioAutenticado?.permissoes ?? [];
    const autorizado = permissoesExigidas.every((permissao) => permissoesUsuario.includes(permissao));

    if (!autorizado) {
      throw new ForbiddenException('Usuario sem permissao para esta acao.');
    }

    return true;
  }
}
