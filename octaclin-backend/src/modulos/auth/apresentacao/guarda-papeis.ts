import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHAVE_PAPEIS } from './decorators';
import { PapelUsuario } from '../dominio/usuario-autenticado';

@Injectable()
export class GuardaPapeis implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const papeis = this.reflector.getAllAndOverride<PapelUsuario[]>(CHAVE_PAPEIS, [
      contexto.getHandler(),
      contexto.getClass()
    ]);

    if (!papeis?.length) {
      return true;
    }

    const requisicao = contexto.switchToHttp().getRequest<{ usuarioAutenticado?: { papel: PapelUsuario } }>();
    const papelAtual = requisicao.usuarioAutenticado?.papel;

    if (!papelAtual || !papeis.includes(papelAtual)) {
      throw new ForbiddenException('Usuario sem permissao para esta acao.');
    }

    return true;
  }
}
