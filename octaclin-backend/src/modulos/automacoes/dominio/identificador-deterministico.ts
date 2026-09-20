import { createHash } from 'crypto';

/**
 * UUID v8 deterministico a partir de uma chave de idempotencia textual. Usado
 * para dar identidade estavel a efeitos e registros derivados de uma chave
 * logica (execucao/acao, disparo de gatilho) sem persistir a chave interna
 * nem depender de geracao aleatoria, preservando dedupe sob retry.
 */
export function identificadorDeterministico(finalidade: string, chave: string): string {
  const bytes = createHash('sha256').update(`octaclin:${finalidade}:${chave}`, 'utf8').digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hexadecimal = bytes.toString('hex');
  return `${hexadecimal.slice(0, 8)}-${hexadecimal.slice(8, 12)}-${hexadecimal.slice(12, 16)}-${hexadecimal.slice(16, 20)}-${hexadecimal.slice(20)}`;
}
