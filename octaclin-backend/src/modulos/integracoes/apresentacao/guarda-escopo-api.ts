import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ContextoApiPublica, EscopoApiPublica } from '../dominio/contratos-integracao';
import { CHAVE_ESCOPOS_API_PUBLICA } from './decorators-api-publica';

@Injectable()
export class GuardaEscopoApi implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const exigidos = this.reflector.getAllAndOverride<EscopoApiPublica[]>(CHAVE_ESCOPOS_API_PUBLICA, [
      contexto.getHandler(),
      contexto.getClass()
    ]);
    if (!exigidos?.length) return true;
    const requisicao = contexto.switchToHttp().getRequest<{ integracaoAutenticada?: ContextoApiPublica }>();
    if (!exigidos.every((escopo) => requisicao.integracaoAutenticada?.escopos.includes(escopo))) {
      throw new ForbiddenException('Chave de API sem escopo para esta operacao.');
    }
    return true;
  }
}
