import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
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

  gerarHashesBuscaPii(tenantId: string, valores: Array<string | undefined>): string[] {
    const hashes = new Set<string>();
    for (const valor of valores) {
      for (const token of this.normalizarTermosBusca(valor)) {
        for (let tamanho = 3; tamanho <= Math.min(token.length, 32); tamanho += 1) {
          hashes.add(this.gerarHashIndicePii(tenantId, token.slice(0, tamanho)));
        }
      }
    }
    return [...hashes].sort();
  }

  gerarHashesConsultaPii(tenantId: string, busca: string): string[] {
    return [...new Set(
      this.normalizarTermosBusca(busca)
        .filter((token) => token.length >= 3)
        .map((token) => this.gerarHashIndicePii(tenantId, token.slice(0, 32)))
    )].sort();
  }

  private normalizarTermosBusca(valor?: string): string[] {
    if (!valor?.trim()) return [];
    return valor
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  private gerarHashIndicePii(tenantId: string, termo: string): string {
    const chaveIndice = createHmac('sha256', this.obterChave())
      .update('octaclin-busca-pii-v1')
      .digest();
    return createHmac('sha256', chaveIndice)
      .update(`${tenantId}\0${termo}`)
      .digest('base64url');
  }

  private obterChave(): Buffer {
    const valor = process.env.CRIPTOGRAFIA_CHAVE_AES_256 ?? 'octaclin-chave-local-desenvolvimento';
    return createHash('sha256').update(valor).digest();
  }
}
