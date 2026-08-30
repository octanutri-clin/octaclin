import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServicoReautenticacao } from '../aplicacao/servico-reautenticacao';
import type { UsuarioAutenticado } from '../dominio/usuario-autenticado';
import { CHAVE_REAUTENTICACAO } from './decorators';

@Injectable()
export class GuardaReautenticacao implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly reautenticacao: ServicoReautenticacao
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const exigida = this.reflector.getAllAndOverride<boolean>(CHAVE_REAUTENTICACAO, [
      contexto.getHandler(),
      contexto.getClass()
    ]);
    if (!exigida) return true;

    const requisicao = contexto.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      usuarioAutenticado?: UsuarioAutenticado;
    }>();
    const usuario = requisicao.usuarioAutenticado;
    const cabecalho = requisicao.headers['x-octaclin-reauth'];
    const prova = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;

    if (!usuario?.sessaoId || !prova) {
      throw new ForbiddenException('Confirme sua senha novamente para continuar.');
    }

    try {
      await this.reautenticacao.validarProva(prova, {
        tenantId: usuario.tenantId,
        usuarioId: usuario.usuarioId,
        sessaoId: usuario.sessaoId
      });
      return true;
    } catch {
      throw new ForbiddenException('Confirme sua senha novamente para continuar.');
    }
  }
}
