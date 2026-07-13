import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface TentativaLogin {
  quantidade: number;
  expiraEm: number;
}

@Injectable()
export class GuardaLimiteLogin implements CanActivate {
  private readonly tentativas = new Map<string, TentativaLogin>();
  private readonly limiteTentativas = 5;
  private readonly janelaMs = 15 * 60 * 1000;

  canActivate(contexto: ExecutionContext): boolean {
    const requisicao = contexto.switchToHttp().getRequest<{
      ip?: string;
      body?: { tenantSlug?: string; email?: string };
    }>();
    const agora = Date.now();
    const chave = [
      requisicao.ip ?? 'ip-desconhecido',
      requisicao.body?.tenantSlug ?? 'tenant-desconhecido',
      requisicao.body?.email?.toLowerCase() ?? 'email-desconhecido'
    ].join(':');
    const tentativa = this.tentativas.get(chave);

    if (!tentativa || tentativa.expiraEm <= agora) {
      this.tentativas.set(chave, { quantidade: 1, expiraEm: agora + this.janelaMs });
      return true;
    }

    if (tentativa.quantidade >= this.limiteTentativas) {
      throw new HttpException('Muitas tentativas de login. Tente novamente mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
    }

    tentativa.quantidade += 1;
    return true;
  }
}
