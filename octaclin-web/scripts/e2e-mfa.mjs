import { createHmac } from 'node:crypto';

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIODO_TOTP_MS = 30_000;

function decodificarBase32(valor) {
  if (typeof valor !== 'string') {
    throw new Error('Segredo TOTP sintetico deve estar em Base32.');
  }
  const normalizado = valor.trim().toUpperCase().replace(/=+$/, '');
  if (!normalizado || !/^[A-Z2-7]+$/.test(normalizado)) {
    throw new Error('Segredo TOTP sintetico deve estar em Base32.');
  }

  const bytes = [];
  let acumulador = 0;
  let bits = 0;
  for (const caractere of normalizado) {
    acumulador = (acumulador << 5) | ALFABETO_BASE32.indexOf(caractere);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acumulador >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

export function exigirSegredoTotpSintetico(ambiente = process.env) {
  const segredo = ambiente.E2E_MFA_TOTP_SECRET?.trim();
  if (!segredo || !/^[A-Z2-7]{32}$/.test(segredo)) {
    throw new Error('E2E_MFA_TOTP_SECRET sintetico deve conter 32 caracteres Base32.');
  }
  return segredo;
}

export function gerarCodigoTotp(segredo, timestamp = Date.now()) {
  const contador = BigInt(Math.floor(timestamp / PERIODO_TOTP_MS));
  const mensagem = Buffer.alloc(8);
  mensagem.writeBigUInt64BE(contador);
  const hash = createHmac('sha1', decodificarBase32(segredo)).update(mensagem).digest();
  const deslocamento = hash[hash.length - 1] & 0x0f;
  const numero = (hash.readUInt32BE(deslocamento) & 0x7fffffff) % 1_000_000;
  return String(numero).padStart(6, '0');
}

export async function aguardarProximoPeriodoTotp({
  agora = () => Date.now(),
  esperar = (milissegundos) => new Promise((resolve) => setTimeout(resolve, milissegundos)),
  margemMs = 250,
} = {}) {
  const timestamp = agora();
  const esperaMs = PERIODO_TOTP_MS - (timestamp % PERIODO_TOTP_MS) + margemMs;
  await esperar(esperaMs);
  return esperaMs;
}
