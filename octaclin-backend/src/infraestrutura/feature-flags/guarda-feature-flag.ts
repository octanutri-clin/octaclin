import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsuarioAutenticado } from '../../modulos/auth/dominio/usuario-autenticado';
import { FeatureFlagConhecida, ServicoFeatureFlags } from './servico-feature-flags';

export const CHAVE_FEATURE_FLAG = 'octaclin:feature-flag';
export const FeatureFlag = (chave: FeatureFlagConhecida) => SetMetadata(CHAVE_FEATURE_FLAG, chave);

interface RequisicaoComUsuario {
  usuarioAutenticado?: UsuarioAutenticado;
}

@Injectable()
export class GuardaFeatureFlag implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: ServicoFeatureFlags
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const chave = this.reflector.getAllAndOverride<FeatureFlagConhecida>(CHAVE_FEATURE_FLAG, [
      contexto.getHandler(),
      contexto.getClass()
    ]);
    if (!chave) return true;

    const requisicao = contexto.switchToHttp().getRequest<RequisicaoComUsuario>();
    const tenantId = requisicao.usuarioAutenticado?.tenantId;
    if (!tenantId || !(await this.flags.habilitada(tenantId, chave))) {
      throw new ForbiddenException('Funcionalidade indisponivel para esta clinica.');
    }
    return true;
  }
}
