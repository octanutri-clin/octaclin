import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CriptografiaDadosSensiveis {
  criptografar(valor: string): Buffer {
    const chave = this.obterChave();
    const iv = randomBytes(12);
    const cifra = createCipheriv('aes-256-gcm', chave, iv);
    const conteudo = Buffer.concat([cifra.update(valor, 'utf8'), cifra.final()]);
    return Buffer.concat([iv, cifra.getAuthTag(), conteudo]);
  }

  descriptografar(valor: Buffer): string {
    const chave = this.obterChave();
    const iv = valor.subarray(0, 12);
    const tag = valor.subarray(12, 28);
    const conteudo = valor.subarray(28);
    const decifra = createDecipheriv('aes-256-gcm', chave, iv);
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(conteudo), decifra.final()]).toString('utf8');
  }

  gerarHashBusca(valor: string): string {
    return createHash('sha256').update(valor.trim().toLowerCase()).digest('hex');
  }

  private obterChave(): Buffer {
    const valor = process.env.CRIPTOGRAFIA_CHAVE_AES_256 ?? 'octaclin-chave-local-desenvolvimento';
    return createHash('sha256').update(valor).digest();
  }
}
