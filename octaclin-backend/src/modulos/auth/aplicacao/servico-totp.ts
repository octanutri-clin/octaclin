import { Injectable } from '@nestjs/common';
import * as OTPAuth from 'otpauth';

const EMISSOR = 'OctaClin';
const ALGORITMO = 'SHA1';
const DIGITOS = 6;
const PERIODO = 30;
const JANELA = 1;

@Injectable()
export class ServicoTotp {
  gerarSegredo(): string {
    return new OTPAuth.Secret({ size: 20 }).base32;
  }

  criarUri(segredo: string, rotulo: string): string {
    return this.criarTotp(segredo, rotulo).toString();
  }

  validar(
    segredo: string,
    codigo: string,
    timestamp = Date.now()
  ): { valido: true; contador: number } | { valido: false } {
    if (!/^\d{6}$/.test(codigo)) return { valido: false };

    try {
      const totp = this.criarTotp(segredo, 'conta');
      const delta = totp.validate({ token: codigo, timestamp, window: JANELA });
      if (delta === null) return { valido: false };
      return { valido: true, contador: totp.counter({ timestamp }) + delta };
    } catch {
      return { valido: false };
    }
  }

  private criarTotp(segredo: string, rotulo: string): OTPAuth.TOTP {
    return new OTPAuth.TOTP({
      issuer: EMISSOR,
      label: rotulo,
      algorithm: ALGORITMO,
      digits: DIGITOS,
      period: PERIODO,
      secret: OTPAuth.Secret.fromBase32(segredo)
    });
  }
}
