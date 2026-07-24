import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { montarChaveProtecaoAbuso, POLITICA_LOGIN, ServicoProtecaoAbuso } from '../aplicacao/servico-protecao-abuso';

@Injectable()
export class GuardaLimiteLogin implements CanActivate {
  constructor(private readonly protecaoAbuso: ServicoProtecaoAbuso) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<{
      body?: { tenantSlug?: string; email?: string };
    }>();

    await this.protecaoAbuso.verificarDisponibilidade(
      montarChaveProtecaoAbuso('login', requisicao.body?.tenantSlug, requisicao.body?.email),
      POLITICA_LOGIN
    );
    return true;
  }
}
