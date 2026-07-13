import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ServicoSenhas {
  gerarHash(senha: string): string {
    const iteracoes = 210000;
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(senha, salt, iteracoes, 32, 'sha512').toString('hex');
    return `pbkdf2$${iteracoes}$${salt}$${hash}`;
  }

  verificar(senha: string, hashArmazenado: string): boolean {
    const partes = hashArmazenado.split('$');
    if (partes.length !== 4 || partes[0] !== 'pbkdf2') {
      return false;
    }

    const iteracoes = Number(partes[1]);
    const salt = partes[2];
    const hashEsperado = Buffer.from(partes[3], 'hex');
    const hashRecebido = pbkdf2Sync(senha, salt, iteracoes, 32, 'sha512');

    return hashEsperado.length === hashRecebido.length && timingSafeEqual(hashEsperado, hashRecebido);
  }
}
