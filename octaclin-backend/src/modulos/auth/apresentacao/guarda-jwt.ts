import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuarioAutenticado } from '../dominio/usuario-autenticado';

@Injectable()
export class GuardaJwt implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      usuarioAutenticado?: UsuarioAutenticado;
    }>();
    const authorization = requisicao.headers.authorization;
    const valor = Array.isArray(authorization) ? authorization[0] : authorization;
    const token = valor?.startsWith('Bearer ') ? valor.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente.');
    }

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_SEGREDO ?? 'dev-access-secret'
      });

      requisicao.usuarioAutenticado = {
        usuarioId: payload.sub,
        tenantId: payload.tenantId,
        papel: payload.papel,
        emailHash: payload.emailHash
      };

      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso invalido ou expirado.');
    }
  }
}
