import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ServicoSessoes } from '../aplicacao/servico-sessoes';
import { TIPO_TOKEN_ACESSO, validarClaimsToken, type ClaimsToken } from '../dominio/claims-token';
import { contextoAcessoPorPapel } from '../dominio/permissoes';
import type { PermissaoOctaClin } from '../dominio/permissoes';
import { opcoesVerificacao } from '../infraestrutura/configuracao-jwt';
import { UsuarioAutenticado } from '../dominio/usuario-autenticado';

@Injectable()
export class GuardaJwt implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly sessoes: ServicoSessoes
  ) {}

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

    let claims: ClaimsToken;
    try {
      // A verificacao fixa algoritmo, emissor e audiencia; a validacao de claims
      // recusa token de outro tipo, sem sessao, sem tenant ou com papel invalido.
      const payload = await this.jwt.verifyAsync(token, opcoesVerificacao(TIPO_TOKEN_ACESSO));
      claims = validarClaimsToken(payload, TIPO_TOKEN_ACESSO);
    } catch {
      throw new UnauthorizedException('Token de acesso invalido ou expirado.');
    }

    // Sem esta leitura, revogar uma sessao nao teria efeito sobre access tokens
    // ja emitidos ate a expiracao deles, nem entre instancias.
    if (!(await this.sessoes.estaAtiva(claims.tenantId, claims.sub, claims.sid))) {
      throw new UnauthorizedException('Sessao encerrada ou revogada.');
    }

    const contextoAcesso = contextoAcessoPorPapel(claims.papel!);

    requisicao.usuarioAutenticado = {
      usuarioId: claims.sub,
      tenantId: claims.tenantId,
      papel: claims.papel!,
      emailHash: claims.emailHash!,
      permissoes: (claims.permissoes as PermissaoOctaClin[] | undefined) ?? contextoAcesso.permissoes,
      sessaoId: claims.sid
    };

    return true;
  }
}
