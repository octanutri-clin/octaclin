import { createHash } from 'crypto';

/** UUID estavel para efeitos derivados; a chave nao e persistida. */
export function identificadorDeterministico(finalidade: string, chave: string): string {
  const bytes = createHash('sha256').update(`octaclin:${finalidade}:${chave}`, 'utf8').digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hexadecimal = bytes.toString('hex');
  return `${hexadecimal.slice(0, 8)}-${hexadecimal.slice(8, 12)}-${hexadecimal.slice(12, 16)}-${hexadecimal.slice(16, 20)}-${hexadecimal.slice(20)}`;
}
